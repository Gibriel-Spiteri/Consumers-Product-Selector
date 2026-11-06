import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, issueReportsTable, issueScreenshotUploadsTable } from "@workspace/db";
import { GetAdminIssuesResponse, RequestIssueScreenshotUploadResponse, SubmitIssueReportBody, SubmitIssueReportResponse } from "@workspace/api-zod";
import { requireEmployee } from "../lib/session";
import { getEmployeeByNetsuiteId, isAdminRecord } from "../lib/employees";
import { isNetSuiteConfigured } from "../lib/netsuite";
import { ObjectStorageService } from "../lib/objectStorage";
import { createReportedCase, findEmployeeReport, issueTotal, listIssuePage, refreshIssueCaseStatuses } from "../lib/issue-reports";
import { redactDiagnosticText, safeReportUrl } from "../lib/issue-diagnostics";
import { issueScreenshotExpired, ISSUE_SCREENSHOT_EXPIRED } from "../lib/issue-retention";
import { checkIssueScreenshotRetention } from "../lib/issue-screenshot-purge";

const router: IRouter = Router();
const storage = new ObjectStorageService();

async function requireIssueAdmin(_req: Request, res: Response, next: NextFunction) {
  const employee = await getEmployeeByNetsuiteId(res.locals.employeeId);
  if (!isAdminRecord(employee)) { res.status(403).json({ error: "Admin access required" }); return; }
  next();
}

router.post("/issues/screenshot-upload", requireEmployee, async (_req, res): Promise<void> => {
  try {
    const employeeId = String(res.locals.employeeId);
    const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(issueScreenshotUploadsTable)
      .where(and(eq(issueScreenshotUploadsTable.employeeId, employeeId), gt(issueScreenshotUploadsTable.createdAt, new Date(Date.now() - 3600000))));
    if (count && count.total >= 20) { res.status(429).json({ error: "Screenshot upload limit reached for this hour." }); return; }
    const uploadUrl = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadUrl);
    await db.insert(issueScreenshotUploadsTable).values({ objectPath, employeeId });
    res.json(RequestIssueScreenshotUploadResponse.parse({ uploadUrl, objectPath }));
  } catch (err) {
    res.status(503).json({ error: "Screenshot storage is unavailable. The issue can still be submitted." });
    _req.log.error({ err }, "Could not allocate issue screenshot");
  }
});

router.post("/cases", requireEmployee, async (req, res): Promise<void> => {
  const parsed = SubmitIssueReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Please provide a subject, details, page URL and valid diagnostic context." }); return; }
  const input = parsed.data;
  const employeeId = String(res.locals.employeeId);
  if (!input.subject.trim() || !input.detail.trim() || !safeReportUrl(input.pageUrl)) {
    res.status(400).json({ error: "Subject, detail and an HTTP page URL are required." }); return;
  }
  if (!isNetSuiteConfigured()) { res.status(503).json({ error: "NetSuite is not configured." }); return; }
  try {
    const [previous] = await findEmployeeReport(input.requestId, employeeId);
    if (previous) {
      if (previous.caseId) {
        res.json(SubmitIssueReportResponse.parse({ ok: true, reportId: previous.id, caseId: previous.caseId, caseNumber: previous.caseNumber })); return;
      }
      res.status(409).json({ error: "This report was already received. Check Issues & Bugs in Admin before submitting again.", reportId: previous.id }); return;
    }
    const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(issueReportsTable)
      .where(and(eq(issueReportsTable.employeeId, employeeId), gt(issueReportsTable.createdAt, new Date(Date.now() - 3600000))));
    if (count && count.total >= 20) { res.status(429).json({ error: "Report limit reached for this hour. Please contact an administrator." }); return; }
    let screenshotPath: string | null = null;
    let captureError = input.captureError ? redactDiagnosticText(input.captureError, 300) : null;
    if (input.screenshotPath) {
      const [grant] = await db.select().from(issueScreenshotUploadsTable).where(and(
        eq(issueScreenshotUploadsTable.objectPath, input.screenshotPath),
        eq(issueScreenshotUploadsTable.employeeId, employeeId),
        gt(issueScreenshotUploadsTable.createdAt, new Date(Date.now() - 3600000)),
      )).limit(1);
      if (!grant) { res.status(400).json({ error: "Invalid screenshot upload." }); return; }
      try {
        const file = await storage.getObjectEntityFile(grant.objectPath);
        const [metadata] = await file.getMetadata();
        const [signature] = await file.download({ start: 0, end: 2 });
        if (metadata.contentType !== "image/jpeg" || Number(metadata.size) > 2 * 1024 * 1024
          || signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) throw new Error("Invalid screenshot format");
        screenshotPath = grant.objectPath;
      } catch {
        captureError = "Screenshot upload could not be verified. Report saved without an image.";
      }
    }
    const employee = await getEmployeeByNetsuiteId(employeeId);
    const [report] = await db.insert(issueReportsTable).values({
      id: input.requestId, employeeId,
      employeeName: `${employee?.firstName ?? ""} ${employee?.lastName ?? ""}`.trim() || "Employee",
      subject: input.subject.trim(), detail: input.detail.trim(),
      pageUrl: safeReportUrl(input.pageUrl), browserInfo: redactDiagnosticText(input.browserInfo, 500),
      browserLogs: input.browserLogs.map(log => ({ ...log, message: redactDiagnosticText(log.message) })),
      screenshotPath, captureError: captureError || (screenshotPath ? null : "Screenshot was not captured."),
      submissionState: "pending",
    }).onConflictDoNothing().returning();
    if (!report) { res.status(409).json({ error: "This report is already being processed. Please check Admin." }); return; }
    let caseId: string;
    try {
      caseId = await createReportedCase(report);
    } catch (err) {
      // A failed response can be ambiguous: never automatically repeat the NetSuite write.
      await db.update(issueReportsTable).set({ submissionState: "failed", submissionError: "NetSuite case creation was not confirmed. Check NetSuite before retrying." }).where(eq(issueReportsTable.id, report.id));
      req.log.error({ err, reportId: report.id }, "Issue case creation was not confirmed");
      res.status(502).json({ error: "The report is saved in Admin, but NetSuite case creation was not confirmed. Ask an administrator to check before reporting it again.", reportId: report.id }); return;
    }
    await db.update(issueReportsTable).set({ caseId, submissionState: "submitted" }).where(eq(issueReportsTable.id, report.id));
    try { await refreshIssueCaseStatuses([{ ...report, caseId }]); }
    catch (err) { req.log.warn({ err, reportId: report.id }, "Case created; case status will be checked later"); }
    const [saved] = await findEmployeeReport(report.id, employeeId);
    res.json(SubmitIssueReportResponse.parse({ ok: true, reportId: report.id, caseId, caseNumber: saved?.caseNumber ?? null }));
  } catch (err) {
    req.log.error({ err, reportId: input.requestId }, "Could not save issue report");
    res.status(500).json({ error: "Could not finish saving the report. If you already clicked Send, check Admin before trying again.", reportId: input.requestId });
  }
});

router.use("/admin/issues", requireEmployee, requireIssueAdmin);
router.get("/admin/issues", async (req, res): Promise<void> => {
  // Also catch up after autoscale idle periods, without blocking admin requests.
  void checkIssueScreenshotRetention();
  const page = req.query.page == null ? 1 : Number(req.query.page);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) { res.status(400).json({ error: "Invalid page." }); return; }
  try {
    let rows = await listIssuePage(page);
    let statusSyncError: string | null = null;
    try { statusSyncError = await refreshIssueCaseStatuses(rows); rows = await listIssuePage(page); }
    catch (err) { statusSyncError = "Could not refresh NetSuite case statuses. Last known values are shown."; req.log.warn({ err }, "Issue status refresh failed"); }
    res.json(GetAdminIssuesResponse.parse({
      items: rows.map(({ employeeId: _employeeId, screenshotPath, createdAt, statusCheckedAt, ...row }) => ({
        ...row, createdAt: createdAt.toISOString(), statusCheckedAt: statusCheckedAt?.toISOString() ?? null,
        captureError: screenshotPath && issueScreenshotExpired(createdAt) ? ISSUE_SCREENSHOT_EXPIRED : row.captureError,
        screenshotUrl: screenshotPath && !issueScreenshotExpired(createdAt) ? `/api/admin/issues/${row.id}/screenshot` : null,
      })),
      total: await issueTotal(), page, pageSize: 20, statusSyncError,
    }));
  } catch (err) {
    req.log.error({ err }, "Could not list issue reports");
    res.status(500).json({ error: "Could not load reported issues." });
  }
});

router.get("/admin/issues/:id/screenshot", async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const [report] = await db.select({ path: issueReportsTable.screenshotPath, createdAt: issueReportsTable.createdAt }).from(issueReportsTable).where(eq(issueReportsTable.id, id)).limit(1);
    if (!report?.path) { res.status(404).json({ error: "Screenshot not available." }); return; }
    if (issueScreenshotExpired(report.createdAt)) {
      void checkIssueScreenshotRetention();
      res.status(410).json({ error: ISSUE_SCREENSHOT_EXPIRED }); return;
    }
    const file = await storage.getObjectEntityFile(report.path);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const stream = file.createReadStream();
    stream.on("error", err => {
      req.log.error({ err }, "Issue screenshot stream failed");
      if (!res.headersSent) res.status(500).json({ error: "Could not load screenshot." });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "Could not load issue screenshot");
    if (!res.headersSent) res.status(500).json({ error: "Could not load screenshot." });
  }
});

export default router;
