import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { triggerManualSync } from "../lib/scheduler";
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

export default router;
