import { db, appSettingsTable, productUserImagesTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import { logger } from "./logger";
import { objectStorageClient } from "./objectStorage";
import { getLastSyncResult } from "./syncService";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 23 * 60 * 60 * 1000;
const RECENT_SYNC_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const LAST_PURGE_KEY = "user_image_last_purge_at";

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
    logger.error({ err }, "Failed to load last user-image purge timestamp");
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
    logger.error({ err }, "Failed to save last user-image purge timestamp");
  }
}

function gcsKeyFromObjectPath(
  objectPath: string
): { bucketName: string; objectName: string } | null {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) return null;
  const trimmed = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath;
  const fullPath = `${dir}/${trimmed}`;
  const parts = fullPath.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [bucketName, ...rest] = parts;
  return { bucketName, objectName: rest.join("/") };
}

export async function purgeOldUserImages(force = false): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    if (!force) {
      const last = await loadLastPurgeAt();
      if (last !== null && Date.now() - last < MIN_GAP_MS) {
        return 0;
      }
      // Skip if no recent successful sync — otherwise active products' user
      // images could be wrongly purged during a prolonged sync outage.
      const lastSync = getLastSyncResult();
      const lastSyncMs = lastSync?.completedAt ? Date.parse(lastSync.completedAt) : NaN;
      if (!Number.isFinite(lastSyncMs) || Date.now() - lastSyncMs > RECENT_SYNC_MAX_AGE_MS) {
        logger.warn(
          { lastSync: lastSync?.completedAt ?? null },
          "Skipping user-image purge: no recent successful sync"
        );
        return 0;
      }
    }
    const cutoff = new Date(Date.now() - RETENTION_MS);

    const stale = await db
      .select({
        netsuiteId: productUserImagesTable.netsuiteId,
        objectKey: productUserImagesTable.objectKey,
      })
      .from(productUserImagesTable)
      .where(lt(productUserImagesTable.lastSeenInSyncAt, cutoff));

    if (stale.length === 0) {
      await saveLastPurgeAt(new Date());
      return 0;
    }

    await Promise.allSettled(
      stale.map(async (row: { netsuiteId: string; objectKey: string }) => {
        const parsed = gcsKeyFromObjectPath(row.objectKey);
        if (!parsed) return;
        try {
          await objectStorageClient
            .bucket(parsed.bucketName)
            .file(parsed.objectName)
            .delete({ ignoreNotFound: true });
        } catch (err) {
          logger.warn({ err, objectKey: row.objectKey }, "Failed to delete stale GCS object");
        }
      })
    );

    let totalDeleted = 0;
    for (const row of stale) {
      const result = await db
        .delete(productUserImagesTable)
        .where(eq(productUserImagesTable.netsuiteId, row.netsuiteId));
      totalDeleted += result.rowCount ?? 0;
    }

    await saveLastPurgeAt(new Date());
    logger.info({ deleted: totalDeleted }, "Purged stale user-uploaded product images");
    return totalDeleted;
  } catch (err) {
    logger.error({ err }, "Failed during user-image purge");
    return 0;
  } finally {
    running = false;
  }
}

function scheduleNextRun() {
  timeoutId = setTimeout(async () => {
    await purgeOldUserImages();
    scheduleNextRun();
  }, RUN_INTERVAL_MS);
}

export function startUserImagePurgeJob() {
  if (timeoutId) return;
  // Run shortly after startup to recover from any missed schedule, then daily.
  timeoutId = setTimeout(async () => {
    await purgeOldUserImages();
    scheduleNextRun();
  }, 60 * 1000);
  logger.info("Started user-image purge job");
}

export function stopUserImagePurgeJob() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}
