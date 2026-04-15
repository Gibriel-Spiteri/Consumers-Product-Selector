import { Router, type IRouter } from "express";
import { syncFromNetSuite } from "../lib/syncService";
import { isNetSuiteConfigured, executeSuiteQL, getAccessToken, getBaseUrl } from "../lib/netsuite";
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
              item.custitem_expressbath AS isexpressbath,
              CASE WHEN item.custitem_cps_category IS NOT NULL THEN 'T' ELSE 'F' END AS hascpscategory
       FROM item
       WHERE item.itemid = '${itemid}'`
    );

    const token = await getAccessToken();
    const baseUrl = getBaseUrl();
    const itemId = result.items[0]?.id;

    let categories: any[] = [];
    if (itemId) {
      for (const recordType of ["inventoryitem", "kititem"]) {
        try {
          const subRes = await fetch(
            `${baseUrl}/services/rest/record/v1/${recordType}/${itemId}/custitem_cps_category`,
            { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
          );
          if (subRes.ok) {
            const data = await subRes.json() as any;
            if (data.items?.length > 0) {
              categories = data.items.map((c: any) => ({ id: c.id, name: c.refName }));
              break;
            }
          }
        } catch {}
      }
    }

    const ppr = await executeSuiteQL<any>(
      `SELECT pi.id, pi.custrecord_ppritem_item, BUILTIN.DF(ppr.custrecord_ppr_status) AS status
       FROM customrecord_ppritem pi
       INNER JOIN customrecord_ppr ppr ON ppr.id = pi.custrecord_ppritem_ppr
       INNER JOIN item ON item.id = pi.custrecord_ppritem_item
       WHERE item.itemid = '${itemid}'`
    );
    return res.json({ item: result.items, categories, ppr: ppr.items });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
