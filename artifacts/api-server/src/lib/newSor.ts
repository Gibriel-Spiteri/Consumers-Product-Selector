import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { executeSuiteQL, fetchNetSuite, getAccessToken } from "./netsuite";
import { appBaseUrl } from "./estimateRefresh";
import { positiveId } from "./specialOrders";
import { openSorsByOrder, SOR_STATUS, sorPushVerdict, type SorPushVerdict, type SorSummary } from "./sorPush";

/*
 * New SOR (2026-11-12). Gib: "add 'New SOR' just like we have 'New Estimate' so they do not have to create and then
 * save a SOR just to be able to push their shopping cart to the SOR."
 *
 * The rep finds the Sales Order; the CPS starts a Draft revision on it exactly as the order's New Revision button
 * does (the SOR workbench's ?soid= GET, which runs createNewSRR: snapshot of the order, index, Draft status), records
 * the rep as the requester, then adds the Quote List lines the way the SOR push does and recalculates (cpsrecalc).
 *
 * Refused, with the reason, whenever NetSuite would not offer New Revision or the workbench would refuse it:
 *  - the order is not open (salesorder.js shows New Revision only for statuses A, B, D, E, F, G),
 *  - a revision is already open on it (one per order; a pushable Draft is offered instead),
 *  - a change order (COR) is pending verification, or discount codes are entered but not Applied (createNewSRR).
 * Lock Transaction does not block a revision in NetSuite (a revision is how a locked order changes), so not here either.
 */

export const OPEN_ORDER_STATUSES = ["A", "B", "D", "E", "F", "G"];

export type OfferedSor = SorSummary & SorPushVerdict;

export interface OrderForNewSor {
  id: string;
  /** The order's customer (2026-11-13: the one search box groups results by customer). */
  customerId?: string | null;
  tranId: string;
  status: string;
  statusText: string;
  customerName: string;
  customerCategoryId: string | null;
  customerCategory: string | null;
  /** The open revision on the order, if any, with its own push verdict. */
  openSor: OfferedSor | null;
  /** Why a new revision can't start, said for staff, or null. */
  blocked: string | null;
  /** The open Draft revision that can take the items instead, when that is why it is blocked. */
  offer: OfferedSor | null;
}

export interface OrderPricingContext {
  customerId: string | null;
  /** The customer's price level ("1" when blank), as the workbench's add step prices by it. */
  priceLevel: string;
  customerRecordCategory: string | null;
}

const statusWords = (text: string) => String(text || "").replace(/^Sales Order\s*:\s*/i, "").trim() || "not open";
// The SOR statuses as the Quote List's SOR panel names them (NetSuite's list calls Draft "PENDING SUBMISSION").
export const SOR_STATUS_NAMES: Record<string, string> = { "1": "Draft", "2": "Submitted", "3": "Processed", "5": "Cancelled", "6": "Check PO", "7": "Approved" };

export function newSorVerdict(o: {
  tranId: string; status: string; statusText: string; openSor: OfferedSor | null; pendingCor: boolean; pendingPras: number;
}): { blocked: string | null; offer: OfferedSor | null } {
  const so = o.tranId || "This order";
  if (!OPEN_ORDER_STATUSES.includes(o.status)) {
    return { blocked: `${so} is ${statusWords(o.statusText)}, so it can't take a revision.`, offer: null };
  }
  const open = o.openSor;
  if (open) {
    if (open.status === SOR_STATUS.DRAFT && !open.blocked) {
      return {
        blocked: `${open.number} is already open on ${so}, and an order can have only one open revision. Push your items to ${open.number} instead.`,
        offer: open,
      };
    }
    if (open.status === SOR_STATUS.DRAFT) {
      return { blocked: `${open.number} is already open on ${so} (one open revision per order). ${open.blocked}`, offer: null };
    }
    return {
      blocked: `${open.number} is open on ${so} (${SOR_STATUS_NAMES[open.status] ?? (open.statusText || "in progress")}). A new revision can start once it is processed.`,
      offer: null,
    };
  }
  if (o.pendingCor) {
    return { blocked: `${so} has a change order (COR) waiting for verification. Finish or void it in NetSuite first.`, offer: null };
  }
  if (o.pendingPras > 0) {
    return {
      blocked: `${so} has discount codes that have not been Applied yet. Apply or remove them on the order's Discounts tab in NetSuite, then try again.`,
      offer: null,
    };
  }
  return { blocked: null, offer: null };
}

interface OrderRow {
  id: string; tranid: string; status: string | null; st: string | null; customer: string | null;
  cat: string | null; catname: string | null; customerid: string | null; pricelevel: string | null; custcat: string | null;
}

const ORDER_COLUMNS = `
  t.id, t.tranid, t.status, BUILTIN.DF(t.status) AS st, BUILTIN.DF(t.entity) AS customer,
  t.custbody_customer_category AS cat, BUILTIN.DF(t.custbody_customer_category) AS catname,
  t.entity AS customerid, c.pricelevel, c.category AS custcat`;

async function withVerdicts(rows: OrderRow[]): Promise<Array<OrderForNewSor & OrderPricingContext>> {
  if (rows.length === 0) return [];
  const ids = rows.map(r => positiveId(String(r.id)));
  const [open, cors, pras] = await Promise.all([
    openSorsByOrder(ids),
    executeSuiteQL<{ so: string; n: string }>(`
      SELECT custrecord_cor_salesorder AS so, COUNT(*) AS n FROM customrecord_cor
      WHERE custrecord_cor_salesorder IN (${ids.join(",")}) AND custrecord_cor_status = 2
      GROUP BY custrecord_cor_salesorder
    `),
    // createNewSRR's gate: entered on the order's Discounts tab, not Applied, not staged by a revision, not Unapplied.
    executeSuiteQL<{ txn: string; n: string }>(`
      SELECT custrecord_txnpra_txnid AS txn, COUNT(*) AS n FROM customrecord_txnpra
      WHERE custrecord_txnpra_txnid IN (${ids.map(id => `'${id}'`).join(",")}) AND isinactive = 'F'
        AND custrecord_txnpra_posted = 'F' AND custrecord_txnpra_sor IS NULL AND NVL(custrecord_txnpra_unapplied, 'F') = 'F'
      GROUP BY custrecord_txnpra_txnid
    `),
  ]);
  const corBy = new Map(cors.items.map(r => [String(r.so), Number(r.n)]));
  const praBy = new Map(pras.items.map(r => [String(r.txn), Number(r.n)]));
  return rows.map(r => {
    const id = String(r.id);
    const sor = open.get(id);
    const openSor: OfferedSor | null = sor ? { ...sor, ...sorPushVerdict(sor) } : null;
    const base = {
      id, tranId: r.tranid, status: String(r.status ?? ""), statusText: statusWords(r.st ?? ""),
      customerName: r.customer ?? "",
      customerCategoryId: r.cat != null ? String(r.cat) : null, customerCategory: r.catname ?? null,
      openSor,
    };
    const verdict = newSorVerdict({ ...base, statusText: r.st ?? "", pendingCor: (corBy.get(id) ?? 0) > 0, pendingPras: praBy.get(id) ?? 0 });
    return {
      ...base, ...verdict,
      customerId: r.customerid != null ? String(r.customerid) : null,
      priceLevel: r.pricelevel ? String(r.pricelevel) : "1",
      customerRecordCategory: r.custcat != null ? String(r.custcat) : null,
    };
  });
}

/**
 * The Quote List's one search box (2026-11-13, Gib: "No point in seeing processed orders that we cant add to"): only
 * orders that can take a revision, plus the one whose number was typed in full, so the box can say why not.
 */
export function openOrdersClause(digits: string): string {
  return `(t.status IN (${OPEN_ORDER_STATUSES.map(s => `'${s}'`).join(",")}) OR t.tranid = 'SO${digits}')`;
}

/**
 * Sales Orders whose number contains the digits, newest first, each with whether it can take a new revision.
 * openOnly (the one search box): see openOrdersClause. The classic New SOR panel lists every status, as before.
 */
export async function searchOrdersForNewSor(digits: string, opts: { openOnly?: boolean } = {}): Promise<OrderForNewSor[]> {
  if (!/^\d{1,9}$/.test(digits)) return [];
  // Was: WHERE t.type = 'SalesOrd' AND t.tranid LIKE '%${digits}%'
  const result = await executeSuiteQL<OrderRow>(`
    SELECT ${ORDER_COLUMNS}
    FROM transaction t LEFT JOIN customer c ON c.id = t.entity
    WHERE t.type = 'SalesOrd' AND t.tranid LIKE '%${digits}%'${opts.openOnly ? ` AND ${openOrdersClause(digits)}` : ""}
    ORDER BY t.id DESC
  `);
  const rows = await withVerdicts(result.items.slice(0, 15));
  // The pricing inputs stay on the server. Was (pre-2026-11-13): customerId was stripped too.
  return rows.map(({ priceLevel: _p, customerRecordCategory: _r, ...order }) => order);
}

/** Customer-name matching for the Quote List's one search box (2026-11-13): company, first or last name. */
export function customerNameFilter(name: string, alias = "c"): string {
  const n = name.trim().toUpperCase().replace(/'/g, "''").replace(/[%_\\]/g, "\\$&");
  return `(UPPER(${alias}.companyname) LIKE '%${n}%' OR UPPER(${alias}.lastname) LIKE '%${n}%' OR UPPER(${alias}.firstname) LIKE '%${n}%')`;
}

/** Open Sales Orders (statuses that can take a revision) of customers whose name matches, newest first. */
export async function searchOrdersByCustomerName(name: string): Promise<OrderForNewSor[]> {
  const result = await executeSuiteQL<OrderRow>(`
    SELECT ${ORDER_COLUMNS}
    FROM transaction t INNER JOIN customer c ON c.id = t.entity
    WHERE t.type = 'SalesOrd' AND t.status IN (${OPEN_ORDER_STATUSES.map(s => `'${s}'`).join(",")}) AND ${customerNameFilter(name)}
    ORDER BY t.id DESC
  `);
  const rows = await withVerdicts(result.items.slice(0, 10));
  return rows.map(({ priceLevel: _p, customerRecordCategory: _r, ...order }) => order);
}

/** The Sales Order a revision number belongs to, with its New SOR verdict ("SOR61" finds SO714729). */
export async function orderForSorNumber(sorDigits: string): Promise<OrderForNewSor | null> {
  const so = await executeSuiteQL<{ soid: string }>(
    `SELECT custrecord_sor_salesorder AS soid FROM customrecord_sor WHERE id = ${positiveId(sorDigits)}`,
  );
  const soId = so.items[0]?.soid;
  if (!soId) return null;
  const order = await loadOrderForNewSor(String(soId));
  if (!order) return null;
  const { priceLevel: _p, customerRecordCategory: _r, ...rest } = order;
  return rest;
}

export async function loadOrderForNewSor(soId: string): Promise<(OrderForNewSor & OrderPricingContext) | null> {
  const result = await executeSuiteQL<OrderRow>(`
    SELECT ${ORDER_COLUMNS}
    FROM transaction t LEFT JOIN customer c ON c.id = t.entity
    WHERE t.type = 'SalesOrd' AND t.id = ${positiveId(soId)}
  `);
  return (await withVerdicts(result.items))[0] ?? null;
}

export function workbenchUrl(sorId: string, base = appBaseUrl()): string {
  return `${base}/app/site/hosting/scriptlet.nl?script=customscript_sor_workbench&deploy=customdeploy_sor_workbench` +
    `&srr=${positiveId(sorId)}&uimode=assistant`;
}

/** The new revision's id from the workbench's redirect after ?soid= (…&srr=516&…), or null. */
export function readCreatedSorId(location: string | null): string | null {
  const m = /[?&]srr=(\d+)(?:&|$)/.exec(String(location ?? ""));
  return m ? m[1] : null;
}

/**
 * Starts a Draft revision on the order with the workbench's own find-or-create (the New Revision button's ?soid=
 * GET; OAuth 2.0 bearer, as the cpsrecalc refresh). Returns the revision id it redirects to.
 */
export async function createSorOnOrder(
  soId: string,
  deps: { fetch: typeof fetchNetSuite; token: () => Promise<string> } = { fetch: fetchNetSuite, token: getAccessToken },
): Promise<string> {
  const url = `${appBaseUrl()}/app/site/hosting/scriptlet.nl?script=customscript_sor_workbench&deploy=customdeploy_sor_workbench` +
    `&soid=${positiveId(soId)}`;
  const response = await deps.fetch(url, { headers: { Authorization: `Bearer ${await deps.token()}` }, redirect: "manual" });
  const location = response.headers.get("location");
  const text = await response.text().catch(() => "");
  const sorId = response.status >= 300 && response.status < 400 ? readCreatedSorId(location) : null;
  if (sorId) return sorId;
  // createNewSRR refuses with a thrown error, which NetSuite shows as an error page.
  const reason = /A Sales Order Revision is already in progress[^<]*|A change order is pending[^<]*|This Sales Order has discount \(PRA\) codes[^<]*/.exec(text)?.[0];
  throw new Error(reason ? reason.trim() : `The SOR workbench did not start a revision (HTTP ${response.status}${location ? ", redirected to sign-in" : ""})`);
}

/*
 * One New SOR per order at a time, across every server instance (an app_settings row is the lock), and one result per
 * attempt (a retry of the same attempt gets the same revision back instead of a second one).
 */
const LOCK_PREFIX = "new-sor-lock:";
const RESULT_PREFIX = "new-sor:";
export const NEW_SOR_LOCK_MS = 3 * 60 * 1000;
const RESULT_KEEP_MS = 24 * 60 * 60 * 1000;
const stamp = (ms: number) => String(ms).padStart(15, "0");

export function isAttemptId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9-]{16,64}$/.test(value);
}

/** True when this caller now holds the order's lock (a lock older than 3 minutes is taken over). */
export async function lockOrder(soId: string, now = Date.now()): Promise<string | null> {
  const value = stamp(now + NEW_SOR_LOCK_MS);
  const result: any = await db.execute(sql`
    INSERT INTO app_settings (key, value) VALUES (${LOCK_PREFIX + positiveId(soId)}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value WHERE app_settings.value < ${stamp(now)}
    RETURNING key
  `);
  return (result?.rows?.length ?? 0) > 0 ? value : null;
}

export async function unlockOrder(soId: string, value: string): Promise<void> {
  await db.execute(sql`DELETE FROM app_settings WHERE key = ${LOCK_PREFIX + positiveId(soId)} AND value = ${value}`);
}

export async function saveAttempt(attemptId: string, result: unknown, now = Date.now()): Promise<void> {
  const value = JSON.stringify({ result, keepUntil: now + RESULT_KEEP_MS });
  await db.execute(sql`
    INSERT INTO app_settings (key, value) VALUES (${RESULT_PREFIX + attemptId}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);
}

export async function loadAttempt(attemptId: string, now = Date.now()): Promise<unknown | null> {
  const result: any = await db.execute(sql`SELECT value FROM app_settings WHERE key = ${RESULT_PREFIX + attemptId}`);
  const raw = result?.rows?.[0]?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.keepUntil > now ? parsed.result : null;
  } catch {
    return null;
  }
}

export async function purgeOldAttempts(now = Date.now()): Promise<void> {
  const result: any = await db.execute(sql`SELECT key, value FROM app_settings WHERE key LIKE ${RESULT_PREFIX + "%"}`);
  for (const row of result?.rows ?? []) {
    let keep = false;
    try { keep = JSON.parse(row.value)?.keepUntil > now; } catch { keep = false; }
    if (!keep) await db.execute(sql`DELETE FROM app_settings WHERE key = ${row.key}`);
  }
}
