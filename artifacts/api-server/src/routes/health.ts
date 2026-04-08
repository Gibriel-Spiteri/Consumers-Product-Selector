import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { triggerManualSync } from "../lib/scheduler";
import { getSyncProgress } from "../lib/syncService";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.post("/dev/sync", async (_req, res) => {
  const result = await triggerManualSync();
  res.json(result);
});

router.get("/dev/sync/progress", (_req, res) => {
  const progress = getSyncProgress();
  res.json(progress ?? { stage: "idle", percent: 0, detail: "" });
});

import { executeSuiteQL } from "../lib/netsuite";
router.get("/dev/test-field", async (req, res) => {
  try {
    const q = req.query.q as string;
    const result = await executeSuiteQL(q);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
