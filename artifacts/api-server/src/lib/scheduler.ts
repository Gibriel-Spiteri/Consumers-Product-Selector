import { syncFromNetSuite } from "./syncService";
import { isNetSuiteConfigured } from "./netsuite";
import { logger } from "./logger";

export type ScheduleInterval = "off" | "1h" | "2h" | "4h" | "6h" | "12h" | "24h";

const INTERVAL_MS: Record<ScheduleInterval, number> = {
  off: 0,
  "1h": 1 * 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

let timeoutId: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let currentInterval: ScheduleInterval = "6h";

async function runSync() {
  if (isSyncing) {
    logger.warn("Skipping scheduled sync — previous sync still in progress");
    scheduleNext();
    return;
  }

  isSyncing = true;
  try {
    logger.info("Running scheduled NetSuite sync");
    const result = await syncFromNetSuite("Scheduled");
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
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  const ms = INTERVAL_MS[currentInterval];
  if (ms <= 0) return;
  timeoutId = setTimeout(() => {
    timeoutId = null;
    runSync();
  }, ms);
}

export function getScheduleInterval(): ScheduleInterval {
  return currentInterval;
}

export function setScheduleInterval(interval: ScheduleInterval) {
  if (!(interval in INTERVAL_MS)) {
    throw new Error(`Invalid schedule interval: ${interval}`);
  }
  currentInterval = interval;
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (interval === "off") {
    logger.info("Scheduled sync disabled");
    return;
  }
  logger.info({ interval }, "Sync schedule updated");
  scheduleNext();
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
    { interval: currentInterval },
    `Starting scheduled NetSuite sync (every ${currentInterval})`,
  );

  runSync();
}

export async function triggerManualSync(syncedBy?: string) {
  if (isSyncing) {
    return { status: "already_running" as const };
  }
  logger.info("Manual sync triggered");
  isSyncing = true;
  try {
    const result = await syncFromNetSuite(syncedBy ?? "Manual");
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
