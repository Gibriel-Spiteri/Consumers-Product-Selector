import type { SpecialOrderDetails, SpecialOrderProductLine, SpecialOrderType } from "@workspace/api-zod";
import { AddEstimateItemsBody } from "@workspace/api-zod";
import { executeSuiteQL } from "./netsuite";

type TypeRecord = SpecialOrderType & { classId: string | null };
const TTL = 5 * 60 * 1000;
let productLinesCache: { expires: number; data: SpecialOrderProductLine[] } | undefined;
const typesCache = new Map<string, { expires: number; data: TypeRecord[] }>();

export class SpecialOrderValidationError extends Error {}

// Orval currently emits z.number() for OpenAPI integers; enforce whole quantities explicitly.
export const EstimateItemsSchema = AddEstimateItemsBody.superRefine((value, ctx) => {
  value.items.forEach((item, index) => {
    if (!Number.isInteger(item.quantity)) {
      ctx.addIssue({ code: "custom", path: ["items", index, "quantity"], message: "Quantity must be a whole number" });
    }
  });
});

export function positiveId(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new SpecialOrderValidationError("Invalid NetSuite identifier");
  }
  return value;
}

export async function getSpecialOrderProductLines(fresh = false): Promise<SpecialOrderProductLine[]> {
  if (!fresh && productLinesCache && productLinesCache.expires > Date.now()) return productLinesCache.data;
  const result = await executeSuiteQL<{
    id: string; name: string; itemid: string; sku: string; costmult: string | null; retailmult: string | null; crdmult: string | null; categoryids: string | null;
  }>(`
    SELECT pl.id, pl.name, i.id AS itemid, i.itemid AS sku,
      pl.custrecord_pl_costinclfreightmult AS costmult, pl.custrecord_pl_price_mult_retail AS retailmult,
      pl.custrecord_pl_price_mult_crd AS crdmult,
      pl.custrecord_pl_prd_category AS categoryids
    FROM customrecord_pl pl
    INNER JOIN item i ON i.custitem_prodline = pl.id
    WHERE pl.isinactive = 'F' AND i.isinactive = 'F' AND i.itemid LIKE 'SP-%'
      AND UPPER(BUILTIN.DF(pl.custrecord_pl_type)) = 'INVENTORY'
      AND EXISTS (
        SELECT 1 FROM customrecord_specord_nondb_types st
        WHERE st.custrecord_specord_nondb_type_prodline = pl.id AND st.isinactive = 'F'
      )
    ORDER BY pl.name, i.itemid
  `);
  const categoryResult = await executeSuiteQL<{ id: string; name: string }>(
    "SELECT id, name FROM customlist_prd_category ORDER BY name"
  );
  const categoryNames = new Map(categoryResult.items.map(c => [String(c.id), c.name]));
  // Do not silently pick an arbitrary special-order item when a product line has several.
  const counts = new Map<string, number>();
  for (const row of result.items) counts.set(String(row.id), (counts.get(String(row.id)) ?? 0) + 1);
  const data = result.items.map(row => ({
    id: String(row.id),
    name: counts.get(String(row.id))! > 1 ? `${row.name} (${row.sku})` : row.name,
    netsuiteItemId: String(row.itemid),
    sku: row.sku,
    categories: String(row.categoryids ?? "").split(",").map(id => id.trim()).filter(Boolean).map(id => {
      const name = categoryNames.get(id);
      if (!name) throw new SpecialOrderValidationError(`Unknown product-line category ${id}`);
      return { id, name };
    }),
    // For the quote list's selling price; the push itself re-reads them (getSpecialOrderPricing).
    costMultiplier: multiplier(row.costmult),
    retailMultiplier: multiplier(row.retailmult),
    crdMultiplier: multiplier(row.crdmult),
  }));
  productLinesCache = { data, expires: Date.now() + TTL };
  return data;
}

export async function getSpecialOrderTypes(productLineId: string, fresh = false): Promise<TypeRecord[]> {
  const id = positiveId(productLineId);
  const cached = typesCache.get(id);
  if (!fresh && cached && cached.expires > Date.now()) return cached.data;
  const result = await executeSuiteQL<{
    id: string; name: string; classid: string | null; requiresattachment: string | null;
  }>(`
    SELECT id, name, custrecord_specord_nondb_type_class AS classid,
      BUILTIN.DF(custrecord_specord_nondb_type_reqattach) AS requiresattachment
    FROM customrecord_specord_nondb_types
    WHERE custrecord_specord_nondb_type_prodline = ${id} AND isinactive = 'F'
    ORDER BY name
  `);
  const data = result.items.map(row => ({
    id: String(row.id), name: row.name,
    classId: row.classid ? String(row.classid) : null,
    requiresAttachment: row.requiresattachment?.toLowerCase() === "yes",
  }));
  // Bound cache size even if many arbitrary IDs are requested.
  if (typesCache.size >= 500) typesCache.clear();
  typesCache.set(id, { data, expires: Date.now() + TTL });
  return data;
}

// Everything NetSuite itself reads when a special-order line is entered on an estimate: the product line
// multipliers for the price, plus the item's drop-ship and commission earn-rate fields.
export interface SpecialOrderPricing {
  costMult: number;
  retailMult: number;
  crdMult: number;
  dropShip: boolean;
  earnRate: { retail: string | null; crd: string | null; cdRetail: string | null; cdCrd: string | null };
}

// Estimate header values the NetSuite UI prices with. customerCategory is the customer record's category
// (salesorder.js re-reads it for the rate); estimateCategory is custbody_customer_category (earn rate).
export interface EstimatePricingContext {
  customerCategory: string | null;
  estimateCategory: string | null;
  location: string | null;
}

// salesorder.js reads multipliers with parseFloat(...) || 1, so blank or zero means 1.
const multiplier = (value: unknown) => parseFloat(String(value ?? "")) || 1;
const cents = (value: number) => Math.round(value * 100) / 100;
// NetSuite's Model / Coll/Desc / Color columns are Free-Form Text (single line, 300 characters).
const NS_TEXT_MAX = 300;
const cleanText = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();

export async function getSpecialOrderPricing(itemIds: string[]): Promise<Map<string, SpecialOrderPricing>> {
  const ids = [...new Set(itemIds.map(positiveId))];
  const pricing = new Map<string, SpecialOrderPricing>();
  if (ids.length === 0) return pricing;
  const result = await executeSuiteQL<{
    id: string; isdropshipitem: string | null; nsdropship: string | null;
    earnret: string | null; earncrd: string | null; earncdret: string | null; earncdcrd: string | null;
    costmult: string | null; retailmult: string | null; crdmult: string | null;
  }>(`
    SELECT i.id, i.isdropshipitem, i.custitem_ns_dropship AS nsdropship,
      i.custitem_earnrate_retdisplay AS earnret, i.custitem_earnrate_crddisplay AS earncrd,
      i.custitem_earnrate_cd_retail AS earncdret, i.custitem_earnrate_cd_crd AS earncdcrd,
      pl.custrecord_pl_costinclfreightmult AS costmult, pl.custrecord_pl_price_mult_retail AS retailmult,
      pl.custrecord_pl_price_mult_crd AS crdmult
    FROM item i
    INNER JOIN customrecord_pl pl ON pl.id = i.custitem_prodline
    WHERE i.id IN (${ids.join(",")})
  `);
  for (const row of result.items) {
    pricing.set(String(row.id), {
      costMult: multiplier(row.costmult),
      retailMult: multiplier(row.retailmult),
      crdMult: multiplier(row.crdmult),
      // The UI sets Is Drop Ship from the item's native flag (salesorder.js custbody_multisp), then
      // Estimate_BeforeSubmit ticks it when custitem_ns_dropship is set. That user event does not run for
      // REST saves, so apply both here.
      dropShip: row.isdropshipitem === "T" || row.nsdropship === "T",
      earnRate: { retail: row.earnret, crd: row.earncrd, cdRetail: row.earncdret, cdCrd: row.earncdcrd },
    });
  }
  return pricing;
}

// salesorder.js SalesOrder_FieldChanged (custcol_list_selling_rate), the client script on estimates and sales
// orders: Rate = ListRate * CostMultiplier * CustomerMultiplier, rounded to the cent. Customer category 1 is
// Retail; every other category uses the CRD multiplier. Keep the multiplication order so floats match.
export function specialOrderRate(listPrice: number, pricing: SpecialOrderPricing, customerCategory: string | null): number {
  if (!(listPrice > 0)) return 0;
  const customerMulti = customerCategory === "1" ? pricing.retailMult : pricing.crdMult;
  return cents(listPrice * pricing.costMult * customerMulti);
}

// library.js GetItemCommissionRates, which the estimate client's validateLine writes to custcol_item_earn_rate.
export function specialOrderEarnRate(pricing: SpecialOrderPricing, ctx: EstimatePricingContext): string | null {
  const cabinetDirect = ctx.location === "14";
  switch (ctx.estimateCategory) {
    case "1": case "3": case "4": // RETAIL, RFQ, REFERRAL
      return cabinetDirect ? pricing.earnRate.cdRetail : pricing.earnRate.retail;
    case "2": // CRD
      return cabinetDirect ? pricing.earnRate.cdCrd : pricing.earnRate.crd;
    default:
      return null;
  }
}

// A Type whose "Requires Attachment" is Yes takes an order form instead of typed specs. NetSuite's Item Options
// popup (itemoptions_client.js) ticks Per Order Form and locks the fields, and the estimate client
// (SalesOrder_ValidateLine) writes this text into Model, Coll/Desc and Color: every such line since 9/2026.
export const PER_ORDER_FORM_TEXT = "Per Attached Order Form";

export function specialOrderSpecs(details: SpecialOrderDetails, type: Pick<SpecialOrderType, "requiresAttachment">) {
  if (type.requiresAttachment) {
    return { perOrderForm: true, model: PER_ORDER_FORM_TEXT, description: PER_ORDER_FORM_TEXT, color: PER_ORDER_FORM_TEXT };
  }
  return {
    perOrderForm: false, model: cleanText(details.model), description: cleanText(details.description), color: cleanText(details.color),
  };
}

export function specialOrderLine(
  itemId: string,
  quantity: number,
  details: SpecialOrderDetails,
  productLine: SpecialOrderProductLine,
  type: TypeRecord,
  pricing: SpecialOrderPricing,
  ctx: EstimatePricingContext,
) {
  if (productLine.id !== details.productLineId || productLine.netsuiteItemId !== itemId || type.id !== details.typeId) {
    throw new SpecialOrderValidationError("The special-order item, product line and Type do not match");
  }
  // const model = cleanText(details.model), description = cleanText(details.description), color = cleanText(details.color);
  const { perOrderForm, model, description, color } = specialOrderSpecs(details, type);
  if (![model, description, color].every(Boolean)) {
    throw new SpecialOrderValidationError("Model, Collection / Description and Color are required");
  }
  if ([model, description, color].some(s => s.length > NS_TEXT_MAX)) {
    throw new SpecialOrderValidationError(`Model, Collection / Description and Color must each be ${NS_TEXT_MAX} characters or fewer`);
  }
  const rate = specialOrderRate(details.listPrice, pricing, ctx.customerCategory);
  const earnRate = specialOrderEarnRate(pricing, ctx);
  return {
    item: { id: itemId },
    quantity,
    rate,
    amount: cents(rate * quantity),
    custcol_list_selling_rate: details.listPrice,
    custcol_list_selling_amt: cents(details.listPrice * quantity),
    custcol_isdropship: pricing.dropShip,
    ...(earnRate ? { custcol_item_earn_rate: earnRate } : {}),
    // Per Order Form: Yes (1) for a Type that requires an attachment, otherwise No (2), as the Item Options popup sends it.
    custcol_specord_perorderform: { id: perOrderForm ? "1" : "2" },
    // The fields below are transaction item options. REST stores them blank when sent like this; the route
    // writes them through the line's `options` string (fillSpecialOrderOptions). Kept for readability.
    custcol_specord_prodline: { id: productLine.id },
    custcol_specord_type: { id: type.id },
    // 2026-11-03: no longer sent. The NetSuite UI never sets the Class option (blank on every SP line since
    // 2025, line class stays the item's 17), and the estimate client copies it into the line class on the next edit.
    // ...(type.classId ? { custcol_specord_class: { id: type.classId } } : {}),
    custcol_specord_model: model,
    custcol_specord_style: description,
    custcol_specord_color: color,
    // 2026-11-03: replaced by the rate/amount above. Leaving the rate to NetSuite's price level gave $0.00,
    // because every SP item's price levels are 0; NetSuite only prices SP lines in its client scripts.
    // List Price is not a selling rate. Leave NetSuite's price level/rate sourcing intact.
  };
}

// NetSuite's `options` line string: entries of FIELDID ^C mandatory ^C label ^C value [^C text], joined by ^D.
const OPTION_FIELD = "\u0003";
const OPTION_ENTRY = "\u0004";

// Fill the special-order item options into the template NetSuite generated for the line, so labels and the
// other options stay exactly as NetSuite set them.
export function fillSpecialOrderOptions(template: string, details: SpecialOrderDetails, type: SpecialOrderType): string {
  const specs = specialOrderSpecs(details, type);
  const values: Record<string, string[]> = {
    CUSTCOL_SPECORD_TYPE: [type.id, cleanText(type.name)],
    // CUSTCOL_SPECORD_MODEL: [cleanText(details.model)],
    // CUSTCOL_SPECORD_STYLE: [cleanText(details.description)],
    // CUSTCOL_SPECORD_COLOR: [cleanText(details.color)],
    CUSTCOL_SPECORD_MODEL: [specs.model],
    CUSTCOL_SPECORD_STYLE: [specs.description],
    CUSTCOL_SPECORD_COLOR: [specs.color],
    CUSTCOL_SPECORD_PERORDERFORM: specs.perOrderForm ? ["1", "Yes"] : ["2", "No"],
  };
  const optional = new Set(["CUSTCOL_SPECORD_PERORDERFORM"]);
  const filled = new Set<string>();
  const entries = template.split(OPTION_ENTRY).map(entry => {
    const parts = entry.split(OPTION_FIELD);
    const value = values[parts[0]];
    if (!value || parts.length < 3) return entry;
    filled.add(parts[0]);
    return [...parts.slice(0, 3), ...value].join(OPTION_FIELD);
  });
  const missing = Object.keys(values).filter(id => !filled.has(id) && !optional.has(id));
  if (missing.length > 0) {
    throw new Error(`NetSuite did not offer the special-order options ${missing.join(", ")} on this line`);
  }
  return entries.join(OPTION_ENTRY);
}
