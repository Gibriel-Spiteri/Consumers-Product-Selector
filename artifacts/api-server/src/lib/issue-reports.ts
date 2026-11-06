import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, issueReportsTable, type IssueReportRecord } from "@workspace/db";
import { executeSuiteQL, netsuiteCreate } from "./netsuite";
import { caseStatusFields } from "./issue-diagnostics";

export async function createReportedCase(report: IssueReportRecord) {
  const departmentId = process.env.NETSUITE_INNOVATION_TECH_DEPT_ID?.trim() || "12";
  const detail = `${report.detail}\n\nPage URL: ${report.pageUrl}\nReport reference: ${report.id}\nBrowser: ${report.browserInfo}\nCPS Admin: https://consumersstore.com/admin\nScreenshot and filtered browser logs are available in Product Selector Admin → Issues & Bugs. Screenshots are retained for 12 months from the report creation date.`;
  const id = await netsuiteCreate("/supportCase", {
    externalId: `cps-issue-${report.id}`,
    title: report.subject,
    incomingMessage: detail,
    custevent_xprdetail: detail,
    custevent_oprtype: { id: departmentId },
    company: { id: report.employeeId },
  });
  if (!id || !/^\d+$/.test(id)) throw new Error("NetSuite did not return a case ID");
  return id;
}

export async function refreshIssueCaseStatuses(reports: IssueReportRecord[]) {
  const stale = reports.filter(report => report.caseId && /^\d+$/.test(report.caseId)
    && (!report.statusCheckedAt || report.statusCheckedAt.getTime() < Date.now() - 60000));
  // A timed-out create can still succeed in NetSuite. Reconcile by the unique external ID
  // instead of ever repeating an ambiguous write.
  const unconfirmed = reports.filter(report => !report.caseId
    && /^[0-9a-f-]{36}$/i.test(report.id)
    && (report.submissionState === "failed" || report.createdAt.getTime() < Date.now() - 60000));
  if (!stale.length && !unconfirmed.length) return null;
  const ids = [...new Set(stale.map(report => report.caseId!))];
  const externalIds = unconfirmed.map(report => `cps-issue-${report.id}`);
  const filters = [
    ids.length ? `id IN (${ids.join(",")})` : "",
    externalIds.length ? `externalid IN (${externalIds.map(id => `'${id}'`).join(",")})` : "",
  ].filter(Boolean);
  const result = await executeSuiteQL<Record<string, unknown>>(
    `SELECT id, externalid, casenumber, BUILTIN.DF(status) AS statusname FROM supportcase WHERE ${filters.join(" OR ")}`,
  );
  const checkedAt = new Date();
  for (const row of result.items) {
    const id = String(row.id);
    if (!/^\d+$/.test(id)) continue;
    const matched = reports.filter(report => report.caseId === id || `cps-issue-${report.id}` === row.externalid);
    if (!matched.length) continue;
    await db.update(issueReportsTable).set({
      ...caseStatusFields(row), caseId: id, submissionState: "submitted", submissionError: null, statusCheckedAt: checkedAt,
    }).where(inArray(issueReportsTable.id, matched.map(r => r.id)));
  }
  return ids.some(id => !result.items.some(row => String(row.id) === id))
    ? "Some cases could not be read from NetSuite. Their last known statuses are shown." : null;
}

export async function listIssuePage(page: number) {
  return db.select().from(issueReportsTable)
    .orderBy(desc(issueReportsTable.createdAt), desc(issueReportsTable.id)).limit(20).offset((page - 1) * 20);
}

export async function issueTotal() {
  const [row] = await db.select({ total: sql<number>`count(*)::int` }).from(issueReportsTable);
  return row?.total ?? 0;
}

export function findEmployeeReport(id: string, employeeId: string) {
  return db.select().from(issueReportsTable).where(and(eq(issueReportsTable.id, id), eq(issueReportsTable.employeeId, employeeId))).limit(1);
}
