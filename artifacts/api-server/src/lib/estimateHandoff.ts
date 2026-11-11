import { randomBytes } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import type { EstimateLineInput } from "@workspace/api-zod";
import { executeSuiteQL } from "./netsuite";
import { appBaseUrl } from "./estimateRefresh";
import {
  getSpecialOrderPricing, getSpecialOrderProductLines, getSpecialOrderTypes, positiveId, specialOrderLine,
  SpecialOrderValidationError, type EstimatePricingContext,
} from "./specialOrders";

/*
 * New estimate from the Quote List (2026-11-11). Gib: "Can you have a button for customer search on the CPS and when
 * clicked it pops open a window for the customer search app? And only after they search with a valid phone number or
 * email address, will we give them the option to create a new customer at that spot, otherwise they'll just keep
 * creating new customers."
 *
 * The Quote List is handed to NetSuite as a one-time hand-off, never in a URL:
 *  1. POST /api/estimates/handoff stores the items here (app_settings, key estimate-handoff:<token>, 30 minutes) and
 *     returns the pop-up URL: NetSuite's Customer Search page (Employee Appointments Suitelet) with &cps=<token>.
 *  2. That page reads the hand-off server to server (GET /api/handoff/estimate/<token>): the item names for the
 *     pop-up, then, once the rep picks the customer, the lines priced for that customer exactly as the push to an
 *     estimate prices them (priceHandoffLines). NetSuite passes the signed-in NetSuite user, which must be the rep
 *     who started the hand-off.
 *  3. NetSuite creates the estimate with externalid cps-<token> (it refuses a second one) and tells the Quote List
 *     window. The Quote List confirms here (POST /api/estimates/handoff/<token>/confirm), which looks the estimate
 *     up in NetSuite by that externalid, then the items leave the list and the discounts are recalculated.
 * The NetSuite side is Projects/CpsNewEstimate in the Bundle63418 repo.
 */

export const HANDOFF_TTL_MS = 30 * 60 * 1000;
const KEY_PREFIX = "estimate-handoff:";

export interface HandoffItemLabel {
  label: string;
  quantity: number;
}

export interface EstimateHandoff {
  employeeId: string;
  items: EstimateLineInput[];
  labels: HandoffItemLabel[];
  analyticsSessionId: string | null;
  createdAt: number;
  expiresAt: number;
}

/** 32 random bytes: 43 URL-safe characters. */
export function newHandoffToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isHandoffToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** The estimate's externalid in NetSuite (cpsCreateEstimate sets it). */
export function handoffExternalId(token: string): string {
  return `cps-${token}`;
}

/** NetSuite's Customer Search page in the Product Selector's new-estimate mode. */
export function handoffPopupUrl(token: string, base = appBaseUrl()): string {
  return `${base}/app/site/hosting/scriptlet.nl?script=customscript_employeeappointments_suitel&deploy=customdeploy1` +
    `&openCustomerSearch=true&cps=${encodeURIComponent(token)}`;
}

/** What the pop-up lists: the catalog item's number and name, or the special order's product line and model. */
export function handoffLabels(
  items: EstimateLineInput[],
  catalog: Map<string, { itemid: string; displayname: string | null }>,
): HandoffItemLabel[] {
  return items.map(item => {
    const so = item.specialOrder;
    if (so) {
      const model = String(so.model ?? "").trim();
      return { label: `${so.productLineName} special order${model ? ` (${model})` : ""}`, quantity: item.quantity };
    }
    const row = catalog.get(String(item.netsuiteId));
    const label = row ? [row.itemid, row.displayname].filter(Boolean).join(" - ") : `NetSuite item ${item.netsuiteId}`;
    return { label, quantity: item.quantity };
  });
}

export function parseHandoff(value: string | null | undefined, now = Date.now()): EstimateHandoff | null {
  if (!value) return null;
  try {
    const h = JSON.parse(value) as EstimateHandoff;
    if (!h || typeof h.employeeId !== "string" || !Array.isArray(h.items) || !(h.expiresAt > now)) return null;
    return h;
  } catch {
    return null;
  }
}

export async function saveHandoff(token: string, handoff: EstimateHandoff): Promise<void> {
  const value = JSON.stringify(handoff);
  await db.insert(appSettingsTable).values({ key: KEY_PREFIX + token, value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });
}

/** The hand-off, or null when there is none or it has expired. */
export async function loadHandoff(token: string, now = Date.now()): Promise<EstimateHandoff | null> {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, KEY_PREFIX + token));
  return parseHandoff(rows[0]?.value, now);
}

export async function deleteHandoff(token: string): Promise<void> {
  await db.delete(appSettingsTable).where(eq(appSettingsTable.key, KEY_PREFIX + token));
}

/** Expired hand-offs, removed whenever a new one is stored. */
export async function purgeExpiredHandoffs(now = Date.now()): Promise<number> {
  const rows = await db.select().from(appSettingsTable).where(like(appSettingsTable.key, `${KEY_PREFIX}%`));
  let removed = 0;
  for (const row of rows) {
    if (parseHandoff(row.value, now)) continue;
    await db.delete(appSettingsTable).where(eq(appSettingsTable.key, row.key));
    removed++;
  }
  return removed;
}

export interface ActiveItemRow {
  id: string;
  itemid: string;
  displayname: string | null;
}

/** The items that still exist and are active in NetSuite, by id. */
export async function activeItems(itemIds: string[]): Promise<Map<string, ActiveItemRow>> {
  const ids = Array.from(new Set(itemIds.map(id => positiveId(String(id)))));
  const rows = new Map<string, ActiveItemRow>();
  if (ids.length === 0) return rows;
  const result = await executeSuiteQL<ActiveItemRow>(
    `SELECT id, itemid, displayname FROM item WHERE id IN (${ids.join(",")}) AND isinactive = 'F'`,
  );
  for (const row of result.items) rows.set(String(row.id), row);
  return rows;
}

export type HandoffLine =
  | { item: { id: string }; quantity: number }
  | ReturnType<typeof specialOrderLine>;

/*
 * The estimate lines for the chosen customer: the same steps and math as the push to an estimate (add-items in
 * routes/estimates.ts). Catalog lines carry only the item and quantity, so NetSuite prices them for the customer
 * when it creates the estimate; special orders carry the CPS rate and specs (specialOrderLine).
 */
export async function priceHandoffLines(
  items: EstimateLineInput[],
  ctx: EstimatePricingContext,
  catalog?: Map<string, ActiveItemRow>,
): Promise<HandoffLine[]> {
  const rows = catalog ?? await activeItems(items.map(i => i.netsuiteId));
  const missing = items.filter(i => !rows.has(String(i.netsuiteId)));
  if (missing.length > 0) {
    throw new SpecialOrderValidationError(
      `${missing.length === 1 ? "An item is" : `${missing.length} items are`} no longer in NetSuite. Start again from the Quote List.`);
  }
  const specials = items.filter(i => i.specialOrder);
  const productLines = specials.length > 0 ? await getSpecialOrderProductLines(true) : [];
  const pricing = specials.length > 0 ? await getSpecialOrderPricing(specials.map(i => i.netsuiteId)) : new Map();
  const typesByLine = new Map<string, Awaited<ReturnType<typeof getSpecialOrderTypes>>>();
  const lines: HandoffLine[] = [];
  for (const item of items) {
    if (!item.specialOrder) {
      if (rows.get(String(item.netsuiteId))?.itemid.startsWith("SP-")) {
        throw new SpecialOrderValidationError("Special-order items require their product line, Type and specifications");
      }
      lines.push({ item: { id: String(item.netsuiteId) }, quantity: item.quantity });
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
    const itemPricing = pricing.get(String(item.netsuiteId));
    if (!itemPricing) throw new SpecialOrderValidationError("This special-order item has no product line pricing in NetSuite");
    lines.push(specialOrderLine(String(item.netsuiteId), item.quantity, details, productLine, type, itemPricing, ctx));
  }
  return lines;
}

export interface HandoffEstimate {
  id: number;
  tranId: string;
  customerName: string;
}

/** The estimate NetSuite created from this hand-off, or null when there is none yet. */
export async function findHandoffEstimate(token: string): Promise<HandoffEstimate | null> {
  if (!isHandoffToken(token)) return null;
  const result = await executeSuiteQL<{ id: string; tranid: string; entityname: string | null }>(`
    SELECT t.id, t.tranid, BUILTIN.DF(t.entity) AS entityname
    FROM transaction t
    WHERE t.type = 'Estimate' AND t.externalid = '${handoffExternalId(token)}'
  `);
  const row = result.items[0];
  return row ? { id: Number(row.id), tranId: row.tranid, customerName: row.entityname ?? "" } : null;
}
