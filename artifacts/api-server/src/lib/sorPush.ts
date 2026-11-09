import { executeSuiteQL, fetchNetSuite, getAccessToken } from "./netsuite";
import { appBaseUrl } from "./estimateRefresh";
import { positiveId } from "./specialOrders";

/*
 * Push Quote List items onto a Sales Order Revision (SOR), 2026-11-09 (Gib: "We'd like for the CPS to also be able
 * to add items to SORs").
 *
 * A rep's add on the SOR workbench's Add step creates one customrecord_soritem row per line (Add action, Pending
 * status). Apply later copies Approved rows onto the Sales Order; a row that is not Pending is never approved, so
 * it would be left off silently. The workbench prices catalog items from the customer's price level (group items
 * from their Retail / CRD group selling price) and special orders with the product line multipliers, exactly as
 * the estimate push does. These helpers build the same rows, and refreshSor asks the workbench to recalculate the
 * revision afterwards (the opt-in cpsrecalc=T call), as a rep's Draft save does.
 */

// customlist_cor_statuses, as the workbench reads it (sor_workbench_suitelet.js STATUS).
export const SOR_STATUS = { DRAFT: "1", SUBMITTED: "2", APPLIED: "3", VOIDED: "5", CHECKPO: "6", APPROVED: "7" } as const;
const NOT_DRAFT_WORDS: Record<string, string> = {
  "2": "has been submitted",
  "3": "has already been applied to the order",
  "5": "was cancelled",
  "6": "is waiting on a PO check",
  "7": "has been approved",
};

/*
 * Consumers Confirm signing (customrecord_sign_request.custrecord_sign_req_srr). A link that is out (Sent / Opened)
 * or signed would no longer match the revision after new lines, so the push is refused while one is open. One switch.
 * Was: "Gib's decision 11/9 is pending; this is the recommended default."
 * Decided 11/9 (Gib, on a printed Draft: "Allow, with warning"): Draft not printed = allowed; Draft printed = allowed
 * with the reprint-and-sign-again warning; Consumers Confirm link open = refused; signed = refused; Submitted / Check
 * PO / Approved / Applied / Voided = refused with the status named. This is the rule table below, unchanged.
 */
export const BLOCK_WHILE_OUT_FOR_SIGNATURE = true;
const OPEN_SIGNING = ["sent", "opened"];
const CLOSED_SIGNING = ["cancelled", "cancelled (replaced)", "expired"];

export interface SorSummary {
  id: string;
  number: string;
  status: string;
  statusText: string;
  soId: string;
  soTranId: string;
  customerName: string;
  /** The Sales Order's custbody_customer_category: what the SOR's special-order popup prices by ("1" = Retail). */
  customerCategoryId: string | null;
  customerCategory: string | null;
  created: string | null;
  lastPrinted: string | null;
  /** The newest signing request's status that is not cancelled or expired, lower case, or null. */
  signing: string | null;
  newTotal: number | null;
}

export interface SorPushVerdict {
  /** Why the push is refused, said for staff, or null when it may go ahead. */
  blocked: string | null;
  /** Something staff should know after pushing (reprint and sign again), or null. */
  warning: string | null;
}

export function sorPushVerdict(sor: Pick<SorSummary, "number" | "status" | "lastPrinted" | "signing">): SorPushVerdict {
  const name = sor.number || "This revision";
  const status = String(sor.status || SOR_STATUS.DRAFT); // the workbench treats a blank status as Draft
  if (status !== SOR_STATUS.DRAFT) {
    const words = NOT_DRAFT_WORDS[status] ?? "is no longer a Draft";
    return { blocked: `${name} ${words}, so it can't take new items. Only a Draft revision can; start a new revision on the order.`, warning: null };
  }
  const signing = (sor.signing ?? "").toLowerCase();
  if (signing === "signed") {
    return { blocked: `${name} is signed in Consumers Confirm, so it can't take new items. Start a new revision on the order.`, warning: null };
  }
  if (BLOCK_WHILE_OUT_FOR_SIGNATURE && OPEN_SIGNING.includes(signing)) {
    return { blocked: `${name} is out for signature in Consumers Confirm. Cancel that link on the order's Signatures tab first, then push again.`, warning: null };
  }
  if (sor.lastPrinted || signing) {
    return {
      blocked: null,
      warning: `${name} was printed${sor.lastPrinted ? ` on ${sor.lastPrinted}` : ""}. Reprint it and have it signed again before Update Sales Order.`,
    };
  }
  return { blocked: null, warning: null };
}

/** "SOR230", "sor 230", "230" -> SOR number digits; "SO714882", "714882" -> order digits. Both kept for the search. */
export function sorQueryDigits(raw: string): string | null {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const m = s.match(/^(?:SOR|SO)?#?(\d{1,9})$/);
  return m ? m[1] : null;
}

const sql = (value: string) => value.replace(/'/g, "''");

const SOR_COLUMNS = `
  s.id, s.custrecord_sor_status AS status, BUILTIN.DF(s.custrecord_sor_status) AS statustext,
  s.custrecord_sor_salesorder AS soid, t.tranid AS sotranid, BUILTIN.DF(t.entity) AS customer,
  t.custbody_customer_category AS cat, BUILTIN.DF(t.custbody_customer_category) AS catname,
  s.created, s.custrecord_sor_last_printed AS printed, s.custrecord_sor_new_total AS newtotal`;

interface SorRowSql {
  id: string; status: string | null; statustext: string | null; soid: string; sotranid: string | null;
  customer: string | null; cat: string | null; catname: string | null; created: string | null; printed: string | null;
  newtotal: string | null;
}

async function signingBySor(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const rows = await executeSuiteQL<{ srr: string; status: string | null }>(`
    SELECT custrecord_sign_req_srr AS srr, custrecord_sign_req_status AS status
    FROM customrecord_sign_request
    WHERE custrecord_sign_req_srr IN (${ids.map(positiveId).join(",")}) AND isinactive = 'F'
    ORDER BY id DESC
  `);
  for (const row of rows.items) {
    const status = String(row.status ?? "").toLowerCase();
    const key = String(row.srr);
    if (!status || CLOSED_SIGNING.includes(status) || out.has(key)) continue; // newest live request wins
    out.set(key, status);
  }
  return out;
}

function toSummary(row: SorRowSql, signing: Map<string, string>): SorSummary {
  return {
    id: String(row.id),
    // PROD custrecord_sor_number is "SOR" + the id on every revision (179 of 179, 11/9); the sandbox has no such field.
    number: `SOR${row.id}`,
    status: String(row.status ?? SOR_STATUS.DRAFT),
    statusText: row.statustext ?? "",
    soId: String(row.soid),
    soTranId: row.sotranid ?? "",
    customerName: row.customer ?? "",
    customerCategoryId: row.cat != null ? String(row.cat) : null,
    customerCategory: row.catname ?? null,
    created: row.created,
    lastPrinted: row.printed,
    signing: signing.get(String(row.id)) ?? null,
    newTotal: row.newtotal != null ? Number(row.newtotal) : null,
  };
}

/** Revisions whose SOR number or Sales Order number contains the digits; Drafts first, newest first. */
export async function searchSors(digits: string): Promise<SorSummary[]> {
  const d = sql(digits);
  const result = await executeSuiteQL<SorRowSql>(`
    SELECT ${SOR_COLUMNS}
    FROM customrecord_sor s
    INNER JOIN transaction t ON t.id = s.custrecord_sor_salesorder
    WHERE s.isinactive = 'F' AND (TO_CHAR(s.id) LIKE '${d}%' OR t.tranid LIKE '%${d}%')
    ORDER BY CASE WHEN s.custrecord_sor_status = 1 THEN 0 ELSE 1 END, s.id DESC
  `);
  const rows = result.items.slice(0, 25);
  const signing = await signingBySor(rows.map(r => String(r.id)));
  return rows.map(r => toSummary(r, signing));
}

export interface SorPushContext extends SorSummary {
  customerId: string | null;
  /** The customer's price level (the workbench's custpage_customer_pricelevel; "1" when blank). */
  priceLevel: string;
  /** The customer record's category (group selling price: "1" Retail, "2" CRD). */
  customerRecordCategory: string | null;
  existingRows: number;
}

export async function loadSorForPush(sorId: string): Promise<SorPushContext | null> {
  const id = positiveId(sorId);
  const result = await executeSuiteQL<SorRowSql & { customerid: string | null; pricelevel: string | null; custcat: string | null }>(`
    SELECT ${SOR_COLUMNS}, t.entity AS customerid, c.pricelevel, c.category AS custcat
    FROM customrecord_sor s
    INNER JOIN transaction t ON t.id = s.custrecord_sor_salesorder
    LEFT JOIN customer c ON c.id = t.entity
    WHERE s.id = ${id}
  `);
  const row = result.items[0];
  if (!row) return null;
  const [signing, count] = await Promise.all([
    signingBySor([id]),
    executeSuiteQL<{ n: string }>(`SELECT COUNT(*) AS n FROM customrecord_soritem WHERE custrecord_soritem_sor = ${id}`),
  ]);
  return {
    ...toSummary(row, signing),
    customerId: row.customerid != null ? String(row.customerid) : null,
    priceLevel: row.pricelevel ? String(row.pricelevel) : "1",
    customerRecordCategory: row.custcat != null ? String(row.custcat) : null,
    existingRows: Number(count.items[0]?.n ?? 0),
  };
}

export interface CatalogItemFacts {
  id: string;
  itemid: string;
  itemtype: string;
  stockCode: string | null;
  taxable: boolean;
  description: string;
  groupRetail: number | null;
  groupCrd: number | null;
  /** pricing rows: price level id -> unit price (quantity 1). */
  prices: Map<string, number>;
}

const cents = (value: number) => Math.round(value * 100) / 100;
const num = (value: unknown) => {
  const n = parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : null;
};

export async function getCatalogItemFacts(itemIds: string[]): Promise<Map<string, CatalogItemFacts>> {
  const ids = [...new Set(itemIds.map(positiveId))];
  const facts = new Map<string, CatalogItemFacts>();
  if (ids.length === 0) return facts;
  const [items, prices] = await Promise.all([
    executeSuiteQL<{
      id: string; itemid: string; itemtype: string; isc: string | null; istaxable: string | null; description: string | null;
      gr: string | null; gc: string | null;
    }>(`
      SELECT i.id, i.itemid, i.itemtype, i.custitem_stock_code AS isc, i.istaxable, i.description,
        i.custitem_groupsellingprice_retail AS gr, i.custitem_groupsellingprice_crd AS gc
      FROM item i WHERE i.id IN (${ids.join(",")})
    `),
    executeSuiteQL<{ item: string; pricelevel: string; quantity: string | null; unitprice: string | null }>(`
      SELECT item, pricelevel, quantity, unitprice FROM pricing WHERE item IN (${ids.join(",")}) ORDER BY item, pricelevel, quantity
    `),
  ]);
  for (const row of items.items) {
    facts.set(String(row.id), {
      id: String(row.id), itemid: row.itemid, itemtype: row.itemtype,
      stockCode: row.isc != null ? String(row.isc) : null,
      taxable: row.istaxable === "T",
      description: row.description ?? "",
      groupRetail: num(row.gr), groupCrd: num(row.gc),
      prices: new Map(),
    });
  }
  for (const row of prices.items) {
    const f = facts.get(String(row.item));
    const price = num(row.unitprice);
    // First (lowest-quantity) row per level: quantity pricing is unused in this account.
    if (f && price != null && !f.prices.has(String(row.pricelevel))) f.prices.set(String(row.pricelevel), price);
  }
  return facts;
}

/** Item types a rep never adds as a product line. */
export const NOT_PUSHABLE_TYPES = ["Discount", "Description", "Subtotal", "Markup", "Payment"];

/*
 * The workbench's add-item pricing (sor_workbench_assistant_client.js sourceAddItem): list rate = the base price
 * (price level 1); rate = the customer's price level, a group item's Retail (category 1) or CRD (category 2) group
 * selling price, otherwise the base price. Rounded to the cent, as the grid's currency column stores it.
 */
export function catalogRate(item: CatalogItemFacts, priceLevel: string, customerRecordCategory: string | null) {
  const base = item.prices.get("1") ?? 0;
  let rate = base;
  if (item.itemtype === "Group") {
    const group = customerRecordCategory === "1" ? item.groupRetail : customerRecordCategory === "2" ? item.groupCrd : null;
    if (group != null && group > 0) rate = group;
  } else {
    const level = item.prices.get(priceLevel || "1");
    if (level != null && level > 0) rate = level;
  }
  return { listRate: cents(base), rate: cents(rate) };
}

/** Counters (stock code 4) are never taxable on a revision (the workbench's isCounterRow). */
export function sorTaxable(stockCode: string | null, itemTaxable: boolean): boolean {
  return String(stockCode ?? "") === "4" ? false : itemTaxable;
}

/** The SOR special-order popup's description (cor_getOptions.js updateSRRItem). */
export function sorSpecialOrderDesc(spItemId: string, typeName: string, style: string, qty: number, model: string, color: string): string {
  return `${spItemId}\nType: ${typeName}\nStyle: ${style}\nQty: ${qty}\nModel: ${model}\nColor: ${color}\n`;
}

export interface SorRowInput {
  sorId: string;
  itemId: string;
  itemtype: string;
  stockCode: string | null;
  taxable: boolean;
  description: string;
  quantity: number;
  listRate: number;
  rate: number;
  specialOrder?: { typeId: string; model: string; style: string; color: string; perOrderForm: boolean; lineSeqNum: number };
}

/** The REST body of one customrecord_soritem Add row, as the Add step / special-order popup write it. */
export function sorItemRow(input: SorRowInput): Record<string, unknown> {
  const row: Record<string, unknown> = {
    custrecord_soritem_sor: { id: positiveId(input.sorId) },
    custrecord_soritem_action: { id: "1" },  // ADD
    custrecord_soritem_status: { id: "1" },  // PENDING: apply approves Pending rows, then posts Approved ones
    custrecord_soritem_item: { id: positiveId(input.itemId) },
    custrecord_soritem_itemtype: input.itemtype || "InvtPart",
    custrecord_soritem_desc: input.description,
    custrecord_soritem_qty: input.quantity,
    custrecord_soritem_listrate: input.listRate,
    custrecord_soritem_rate: input.rate,
    custrecord_soritem_amt: cents(input.rate * input.quantity),
    custrecord_soritem_istaxable: input.taxable,
    custrecord_soritem_takeitem: false,
    custrecord_soritem_getoptions: false,
  };
  if (input.stockCode != null && /^\d+$/.test(input.stockCode)) row.custrecord_soritem_isc = Number(input.stockCode);
  if (input.specialOrder) {
    const so = input.specialOrder;
    Object.assign(row, {
      custrecord_soritem_option_type: { id: positiveId(so.typeId) },
      custrecord_soritem_option_model: so.model,
      custrecord_soritem_option_style: so.style,
      custrecord_soritem_option_color: so.color,
      custrecord_soritem_option_asperorderform: { id: so.perOrderForm ? "1" : "2" },
      custrecord_soritem_lineseqnum: so.lineSeqNum,
    });
  }
  return row;
}

export interface SorRefreshResult {
  ok: boolean;
  status: string | null;
  newTotal: number | null;
  deltaTotal: number | null;
  error: string | null;
}

/** Asks the SOR workbench to recalculate a Draft revision (cpsrecalc=T), as a rep's Draft save does. */
export async function refreshSor(
  sorId: string,
  deps: { fetch: typeof fetchNetSuite; token: () => Promise<string> } = { fetch: fetchNetSuite, token: getAccessToken },
): Promise<SorRefreshResult> {
  const url = `${appBaseUrl()}/app/site/hosting/scriptlet.nl?script=customscript_sor_workbench&deploy=customdeploy_sor_workbench` +
    `&srr=${positiveId(sorId)}&cpsrecalc=T`;
  const response = await deps.fetch(url, { headers: { Authorization: `Bearer ${await deps.token()}` }, redirect: "manual" });
  const text = await response.text().catch(() => "");
  if (response.status !== 200) {
    throw new Error(`The SOR workbench answered HTTP ${response.status}${response.headers.get("location") ? " (sign-in redirect)" : ""}`);
  }
  let body: any;
  try { body = JSON.parse(text); } catch { throw new Error("The SOR workbench did not answer with its recalculation result"); }
  return {
    ok: body?.ok === true,
    status: body?.status != null ? String(body.status) : null,
    newTotal: num(body?.newTotal),
    deltaTotal: num(body?.deltaTotal),
    error: typeof body?.error === "string" ? body.error : null,
  };
}
