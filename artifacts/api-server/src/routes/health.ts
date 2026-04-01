import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.post("/dev/restart", (_req, res) => {
  res.json({ status: "restarting" });
  setTimeout(() => process.exit(0), 500);
});

export default router;
