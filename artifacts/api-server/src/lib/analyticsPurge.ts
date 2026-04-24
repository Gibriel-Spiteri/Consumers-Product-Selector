import { db, analyticsEventsTable, appSettingsTable } from "@workspace/db";
import { lt, eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

const RETENTION_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 23 * 60 * 60 * 1000;
const CHUNK_SIZE = 5000;
const MAX_CHUNKS_PER_RUN = 200;
const LAST_PURGE_KEY = "analytics_last_purge_at";

let timeoutId: ReturnType<typeof setTimeout> | null = null;
let running = false;

async function loadLastPurgeAt(): Promise<number | null> {
  try {
    const rows = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, LAST_PURGE_KEY));
    if (rows.length === 0) return null;
    const t = Date.parse(rows[0].value);
    return Number.isFinite(t) ? t : null;
  } catch (err) {
    logger.error({ err }, "Failed to load last analytics purge timestamp");
    return null;
  }
}

async function saveLastPurgeAt(when: Date): Promise<void> {
  try {
    await db
      .insert(appSettingsTable)
      .values({ key: LAST_PURGE_KEY, value: when.toISOString() })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value: when.toISOString() },
      });
  } catch (err) {
    logger.error({ err }, "Failed to save last analytics purge timestamp");
  }
}

export async function purgeOldAnalytics(force = false): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    if (!force) {
      const last = await loadLastPurgeAt();
      if (last !== null && Date.now() - last < MIN_GAP_MS) {
        return 0;
      }
    }
    const cutoff = new Date(Date.now() - RETENTION_MS);
    let totalDeleted = 0;
    for (let i = 0; i < MAX_CHUNKS_PER_RUN; i++) {
      const idsToDelete = await db
        .select({ id: analyticsEventsTable.id })
        .from(analyticsEventsTable)
        .where(lt(analyticsEventsTable.createdAt, cutoff))
        .limit(CHUNK_SIZE);
      if (idsToDelete.length === 0) break;
      await db
        .delete(analyticsEventsTable)
        .where(inArray(analyticsEventsTable.id, idsToDelete.map((r) => r.id)));
      totalDeleted += idsToDelete.length;
      if (idsToDelete.length < CHUNK_SIZE) break;
    }
    await saveLastPurgeAt(new Date());
    if (totalDeleted > 0) {
      logger.info(
        { deletedCount: totalDeleted, cutoff: cutoff.toISOString() },
        "Purged analytics events older than retention window",
      );
    }
    return totalDeleted;
  } catch (err) {
    logger.error({ err }, "Analytics purge failed");
    return 0;
  } finally {
    running = false;
  }
}

function scheduleNext() {
  if (timeoutId !== null) return;
  timeoutId = setTimeout(async () => {
    timeoutId = null;
    await purgeOldAnalytics();
    scheduleNext();
  }, RUN_INTERVAL_MS);
}

export function startAnalyticsPurgeJob() {
  stopAnalyticsPurgeJob();
  void purgeOldAnalytics().finally(() => scheduleNext());
}

export function stopAnalyticsPurgeJob() {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}
