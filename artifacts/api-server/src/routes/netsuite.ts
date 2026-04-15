import { Router, type IRouter } from "express";
import { syncFromNetSuite } from "../lib/syncService";
import { isNetSuiteConfigured, executeSuiteQL } from "../lib/netsuite";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";
import { TriggerNetSuiteSyncResponse, GetNetSuiteStatusResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/netsuite/sync", async (req, res) => {
  const result = await syncFromNetSuite();
  const response = TriggerNetSuiteSyncResponse.parse(result);
  return res.json(response);
});

router.get("/netsuite/status", async (req, res) => {
  const connected = isNetSuiteConfigured();

  let lastSyncAt: string | null = null;
  try {
    const rows = await db
      .select({ updatedAt: categoriesTable.updatedAt })
      .from(categoriesTable)
      .orderBy(sql`${categoriesTable.updatedAt} DESC`)
      .limit(1);
    if (rows.length > 0 && rows[0].updatedAt) {
      lastSyncAt = rows[0].updatedAt.toISOString();
    }
  } catch {
    lastSyncAt = null;
  }

  const response = GetNetSuiteStatusResponse.parse({
    connected,
    accountId: process.env.NETSUITE_ACCOUNT_ID ?? null,
    lastSyncAt,
  });

  return res.json(response);
});

router.get("/netsuite/diag/:itemid", async (req, res) => {
  try {
    const itemid = req.params.itemid.replace(/'/g, "''");
    const result = await executeSuiteQL<any>(
      `SELECT item.id, item.itemid, item.isinactive,
              BUILTIN.DF(item.custitem_stock_code) AS stockcode,
              item.custitem_expressbath AS isexpressbath
       FROM item
       WHERE item.itemid = '${itemid}'`
    );
    const approaches = [
      {
        name: "builtinCF",
        query: `SELECT BUILTIN.CF(item.custitem_cps_category) AS categoryid FROM InventoryItem item WHERE item.itemid = '${itemid}'`
      },
      {
        name: "anyOf",
        query: `SELECT item.id, cat.id AS categoryid, cat.name AS categoryname FROM InventoryItem item, customrecord_cps_site_category cat WHERE item.itemid = '${itemid}' AND item.custitem_cps_category ANYOF (cat.id)`
      },
      {
        name: "multiselectDf",
        query: `SELECT item.id, BUILTIN.DF(item.custitem_cps_category) AS cpscategory FROM InventoryItem item WHERE item.itemid = '${itemid}'`
      }
    ];
    const categoryResults: any = {};
    for (const approach of approaches) {
      try {
        const r = await executeSuiteQL<any>(approach.query);
        categoryResults[approach.name] = r.items;
      } catch (err: any) {
        categoryResults[approach.name] = { error: err.message?.substring(0, 200) };
      }
    }
    const ppr = await executeSuiteQL<any>(
      `SELECT pi.id, pi.custrecord_ppritem_item, BUILTIN.DF(ppr.custrecord_ppr_status) AS status
       FROM customrecord_ppritem pi
       INNER JOIN customrecord_ppr ppr ON ppr.id = pi.custrecord_ppritem_ppr
       INNER JOIN item ON item.id = pi.custrecord_ppritem_item
       WHERE item.itemid = '${itemid}'`
    );
    return res.json({ item: result.items, categoryApproaches: categoryResults, ppr: ppr.items });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
