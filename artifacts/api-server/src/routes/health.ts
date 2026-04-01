import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { triggerManualSync } from "../lib/scheduler";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.post("/dev/sync", async (_req, res) => {
  const result = await triggerManualSync();
  res.json(result);
});

export default router;
