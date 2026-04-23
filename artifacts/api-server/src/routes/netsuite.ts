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

// "Innovation & Technology" is internal id 12 on custom record type 169 (referenced by custevent_oprtype).
// Allow override via env var if it ever changes.
function getInnovationTechDepartmentId(): string {
  return process.env.NETSUITE_INNOVATION_TECH_DEPT_ID?.trim() || "12";
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
    const departmentId = getInnovationTechDepartmentId();
    const reporterLine = employee
      ? `Reported by: ${employee.firstName ?? ""} ${employee.lastName ?? ""} <${employee.email ?? ""}>`.trim()
      : null;
    const fullDetail = reporterLine ? `${reporterLine}\n\n${detail}` : detail;

    const payload: Record<string, unknown> = {
      title: subject.trim().slice(0, 300),
      // Standard "Message" field on supportCase — required by NetSuite.
      incomingMessage: fullDetail,
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
