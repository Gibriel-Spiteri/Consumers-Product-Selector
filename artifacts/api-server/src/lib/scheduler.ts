import { syncFromNetSuite } from "./syncService";
import { isNetSuiteConfigured } from "./netsuite";
import { logger } from "./logger";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type ScheduleInterval = "off" | "1h" | "2h" | "4h" | "6h" | "12h" | "24h";

export interface TimeWindow {
  startHour: number;
  endHour: number;
}

const INTERVAL_MS: Record<ScheduleInterval, number> = {
  off: 0,
  "1h": 1 * 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

const INTERVAL_HOURS: Record<ScheduleInterval, number> = {
  off: 0,
  "1h": 1,
  "2h": 2,
  "4h": 4,
  "6h": 6,
  "12h": 12,
  "24h": 24,
};

let timeoutId: ReturnType<typeof setTimeout> | null = null;
let isScheduledSyncing = false;
let isManualSyncing = false;
let currentInterval: ScheduleInterval = "6h";
let timeWindow: TimeWindow | null = null;

async function saveSetting(key: string, value: string) {
  try {
    await db
      .insert(appSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });
  } catch (err) {
    logger.error({ err, key }, "Failed to save setting");
  }
}

async function loadSetting(key: string): Promise<string | null> {
  try {
    const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
    return rows.length > 0 ? rows[0].value : null;
  } catch (err) {
    logger.error({ err, key }, "Failed to load setting");
    return null;
  }
}

export async function loadPersistedSchedule() {
  const savedInterval = await loadSetting("sync_interval");
  if (savedInterval && savedInterval in INTERVAL_MS) {
    currentInterval = savedInterval as ScheduleInterval;
    logger.info({ interval: currentInterval }, "Loaded persisted sync interval");
  }
  const savedWindow = await loadSetting("sync_time_window");
  if (savedWindow) {
    try {
      const parsed = JSON.parse(savedWindow);
      if (parsed === null) {
        timeWindow = null;
      } else if (typeof parsed.startHour === "number" && typeof parsed.endHour === "number") {
        timeWindow = parsed;
      }
      logger.info({ timeWindow }, "Loaded persisted sync time window");
    } catch {
      logger.warn("Failed to parse persisted sync time window");
    }
  }
}

function getNowEastern(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function getScheduledSyncTimes(): string[] {
  if (currentInterval === "off") return [];
  const intervalH = INTERVAL_HOURS[currentInterval];
  if (!timeWindow) {
    const times: string[] = [];
    for (let h = 0; h < 24; h += intervalH) {
      const suffix = h < 12 ? "AM" : "PM";
      const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
      times.push(`${display}:00 ${suffix}`);
    }
    return times;
  }
  const times: string[] = [];
  for (let h = timeWindow.startHour; h <= timeWindow.endHour; h += intervalH) {
    const suffix = h < 12 ? "AM" : "PM";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    times.push(`${display}:00 ${suffix}`);
  }
  return times;
}

function isAllowedToSync(): boolean {
  if (!timeWindow) return true;
  const now = getNowEastern();
  const hour = now.getHours();
  return hour >= timeWindow.startHour && hour <= timeWindow.endHour;
}

function msUntilNextSyncSlot(): number {
  if (!timeWindow) return INTERVAL_MS[currentInterval];

  const now = getNowEastern();
  const hour = now.getHours();
  const intervalH = INTERVAL_HOURS[currentInterval];

  let nextHour: number | null = null;
  for (let h = timeWindow.startHour; h <= timeWindow.endHour; h += intervalH) {
    if (h > hour || (h === hour && now.getMinutes() < 5)) {
      nextHour = h;
      break;
    }
  }

  if (nextHour === null) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(timeWindow.startHour, 0, 0, 0);
    return tomorrow.getTime() - now.getTime();
  }

  const target = new Date(now);
  target.setHours(nextHour, 0, 0, 0);
  const diff = target.getTime() - now.getTime();
  return diff > 0 ? diff : 60 * 1000;
}

async function runSync() {
  if (isScheduledSyncing) {
    logger.warn("Skipping scheduled sync — previous scheduled sync still in progress");
    scheduleNext();
    return;
  }

  if (!isAllowedToSync()) {
    logger.info(
      { currentHour: getNowEastern().getHours(), window: timeWindow },
      "Outside sync window — scheduling next check",
    );
    scheduleNext();
    return;
  }

  if (isManualSyncing) {
    logger.info("Manual sync in progress — waiting for it to finish before scheduled sync");
    const waitForManual = () =>
      new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (!isManualSyncing) {
            clearInterval(check);
            resolve();
          }
        }, 5000);
      });
    await waitForManual();
  }

  isScheduledSyncing = true;
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
    isScheduledSyncing = false;
    scheduleNext();
  }
}

function scheduleNext() {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (currentInterval === "off") return;

  const delayMs = msUntilNextSyncSlot();
  logger.info({ delayMin: Math.round(delayMs / 60000) }, "Next sync check scheduled");

  timeoutId = setTimeout(() => {
    timeoutId = null;
    runSync();
  }, delayMs);
}

export function getScheduleInterval(): ScheduleInterval {
  return currentInterval;
}

export function getTimeWindow(): TimeWindow | null {
  return timeWindow;
}

export function getScheduledTimes(): string[] {
  return getScheduledSyncTimes();
}

export async function setScheduleInterval(interval: ScheduleInterval) {
  if (!(interval in INTERVAL_MS)) {
    throw new Error(`Invalid schedule interval: ${interval}`);
  }
  currentInterval = interval;
  await saveSetting("sync_interval", interval);
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (interval === "off") {
    logger.info("Scheduled sync disabled");
    return;
  }
  logger.info({ interval, timeWindow }, "Sync schedule updated");
  scheduleNext();
}

export async function setTimeWindow(window: TimeWindow | null) {
  if (window && window.startHour > window.endHour) {
    throw new Error("First sync hour must be before last sync hour");
  }
  timeWindow = window;
  await saveSetting("sync_time_window", JSON.stringify(window));
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  logger.info({ timeWindow: window }, "Sync time window updated");
  if (currentInterval !== "off") {
    scheduleNext();
  }
}

export function startScheduledSync() {
  if (!isNetSuiteConfigured()) {
    logger.warn("NetSuite not configured — scheduled sync will not start");
    return;
  }

  if (timeoutId !== null || isScheduledSyncing) {
    logger.warn("Scheduled sync already running — skipping duplicate start");
    return;
  }

  logger.info(
    { interval: currentInterval, timeWindow },
    `Starting scheduled NetSuite sync (every ${currentInterval})`,
  );

  runSync();
}

export async function triggerManualSync(syncedBy?: string) {
  if (isManualSyncing || isScheduledSyncing) {
    return { status: "already_running" as const };
  }
  logger.info("Manual sync triggered");
  isManualSyncing = true;
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
    isManualSyncing = false;
  }
}

export function stopScheduledSync() {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  logger.info("Scheduled NetSuite sync stopped");
}
