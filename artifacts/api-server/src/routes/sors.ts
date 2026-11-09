import { Router, type IRouter } from "express";
import { executeSuiteQL, isNetSuiteConfigured, netsuiteCreate, netsuiteRequest } from "../lib/netsuite";
import { logger } from "../lib/logger";
import {
  EstimateItemsSchema, getSpecialOrderPricing, getSpecialOrderProductLines, getSpecialOrderTypes, positiveId,
  specialOrderRate, specialOrderSpecs, SpecialOrderValidationError,
} from "../lib/specialOrders";
import { requireEmployee } from "../lib/session";
import {
  catalogRate, getCatalogItemFacts, loadSorForPush, NOT_PUSHABLE_TYPES, refreshSor, searchSors, sorItemRow,
  sorPushVerdict, sorQueryDigits, sorSpecialOrderDesc, sorTaxable, type SorRowInput,
} from "../lib/sorPush";

/*
 * 2026-11-09 (Gib: "We'd like for the CPS to also be able to add items to SORs"). The Quote List can push its items
 * onto a Draft Sales Order Revision as well as an estimate. Same items, prices and special-order math as the estimate
 * push (lib/sorPush.ts explains the SOR rows); the revision is recalculated by its own workbench afterwards
 * (POST /sors/:id/refresh, called by the page right after a push, like the estimate's discount refresh).
 */
const router: IRouter = Router();
// Revisions are NetSuite customer data and writes: signed-in staff only.
router.use("/sors", requireEmployee);

const MIN_DIGITS = 3;

router.get("/sors/search", async (req, res) => {
  if (!isNetSuiteConfigured()) return res.status(503).json({ error: "NetSuite not configured" });
  const digits = sorQueryDigits(String(req.query.q ?? ""));
  if (!digits || digits.length < MIN_DIGITS) {
    return res.status(400).json({ error: `Type at least ${MIN_DIGITS} digits of the SOR or Sales Order number.` });
  }
  try {
    const sors = await searchSors(digits);
    return res.json({ sors: sors.map(sor => ({ ...sor, ...sorPushVerdict(sor) })) });
  } catch (err: any) {
    logger.error({ err, q: req.query.q }, "SOR search failed");
    if (/ 429 /.test(String(err?.message))) {
      return res.status(503).json({ error: "NetSuite is busy right now. Wait a few seconds and search again." });
    }
    return res.status(500).json({ error: "Could not search revisions in NetSuite." });
  }
});

// One push per revision at a time on this server: a double click must not add the lines twice.
const pushesRunning = new Set<string>();

router.post("/sors/:sorId/add-items", async (req, res) => {
  const sorId = String(req.params.sorId ?? "");
  if (!/^[1-9]\d{0,9}$/.test(sorId)) return res.status(400).json({ error: "Invalid revision ID" });
  const parsed = EstimateItemsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid quote items", details: parsed.error.issues });
  if (!isNetSuiteConfigured()) return res.status(503).json({ error: "NetSuite not configured" });
  if (pushesRunning.has(sorId)) {
    return res.status(409).json({ error: "A push to this revision is still running. Wait for it to finish." });
  }
  pushesRunning.add(sorId);
  const created: string[] = [];
  let sorNumber = `SOR${sorId}`;
  try {
    const sor = await loadSorForPush(sorId);
    if (!sor) return res.status(404).json({ error: "That revision was not found in NetSuite." });
    sorNumber = sor.number;
    const verdict = sorPushVerdict(sor);
    if (verdict.blocked) return res.status(409).json({ error: verdict.blocked });

    const items = parsed.data.items;
    const distinctIds = Array.from(new Set(items.map(i => positiveId(i.netsuiteId))));
    const check = await executeSuiteQL<{ id: string }>(
      `SELECT id FROM item WHERE id IN (${distinctIds.join(",")}) AND isinactive = 'F'`,
    );
    const validIds = new Set(check.items.map(r => String(r.id)));
    const invalidIds = distinctIds.filter(id => !validIds.has(id));
    const goodItems = items.filter(i => validIds.has(String(i.netsuiteId)));
    if (goodItems.length === 0) {
      return res.status(400).json({
        error: "None of the items can be added: they no longer exist in NetSuite.",
        invalidNetsuiteIds: invalidIds,
      });
    }

    const facts = await getCatalogItemFacts(goodItems.map(i => i.netsuiteId));
    const hasSpecialOrders = goodItems.some(i => i.specialOrder);
    const productLines = hasSpecialOrders ? await getSpecialOrderProductLines(true) : [];
    const spPricing = hasSpecialOrders
      ? await getSpecialOrderPricing(goodItems.filter(i => i.specialOrder).map(i => i.netsuiteId))
      : new Map();
    const typesByLine = new Map<string, Awaited<ReturnType<typeof getSpecialOrderTypes>>>();

    // Build every row first: nothing is written until all lines are valid.
    let lineSeq = sor.existingRows + 1000;
    const rows: Array<{ input: SorRowInput; netsuiteId: string; model?: string }> = [];
    for (const item of goodItems) {
      const f = facts.get(String(item.netsuiteId));
      if (!f) throw new SpecialOrderValidationError(`Item ${item.netsuiteId} was not found in NetSuite`);
      if (NOT_PUSHABLE_TYPES.includes(f.itemtype)) {
        throw new SpecialOrderValidationError(`${f.itemid} is a ${f.itemtype} item and can't be added to a revision`);
      }
      if (!item.specialOrder) {
        if (f.itemid.startsWith("SP-")) {
          throw new SpecialOrderValidationError("Special-order items require their product line, Type and specifications");
        }
        const { listRate, rate } = catalogRate(f, sor.priceLevel, sor.customerRecordCategory);
        rows.push({
          netsuiteId: f.id,
          input: {
            sorId, itemId: f.id, itemtype: f.itemtype, stockCode: f.stockCode, taxable: sorTaxable(f.stockCode, f.taxable),
            description: f.description, quantity: item.quantity, listRate, rate,
          },
        });
        continue;
      }
      const details = item.specialOrder;
      const productLine = productLines.find(line => line.id === details.productLineId && line.netsuiteItemId === item.netsuiteId);
      if (!productLine) throw new SpecialOrderValidationError("This special-order product line/item is no longer available");
      let types = typesByLine.get(productLine.id);
      if (!types) {
        types = await getSpecialOrderTypes(productLine.id, true);
        typesByLine.set(productLine.id, types);
      }
      const type = types.find(t => t.id === details.typeId);
      if (!type) throw new SpecialOrderValidationError("The selected special-order Type does not belong to this product line or is inactive");
      const pricing = spPricing.get(String(item.netsuiteId));
      if (!pricing) throw new SpecialOrderValidationError("This special-order item has no product line pricing in NetSuite");
      const { perOrderForm, model, description, color } = specialOrderSpecs(details, type);
      if (![model, description, color].every(Boolean)) {
        throw new SpecialOrderValidationError("Model, Collection / Description and Color are required");
      }
      // The SOR's special-order popup prices by the Sales Order's customer category (cor_getOptions.js).
      const rate = specialOrderRate(details.listPrice, pricing, sor.customerCategoryId);
      lineSeq += 1;
      rows.push({
        netsuiteId: f.id,
        model,
        input: {
          sorId, itemId: f.id, itemtype: "InvtPart", stockCode: f.stockCode, taxable: sorTaxable(f.stockCode, f.taxable),
          description: sorSpecialOrderDesc(f.itemid, type.name, description, item.quantity, model, color),
          quantity: item.quantity, listRate: details.listPrice, rate,
          specialOrder: { typeId: type.id, model, style: description, color, perOrderForm, lineSeqNum: lineSeq },
        },
      });
    }

    // All or nothing: a failed row takes the ones already written back off, so a retry never doubles a line.
    try {
      for (const row of rows) {
        const id = await netsuiteCreate("/customrecord_soritem", sorItemRow(row.input));
        if (!id) throw new Error("NetSuite did not return the new revision line's id");
        created.push(id);
      }
    } catch (err) {
      const left: string[] = [];
      for (const id of created) {
        try { await netsuiteRequest(`/customrecord_soritem/${id}`, "DELETE"); } catch { left.push(id); }
      }
      if (left.length > 0) {
        logger.error({ err, sorId, left }, "SOR push failed and some lines could not be taken back off");
        return res.status(502).json({
          error: `Only part of the push reached ${sorNumber}, and ${left.length} line${left.length === 1 ? "" : "s"} could not be taken back off. ` +
            "Open the revision in NetSuite and check its Add step before pushing again.",
          detail: (err as any)?.message ?? "Unknown error",
        });
      }
      throw err;
    }

    logger.info({ sorId, sorNumber, rows: created.length, skipped: invalidIds }, "Added items to SOR");
    return res.json({
      success: true,
      sorId,
      sorNumber,
      soTranId: sor.soTranId,
      itemsAdded: created.length,
      skippedNetsuiteIds: invalidIds,
      warning: verdict.warning,
      specialOrderLines: rows.filter(r => r.input.specialOrder).map(r => ({
        netsuiteId: r.netsuiteId, model: r.model ?? "", quantity: r.input.quantity, listPrice: r.input.listRate,
        rate: r.input.rate, amount: Math.round(r.input.rate * r.input.quantity * 100) / 100,
      })),
    });
  } catch (err: any) {
    if (err instanceof SpecialOrderValidationError) return res.status(400).json({ error: err.message });
    logger.error({ err, sorId }, "Failed to add items to SOR");
    if (/ 429 /.test(String(err?.message))) {
      return res.status(503).json({ error: `NetSuite is busy right now, so nothing was added to ${sorNumber}. Wait a few seconds and push again.` });
    }
    return res.status(500).json({ error: `Nothing was added to ${sorNumber}: ${String(err?.message ?? "Unknown error").slice(0, 300)}` });
  } finally {
    pushesRunning.delete(sorId);
  }
});

const refreshesRunning = new Map<string, ReturnType<typeof refreshSor>>();

router.post("/sors/:sorId/refresh", async (req, res) => {
  const sorId = String(req.params.sorId ?? "");
  if (!/^[1-9]\d{0,9}$/.test(sorId)) return res.status(400).json({ error: "Invalid revision ID" });
  if (!isNetSuiteConfigured()) return res.status(503).json({ error: "NetSuite not configured" });
  let running = refreshesRunning.get(sorId);
  if (!running) {
    running = refreshSor(sorId).finally(() => refreshesRunning.delete(sorId));
    refreshesRunning.set(sorId, running);
  }
  try {
    const result = await running;
    logger.info({ sorId, ...result }, "Recalculated SOR after a push");
    return res.json(result);
  } catch (err: any) {
    logger.error({ err, sorId }, "Could not recalculate SOR");
    return res.status(502).json({ error: "NetSuite could not recalculate the revision.", detail: err?.message ?? "Unknown error" });
  }
});

export default router;
