import { syncFromNetSuite } from "./syncService";
import { isNetSuiteConfigured } from "./netsuite";
import { logger } from "./logger";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let timeoutId: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

async function runSync() {
  if (isSyncing) {
    logger.warn("Skipping scheduled sync — previous sync still in progress");
    scheduleNext();
    return;
  }

  isSyncing = true;
  try {
    logger.info("Running scheduled NetSuite sync");
    const result = await syncFromNetSuite();
    if (result.success) {
      logger.info(
        { categoriesSynced: result.categoriesSynced, productsSynced: result.productsSynced },
        "Scheduled sync completed successfully",
      );
    } else {
      logger.error({ message: result.message }, "Scheduled sync returned failure");
    }
  } catch (err) {
    logger.error({ err }, "Scheduled sync threw an unexpected error");
  } finally {
    isSyncing = false;
    scheduleNext();
  }
}

function scheduleNext() {
  if (timeoutId !== null) return;
  timeoutId = setTimeout(() => {
    timeoutId = null;
    runSync();
  }, SIX_HOURS_MS);
}

export function startScheduledSync() {
  if (!isNetSuiteConfigured()) {
    logger.warn("NetSuite not configured — scheduled sync will not start");
    return;
  }

  if (timeoutId !== null || isSyncing) {
    logger.warn("Scheduled sync already running — skipping duplicate start");
    return;
  }

  logger.info(
    { intervalHours: 6 },
    "Starting scheduled NetSuite sync (every 6 hours)",
  );

  runSync();
}

export async function triggerManualSync() {
  if (isSyncing) {
    return { status: "already_running" as const };
  }
  logger.info("Manual sync triggered");
  isSyncing = true;
  try {
    const result = await syncFromNetSuite();
    if (result.success) {
      logger.info(
        { categoriesSynced: result.categoriesSynced, productsSynced: result.productsSynced },
        "Manual sync completed successfully",
      );
    }
    return { status: "complete" as const, ...result };
  } catch (err) {
    logger.error({ err }, "Manual sync threw an unexpected error");
    return { status: "error" as const, message: String(err) };
  } finally {
    isSyncing = false;
  }
}

export function stopScheduledSync() {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  logger.info("Scheduled NetSuite sync stopped");
}
