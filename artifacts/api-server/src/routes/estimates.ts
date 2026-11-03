import { Router, type IRouter } from "express";
import { executeSuiteQL, netsuiteRequest, isNetSuiteConfigured } from "../lib/netsuite";
import { logger } from "../lib/logger";
import {
  EstimateItemsSchema, getSpecialOrderProductLines, getSpecialOrderTypes, specialOrderLine, SpecialOrderValidationError,
} from "../lib/specialOrders";

const router: IRouter = Router();

router.get("/estimates/search", async (req, res) => {
  const q = (req.query.q as string || "").trim();
  if (!q) {
    return res.status(400).json({ error: "Missing search query" });
  }

  if (!isNetSuiteConfigured()) {
    return res.status(503).json({ error: "NetSuite not configured" });
  }

  try {
    const stripped = q.replace(/^es/i, "");
    const searchVariants = [q];
    if (stripped !== q) {
      searchVariants.push(stripped);
    }
    if (/^\d+$/.test(stripped)) {
      searchVariants.push(`ES${stripped}`);
    }

    const uniqueVariants = [...new Set(searchVariants.map(v => v.replace(/'/g, "''").replace(/[%_\\]/g, "\\$&")))];
    const tranIdConditions = uniqueVariants.map(v => `t.tranid LIKE '%${v}%'`).join(" OR ");

    const result = await executeSuiteQL<{
      id: string;
      tranid: string;
      entityname: string;
      status: string;
      trandate: string;
      total: string | null;
    }>(`
      SELECT
        t.id,
        t.tranid,
        BUILTIN.DF(t.entity) AS entityname,
        BUILTIN.DF(t.status) AS status,
        t.trandate,
        t.total
      FROM Estimate t
      WHERE (${tranIdConditions})
      AND t.status NOT IN ('Estimate : Voided', 'Estimate : Declined')
      ORDER BY t.trandate DESC
      FETCH FIRST 20 ROWS ONLY
    `);

    const estimates = result.items.slice(0, 20).map(row => ({
      id: Number(row.id),
      tranId: row.tranid,
      customerName: row.entityname ?? "",
      status: row.status ?? "",
      date: row.trandate ?? "",
      total: row.total ? parseFloat(row.total) : null,
    }));

    res.json({ estimates });
  } catch (err) {
    logger.error({ err }, "Failed to search estimates");
    res.status(500).json({ error: "Failed to search estimates" });
  }
});

router.post("/estimates/:estimateId/add-items", async (req, res) => {
  const estimateId = Number(req.params.estimateId);
  if (!Number.isSafeInteger(estimateId) || estimateId <= 0) {
    return res.status(400).json({ error: "Invalid estimate ID" });
  }

  const parsed = EstimateItemsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid quote items", details: parsed.error.issues });
  }
  const validatedItems = parsed.data.items;
  if (validatedItems.some(item => !Number.isSafeInteger(Number(item.netsuiteId)))) {
    return res.status(400).json({ error: "Invalid NetSuite item identifier" });
  }

  if (!isNetSuiteConfigured()) {
    return res.status(503).json({ error: "NetSuite not configured" });
  }

  try {
    const existing = await netsuiteRequest<{
      id: number;
      tranId: string;
      item?: {
        items?: Array<{
          item: { id: number };
          quantity: number;
          amount: number;
          line: number;
        }>;
      };
    }>(`/estimate/${estimateId}?expandSubResources=true`);

    // Pre-validate that every NetSuite item ID we're about to push still exists.
    const distinctIds = Array.from(new Set(validatedItems.map(i => i.netsuiteId)));
    const idList = distinctIds.join(",");
    const check = await executeSuiteQL<{ id: string; itemid: string }>(
      `SELECT id, itemid FROM item WHERE id IN (${idList}) AND isinactive = 'F'`
    );
    const validIds = new Set(check.items.map(r => String(r.id)));
    const invalidIds = distinctIds.filter(id => !validIds.has(String(id)));

    const goodItems = validatedItems.filter(i => validIds.has(String(i.netsuiteId)));
    if (goodItems.length === 0) {
      return res.status(400).json({
        error: "None of the items can be added — they no longer exist in NetSuite.",
        invalidNetsuiteIds: invalidIds,
      });
    }

    // Resolve authoritative membership again when pushing, not just from client-supplied labels.
    const productLines = goodItems.some(item => item.specialOrder)
      ? await getSpecialOrderProductLines(true) : [];
    const typesByLine = new Map<string, Awaited<ReturnType<typeof getSpecialOrderTypes>>>();
    const newLines = [];
    for (const item of goodItems) {
      if (!item.specialOrder) {
        const record = check.items.find(row => String(row.id) === item.netsuiteId);
        if (record?.itemid.startsWith("SP-")) {
          throw new SpecialOrderValidationError("Special-order items require their product line, Type and specifications");
        }
        newLines.push({ item: { id: item.netsuiteId }, quantity: item.quantity });
        continue;
      }
      const details = item.specialOrder;
      const productLine = productLines.find(line =>
        line.id === details.productLineId && line.netsuiteItemId === item.netsuiteId);
      if (!productLine) {
        throw new SpecialOrderValidationError("This special-order product line/item is no longer available");
      }
      let types = typesByLine.get(productLine.id);
      if (!types) {
        types = await getSpecialOrderTypes(productLine.id, true);
        typesByLine.set(productLine.id, types);
      }
      const type = types.find(t => t.id === details.typeId);
      if (!type) {
        throw new SpecialOrderValidationError("The selected special-order Type does not belong to this product line or is inactive");
      }
      newLines.push(specialOrderLine(item.netsuiteId, item.quantity, details, productLine, type));
    }

    await netsuiteRequest(
      `/estimate/${estimateId}`,
      "PATCH",
      {
        custbody_weborder: true,
        item: {
          // PATCH merges the item sublist; unkeyed lines append. Do not resend
          // existing lines or use ?replace=item, which can reset their custom fields/prices.
          items: newLines,
        },
      }
    );

    logger.info(
      { estimateId, tranId: existing.tranId, newItemCount: goodItems.length, skipped: invalidIds },
      "Added items to estimate"
    );

    return res.json({
      success: true,
      estimateId,
      tranId: existing.tranId,
      itemsAdded: goodItems.length,
      skippedNetsuiteIds: invalidIds,
    });
  } catch (err: any) {
    if (err instanceof SpecialOrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    logger.error({ err, estimateId }, "Failed to add items to estimate");
    return res.status(500).json({
      error: "Failed to add items to estimate",
      detail: err?.message ?? "Unknown error",
    });
  }
});

export default router;
