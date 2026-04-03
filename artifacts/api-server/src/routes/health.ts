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

router.get("/dev/probe-attrs", async (_req, res) => {
  const { executeSuiteQL } = await import("../lib/netsuite");
  const results: Record<string, any> = {};
  const queries: [string, string][] = [
    ["item-attr-sample", `SELECT item.id, item.itemid,
      item.custitem_finish, item.custitem_material, item.custitem_collection,
      item.custitem_warranty, item.custitem_prodline,
      BUILTIN.DF(item.custitem_finish) AS finish_display,
      BUILTIN.DF(item.custitem_material) AS material_display,
      BUILTIN.DF(item.custitem_collection) AS collection_display,
      BUILTIN.DF(item.custitem_prodline) AS prodline_display
      FROM InventoryItem item
      WHERE item.isinactive = 'F' AND item.isonline = 'T'
      AND ROWNUM <= 5`],
    ["distinct-finishes", `SELECT DISTINCT BUILTIN.DF(item.custitem_finish) AS finish
      FROM InventoryItem item
      WHERE item.isinactive = 'F' AND item.isonline = 'T' AND item.custitem_finish IS NOT NULL
      ORDER BY finish`],
    ["distinct-materials", `SELECT DISTINCT BUILTIN.DF(item.custitem_material) AS material
      FROM InventoryItem item
      WHERE item.isinactive = 'F' AND item.isonline = 'T' AND item.custitem_material IS NOT NULL
      ORDER BY material`],
    ["distinct-collections", `SELECT DISTINCT BUILTIN.DF(item.custitem_collection) AS collection
      FROM InventoryItem item
      WHERE item.isinactive = 'F' AND item.isonline = 'T' AND item.custitem_collection IS NOT NULL
      ORDER BY collection`],
  ];
  for (const [name, q] of queries) {
    try {
      const r = await executeSuiteQL(q);
      results[name] = r.items;
    } catch (e: any) {
      results[name] = { error: e.message.substring(0, 400) };
    }
  }
  res.json(results);
});

export default router;
