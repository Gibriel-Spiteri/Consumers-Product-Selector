import { Router, type IRouter } from "express";
import { executeSuiteQL, netsuiteRequest, isNetSuiteConfigured } from "../lib/netsuite";
import { logger } from "../lib/logger";
import {
  EstimateItemsSchema, fillSpecialOrderOptions, getSpecialOrderPricing, getSpecialOrderProductLines, getSpecialOrderTypes,
  positiveId, specialOrderLine, specialOrderSpecs, SpecialOrderValidationError,
} from "../lib/specialOrders";
import { bearerToken, requireEmployee } from "../lib/session";
import { estimateActionId, estimateSessionId, recordEstimatePush } from "../lib/estimate-analytics";
import { trackingId, vendorDomain } from "../lib/vendor-conversions";

const router: IRouter = Router();
// Estimates are NetSuite customer data and writes: signed-in staff only.
router.use("/estimates", requireEmployee);

// NetSuite's own error text ("detail") when there is one, for the message staff see.
function netsuiteReason(err: any): string {
  const message = String(err?.message ?? "");
  const detail = message.match(/"detail"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  return detail ? JSON.parse(`"${detail[1]}"`) : message.slice(0, 300);
}

router.get("/estimates/search", async (req, res) => {
  // const q = (req.query.q as string || "").trim();
  // Estimate numbers have no spaces, so "es 241762" searches as "es241762".
  const q = (req.query.q as string || "").replace(/\s+/g, "");
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
      ccat: string | null; ccatname: string | null; ecat: string | null; ecatname: string | null;
    }>(`
      SELECT
        t.id,
        t.tranid,
        BUILTIN.DF(t.entity) AS entityname,
        BUILTIN.DF(t.status) AS status,
        t.trandate,
        t.total,
        c.category AS ccat, BUILTIN.DF(c.category) AS ccatname,
        t.custbody_customer_category AS ecat, BUILTIN.DF(t.custbody_customer_category) AS ecatname
      FROM Estimate t
      LEFT JOIN customer c ON c.id = t.entity
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
      // The push prices special orders by this (the customer's category, else the estimate's), so the page can
      // warn when a line is shown at the other price.
      customerCategoryId: row.ccat != null ? String(row.ccat) : row.ecat != null ? String(row.ecat) : "",
      customerCategory: (row.ccat != null ? row.ccatname : row.ecatname) ?? "",
    }));

    return res.json({ estimates });
  } catch (err: any) {
    logger.error({ err }, "Failed to search estimates");
    // NetSuite still busy after the 429 retries: say so, so staff just retry.
    if (/ 429 /.test(String(err?.message))) {
      return res.status(503).json({ error: "NetSuite is busy right now. Wait a few seconds and search again." });
    }
    return res.status(500).json({ error: "Failed to search estimates" });
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
      entity?: { id: string };
      custbody_customer_category?: { id: string };
      location?: { id: string };
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
    const hasSpecialOrders = goodItems.some(item => item.specialOrder);
    const productLines = hasSpecialOrders
      ? await getSpecialOrderProductLines(true) : [];
    // Price special orders the way NetSuite's estimate client does (see specialOrderLine).
    const pricing = hasSpecialOrders
      ? await getSpecialOrderPricing(goodItems.filter(item => item.specialOrder).map(item => item.netsuiteId))
      : new Map();
    let customerCategory: string | null = null;
    if (hasSpecialOrders && existing.entity?.id) {
      const customer = await executeSuiteQL<{ category: string | null }>(
        `SELECT category FROM customer WHERE id = ${positiveId(String(existing.entity.id))}`
      );
      customerCategory = customer.items[0]?.category != null ? String(customer.items[0].category) : null;
    }
    const pricingContext = {
      customerCategory: customerCategory ?? existing.custbody_customer_category?.id ?? null,
      estimateCategory: existing.custbody_customer_category?.id ?? null,
      location: existing.location?.id ?? null,
    };
    const typesByLine = new Map<string, Awaited<ReturnType<typeof getSpecialOrderTypes>>>();
    const newLines = [];
    const specialOrders: Array<{
      index: number; netsuiteId: string; quantity: number; details: NonNullable<(typeof goodItems)[number]["specialOrder"]>;
      type: Awaited<ReturnType<typeof getSpecialOrderTypes>>[number]; rate: number; amount: number;
    }> = [];
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
      const itemPricing = pricing.get(item.netsuiteId);
      if (!itemPricing) {
        throw new SpecialOrderValidationError("This special-order item has no product line pricing in NetSuite");
      }
      const line = specialOrderLine(item.netsuiteId, item.quantity, details, productLine, type, itemPricing, pricingContext);
      specialOrders.push({
        index: newLines.length, netsuiteId: item.netsuiteId, quantity: item.quantity, details, type, rate: line.rate, amount: line.amount,
      });
      newLines.push(line);
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

    if (specialOrders.length > 0) try {
      // Type, Model, Coll/Desc and Color are item options, which REST only takes through each line's
      // `options` string. Read the lines just added, fill NetSuite's own option template, write it back.
      const existingLineIds = new Set((existing.item?.items ?? []).map(line => String(line.line)));
      const after = await netsuiteRequest<{ items: Array<{ line: number; item: { id: string }; options?: string }> }>(
        `/estimate/${estimateId}/item?expandSubResources=true`
      );
      const added = after.items.filter(line => !existingLineIds.has(String(line.line)));
      const optionUpdates = specialOrders.map(so => {
        const line = added[so.index];
        if (!line || String(line.item.id) !== so.netsuiteId || typeof line.options !== "string") {
          throw new Error(`Special-order line for item ${so.netsuiteId} was not found on the estimate after adding it`);
        }
        return { line: line.line, options: fillSpecialOrderOptions(line.options, so.details, so.type) };
      });
      await netsuiteRequest(`/estimate/${estimateId}`, "PATCH", { item: { items: optionUpdates } });

      // NetSuite accepts an options string it cannot parse without an error, so confirm the values stored.
      const stored = await executeSuiteQL<{ id: string; type: string | null; model: string | null }>(`
        SELECT id, custcol_specord_type AS type, custcol_specord_model AS model
        FROM transactionline
        WHERE transaction = ${estimateId} AND id IN (${optionUpdates.map(u => positiveId(String(u.line))).join(",")})
      `);
      const missing = optionUpdates.filter(u => !stored.items.some(row =>
        String(row.id) === String(u.line) && row.type != null && row.model != null));
      if (missing.length > 0) {
        throw new Error(`Special-order Type/Model did not save on estimate line(s) ${missing.map(u => u.line).join(", ")}`);
      }
    } catch (err: any) {
      // The lines are already on the estimate, so a retry would duplicate them.
      logger.error({ err, estimateId }, "Added items but could not save special-order options");
      return res.status(502).json({
        error: `The items were added to ${existing.tranId}, but the special-order Type, Model, Description and Color did not save. ` +
          "Fill them in on the estimate in NetSuite; do not push these items again.",
        detail: err?.message ?? "Unknown error",
      });
    }

    logger.info(
      { estimateId, tranId: existing.tranId, newItemCount: goodItems.length, skipped: invalidIds },
      "Added items to estimate"
    );

    const actionId = estimateActionId();
    const analyticsRecorded = await recordEstimatePush(actionId, {
      employeeId: res.locals.employeeId,
      sessionId: estimateSessionId(parsed.data.analyticsSessionId, bearerToken(req)!),
      path: "/list",
      userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
      metadata: {
        estimateId,
        tranId: existing.tranId,
        itemCount: goodItems.reduce((sum, item) => sum + item.quantity, 0),
        lineCount: goodItems.length,
        // Keep explicit provenance when moving the success event off the browser.
        // Derive product-line membership from the validated special-order details;
        // never infer missing visit/pick links from names, sessions or recency.
        specialOrderLines: goodItems.filter(item => item.specialOrder).map(item => ({
          productLineId: item.specialOrder!.productLineId,
          productLineName: item.specialOrder!.productLineName,
          quantity: item.quantity,
          vendorDomain: vendorDomain(item.analyticsVendorPick?.vendorDomain),
          pickId: trackingId(item.analyticsVendorPick?.pickId),
          visitId: trackingId(item.analyticsVendorPick?.visitId),
        })),
        // Informational displayed quote value, not the NetSuite selling price.
        // Missing prices on legacy clients are unknown, not a zero-dollar push.
        totalValue: goodItems.every(item => item.analyticsUnitPrice != null)
          ? goodItems.reduce((sum, item) => sum + item.analyticsUnitPrice! * item.quantity, 0) : null,
      },
    });

    return res.json({
      success: true,
      actionId,
      analyticsRecorded,
      estimateId,
      tranId: existing.tranId,
      itemsAdded: goodItems.length,
      skippedNetsuiteIds: invalidIds,
      specialOrderLines: specialOrders.map(so => ({
        // Was: model: so.details.model.trim() (an order-form Type writes PER_ORDER_FORM_TEXT instead)
        netsuiteId: so.netsuiteId, model: specialOrderSpecs(so.details, so.type).model, quantity: so.quantity,
        listPrice: so.details.listPrice, rate: so.rate, amount: so.amount,
      })),
    });
  } catch (err: any) {
    if (err instanceof SpecialOrderValidationError) {
      return res.status(400).json({ error: err.message });
    }
    logger.error({ err, estimateId }, "Failed to add items to estimate");
    // Everything in this try runs before or as the add itself, so on a 429 nothing was added.
    if (/ 429 /.test(String(err?.message))) {
      return res.status(503).json({
        error: "NetSuite is busy right now, so nothing was added. Wait a few seconds and push again.",
        detail: err?.message ?? "Unknown error",
      });
    }
    return res.status(500).json({
      // 2026-11-03: say why, instead of only "Failed to add items to estimate".
      error: `Failed to add items to estimate: ${netsuiteReason(err)}`,
      detail: err?.message ?? "Unknown error",
    });
  }
});

export default router;
