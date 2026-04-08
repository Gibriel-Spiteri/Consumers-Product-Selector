import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { triggerManualSync, getScheduleInterval, setScheduleInterval, type ScheduleInterval } from "../lib/scheduler";
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
  res.json({ interval: getScheduleInterval() });
});

router.post("/dev/sync/schedule", (req, res) => {
  const interval = req.body?.interval as ScheduleInterval | undefined;
  if (!interval) {
    return res.status(400).json({ error: "interval is required" });
  }
  try {
    setScheduleInterval(interval);
    res.json({ interval: getScheduleInterval() });
  } catch {
    res.status(400).json({ error: "Invalid interval" });
  }
});

export default router;
