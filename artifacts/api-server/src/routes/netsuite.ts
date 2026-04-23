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
  // Allow override via env var
  const envId = process.env.NETSUITE_INNOVATION_TECH_DEPT_ID?.trim();
  if (envId) {
    cachedInnovationTechDeptId = { id: envId, at: Date.now() };
    return envId;
  }
  // custevent_oprtype sources from a custom list (not the standard department table).
  // Try a few likely custom list table names.
  const candidateTables = [
    "customlist_oprtype",
    "customlist_oprtype_list",
    "customlist_operation_type",
  ];
  for (const table of candidateTables) {
    try {
      const result = await executeSuiteQL<{ id: string; name: string }>(
        `SELECT id, name FROM ${table} WHERE LOWER(name) LIKE '%innovation%' AND LOWER(name) LIKE '%technology%'`
      );
      if (result.items.length > 0) {
        const id = String(result.items[0].id);
        logger.info({ id, name: result.items[0].name, table }, "Resolved Innovation & Technology entry");
        cachedInnovationTechDeptId = { id, at: Date.now() };
        return id;
      }
      logger.info({ table }, "Custom list queried but no matching row");
    } catch (err: any) {
      logger.info({ table, err: err?.message }, "Custom list table not queryable, trying next");
    }
  }
  return null;
}

// Diagnostic: list rows of the custom list backing custevent_oprtype so we can find the right ID
router.get("/cases/oprtype-list", async (_req, res) => {
  const candidateTables = [
    "customlist_oprtype",
    "customlist_oprtype_list",
    "customlist_operation_type",
  ];
  const results: Record<string, unknown> = {};
  for (const table of candidateTables) {
    try {
      const r = await executeSuiteQL<{ id: string; name: string }>(
        `SELECT id, name FROM ${table} ORDER BY name`
      );
      results[table] = r.items;
    } catch (err: any) {
      results[table] = { error: err?.message };
    }
  }
  return res.json(results);
});

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
      // "Detail" on this account's supportCase form is the custom field custevent_xprdetail.
      custevent_xprdetail: fullDetail,
    };
    // "Department" is the custom field custevent_oprtype (list/record reference).
    if (departmentId) payload.custevent_oprtype = { id: departmentId };
    // "Case Created By" is the company field on this form.
    if (employee?.id) payload.company = { id: String(employee.id) };

    if (!departmentId) {
      return res.status(500).json({
        error:
          "Innovation & Technology department could not be found in NetSuite. Set NETSUITE_INNOVATION_TECH_DEPT_ID with the department's internal id.",
      });
    }

    logger.info({ payload }, "Creating NetSuite support case with payload");
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
