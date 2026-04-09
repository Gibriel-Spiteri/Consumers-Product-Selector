import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { triggerManualSync, getScheduleInterval, setScheduleInterval, getTimeWindow, setTimeWindow, getScheduledTimes, type ScheduleInterval, type TimeWindow } from "../lib/scheduler";
import { getSyncProgress, getLastSyncResult } from "../lib/syncService";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.post("/dev/sync", async (req, res) => {
  const syncedBy = req.body?.syncedBy as string | undefined;
  const result = await triggerManualSync(syncedBy);
  res.json(result);
});

router.get("/dev/sync/progress", (_req, res) => {
  const progress = getSyncProgress();
  res.json(progress ?? { stage: "idle", percent: 0, detail: "" });
});

router.get("/dev/sync/last", (_req, res) => {
  const result = getLastSyncResult();
  res.json(result ?? null);
});

router.get("/dev/sync/schedule", (_req, res) => {
  res.json({ interval: getScheduleInterval(), timeWindow: getTimeWindow(), syncTimes: getScheduledTimes() });
});

router.post("/dev/sync/schedule", async (req, res) => {
  const interval = req.body?.interval as ScheduleInterval | undefined;
  const tw = req.body?.timeWindow as TimeWindow | null | undefined;

  if (interval) {
    try {
      await setScheduleInterval(interval);
    } catch {
      return res.status(400).json({ error: "Invalid interval" });
    }
  }

  if (tw !== undefined) {
    if (tw === null) {
      await setTimeWindow(null);
    } else if (
      typeof tw.startHour === "number" && typeof tw.endHour === "number" &&
      tw.startHour >= 0 && tw.startHour <= 23 &&
      tw.endHour >= 0 && tw.endHour <= 23
    ) {
      await setTimeWindow({ startHour: tw.startHour, endHour: tw.endHour });
    } else {
      return res.status(400).json({ error: "Invalid time window" });
    }
  }

  res.json({ interval: getScheduleInterval(), timeWindow: getTimeWindow(), syncTimes: getScheduledTimes() });
});

export default router;
