import { Router, type IRouter } from "express";
import { isNetSuiteConfigured } from "../lib/netsuite";
import {
  getSpecialOrderProductLines, getSpecialOrderTypes, positiveId, SpecialOrderValidationError,
} from "../lib/specialOrders";

const router: IRouter = Router();
router.use("/special-orders", (_req, res, next) => {
  if (!isNetSuiteConfigured()) {
    res.status(503).json({ error: "NetSuite not configured" });
    return;
  }
  next();
});
router.get("/special-orders/product-lines", async (req, res) => {
  try {
    res.json(await getSpecialOrderProductLines());
  } catch (err) {
    req.log.error({ err }, "Failed to load special-order product lines");
    res.status(502).json({ error: "Could not load product lines from NetSuite. Please retry." });
  }
});
router.get("/special-orders/product-lines/:productLineId/types", async (req, res) => {
  try {
    const id = positiveId(req.params.productLineId);
    const types = await getSpecialOrderTypes(id);
    res.json(types.map(({ classId: _classId, ...type }) => type));
  } catch (err) {
    if (err instanceof SpecialOrderValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to load special-order Types");
    res.status(502).json({ error: "Could not load special-order Types from NetSuite. Please retry." });
  }
});
export default router;
