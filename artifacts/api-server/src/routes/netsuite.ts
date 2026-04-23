import { Router, type IRouter } from "express";
import { syncFromNetSuite } from "../lib/syncService";
import { isNetSuiteConfigured, executeSuiteQL, netsuiteRequest } from "../lib/netsuite";
import { logger } from "../lib/logger";
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
      `SELECT item.id, item.itemid, item.itemtype, item.isinactive, item.isonline,
              NVL(BUILTIN.DF(item.custitem_stock_code), '(null)') AS stockcode,
              item.custitem_expressbath AS isexpressbath,
              item.custitem_noreorders AS isnoreorder,
              item.custitem_specord_stock AS isspecialorderstock,
              item.custitem_cps_category AS cpscategoryid,
              BUILTIN.DF(item.custitem_cps_category) AS cpscategoryname,
              NVL(item.custitem_itemthumbnailurl, '(null)') AS thumbnailurl,
              NVL(item.custitem_itemimageurl, '(null)') AS imageurl,
              NVL(BUILTIN.DF(item.storedisplayimage), '(null)') AS storedisplayimage,
              NVL(BUILTIN.DF(item.storedisplaythumbnail), '(null)') AS storedisplaythumbnail,
              NVL(TO_CHAR(item.storedisplayimage), '(null)') AS storedisplayimage_id,
              NVL(TO_CHAR(item.storedisplaythumbnail), '(null)') AS storedisplaythumbnail_id
       FROM item
       WHERE item.itemid = '${itemid}'`
    );

    const ppr = await executeSuiteQL<any>(
      `SELECT pi.id, pi.custrecord_ppritem_item, BUILTIN.DF(ppr.custrecord_ppr_status) AS status
       FROM customrecord_ppritem pi
       INNER JOIN customrecord_ppr ppr ON ppr.id = pi.custrecord_ppritem_ppr
       INNER JOIN item ON item.id = pi.custrecord_ppritem_item
       WHERE item.itemid = '${itemid}'`
    );
    return res.json({ item: result.items, ppr: ppr.items });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Cache the Innovation & Technology department lookup so we don't query every time
let cachedInnovationTechDeptId: { id: string; at: number } | null = null;
const DEPT_CACHE_TTL_MS = 60 * 60 * 1000;

async function getInnovationTechDepartmentId(): Promise<string | null> {
  if (cachedInnovationTechDeptId && Date.now() - cachedInnovationTechDeptId.at < DEPT_CACHE_TTL_MS) {
    return cachedInnovationTechDeptId.id;
  }
  try {
    const result = await executeSuiteQL<{ id: string; name: string }>(
      `SELECT id, name FROM department WHERE LOWER(name) LIKE '%innovation%technology%' OR LOWER(fullname) LIKE '%innovation%technology%'`
    );
    if (result.items.length > 0) {
      const id = String(result.items[0].id);
      cachedInnovationTechDeptId = { id, at: Date.now() };
      return id;
    }
  } catch (err) {
    logger.warn({ err }, "Failed to look up Innovation & Technology department");
  }
  return null;
}

router.post("/cases", async (req, res) => {
  const { subject, detail, employee } = req.body ?? {};

  if (!subject || typeof subject !== "string" || !subject.trim()) {
    return res.status(400).json({ error: "subject is required" });
  }
  if (!detail || typeof detail !== "string" || !detail.trim()) {
    return res.status(400).json({ error: "detail is required" });
  }

  if (!isNetSuiteConfigured()) {
    return res.status(503).json({ error: "NetSuite is not configured" });
  }

  try {
    const departmentId = await getInnovationTechDepartmentId();
    const reporterLine = employee
      ? `Reported by: ${employee.firstName ?? ""} ${employee.lastName ?? ""} <${employee.email ?? ""}>`.trim()
      : null;
    const fullDetail = reporterLine ? `${reporterLine}\n\n${detail}` : detail;

    const payload: Record<string, unknown> = {
      title: subject.trim().slice(0, 300),
      incomingMessage: fullDetail,
    };
    if (departmentId) payload.department = { id: departmentId };

    const result = await netsuiteRequest<Record<string, unknown>>(
      "/supportCase",
      "POST",
      payload
    );
    logger.info({ subject, departmentId, result }, "NetSuite support case created");
    return res.json({ ok: true, caseId: (result as any)?.id ?? null });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Failed to create NetSuite support case");
    return res.status(500).json({ error: err?.message || "Failed to create case" });
  }
});

export default router;
