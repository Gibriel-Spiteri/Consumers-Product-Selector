import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, issueReportsTable, issueScreenshotUploadsTable } from "@workspace/db";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";
import { ISSUE_SCREENSHOT_EXPIRED } from "./issue-retention";
import { logger } from "./logger";

const storage = new ObjectStorageService();
let active: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextCheck = 0;

/** Safe on multiple replicas: deletion is idempotent; only clear paths after success. */
async function purgeExpiredScreenshots(): Promise<void> {
  const rows = await db.select({
    id: issueReportsTable.id, path: issueReportsTable.screenshotPath,
  }).from(issueReportsTable).where(and(
    isNotNull(issueReportsTable.screenshotPath),
    sql`((${issueReportsTable.createdAt} AT TIME ZONE 'UTC') + interval '12 months') <= (now() AT TIME ZONE 'UTC')`,
  )).limit(500);
  for (const row of rows) {
    if (!row.path) continue;
    try {
      try {
        const file = await storage.getObjectEntityFile(row.path);
        await file.delete({ ignoreNotFound: true });
      } catch (err) {
        if (!(err instanceof ObjectNotFoundError)) throw err;
      }
      await db.update(issueReportsTable).set({
        screenshotPath: null, captureError: ISSUE_SCREENSHOT_EXPIRED,
      }).where(and(eq(issueReportsTable.id, row.id), eq(issueReportsTable.screenshotPath, row.path)));
      await db.delete(issueScreenshotUploadsTable).where(eq(issueScreenshotUploadsTable.objectPath, row.path));
    } catch (err) {
      logger.error({ err, reportId: row.id }, "Could not delete expired issue screenshot; will retry");
    }
  }
  logger.info({ checked: rows.length }, "Completed issue screenshot retention cleanup");
  // Drain large backlogs in bounded batches, retrying failures on the next pass.
  nextCheck = Date.now() + (rows.length === 500 ? 60000 : 3600000);
}

export function checkIssueScreenshotRetention(): Promise<void> {
  if (active) return active;
  if (Date.now() < nextCheck) return Promise.resolve();
  active = purgeExpiredScreenshots().catch(err => {
    logger.error({ err }, "Issue screenshot retention cleanup failed");
    nextCheck = Date.now() + 60000;
  }).finally(() => { active = null; });
  return active;
}

export function startIssueScreenshotPurgeJob(): void {
  if (timer) return;
  void checkIssueScreenshotRetention();
  timer = setInterval(() => { void checkIssueScreenshotRetention(); }, 60000);
  timer.unref();
}

export function stopIssueScreenshotPurgeJob(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
