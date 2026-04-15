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
              item.custitem_expressbath AS isexpressbath
       FROM item
       WHERE item.itemid = '${itemid}'`
    );
    const allCatIds = await executeSuiteQL<any>(
      `SELECT id, name FROM customrecord_cps_site_category WHERE isinactive = 'F' ORDER BY id`
    );
    const catIds = allCatIds.items.map((c: any) => String(c.id));

    const token = await getAccessToken();
    const baseUrl = getBaseUrl();
    const itemId = result.items[0]?.id;

    let categoryData: any = null;
    if (itemId) {
      const subRes = await fetch(
        `${baseUrl}/services/rest/record/v1/inventoryitem/${itemId}/custitem_cps_category`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
      );
      categoryData = await subRes.json();
    }

    const categoryResults: any = { categories: categoryData?.items || [], totalCategories: catIds.length };
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
