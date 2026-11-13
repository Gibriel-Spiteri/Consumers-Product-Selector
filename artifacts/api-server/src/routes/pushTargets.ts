import { Router, type IRouter } from "express";
import { isNetSuiteConfigured } from "../lib/netsuite";
import { logger } from "../lib/logger";
import { requireEmployee } from "../lib/session";
import { parseTargetQuery, searchEstimateTargets, searchOrderTargets } from "../lib/pushTargets";

/*
 * The Quote List's one search box (2026-11-13, variant B of the Push to redesign): estimates and Sales Orders by
 * number or customer name. lib/pushTargets.ts has the rules; the pushes themselves are the existing routes.
 */
const router: IRouter = Router();
router.use("/push-targets", requireEmployee);

router.get("/push-targets/search", async (req, res) => {
  if (!isNetSuiteConfigured()) return res.status(503).json({ error: "NetSuite not configured" });
  const q = parseTargetQuery(String(req.query.q ?? ""));
  if (!q) {
    return res.status(400).json({ error: "Type an estimate, Sales Order or SOR number (3 digits or more), or at least 3 letters of the customer's name." });
  }
  try {
    const [estimates, orders] = await Promise.all([searchEstimateTargets(q), searchOrderTargets(q)]);
    return res.json({ query: q, estimates, orders });
  } catch (err: any) {
    logger.error({ err, q: req.query.q }, "Push target search failed");
    if (/ 429 /.test(String(err?.message))) {
      return res.status(503).json({ error: "NetSuite is busy right now. Wait a few seconds and search again." });
    }
    return res.status(500).json({ error: "Could not search NetSuite. Try again." });
  }
});

export default router;
