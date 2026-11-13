import { executeSuiteQL } from "./netsuite";
import { customerNameFilter, orderForSorNumber, searchOrdersByCustomerName, searchOrdersForNewSor, type OrderForNewSor } from "./newSor";

/*
 * One search box for the Quote List's "Send to NetSuite" (2026-11-13, Gib picked variant B of the Push to redesign:
 * https://claude.ai/artifact/XVP62opudtXRsG2HTq6vRp). It takes an estimate, Sales Order or revision number (with or
 * without ES / SO / SOR) or a customer's name, and returns the estimates and Sales Orders the items could go to.
 * Each order carries the New SOR verdict (lib/newSor.ts): add to its open Draft, start a revision, or why not.
 */

export type TargetQuery =
  | { kind: "number"; prefix: "ES" | "SO" | "SOR" | null; digits: string }
  | { kind: "name"; name: string };

/** "ES241762", "so 714728", "SOR61", "241762" -> a number; "Alvarez", "Linden Kitchen" -> a name; else null. */
export function parseTargetQuery(raw: string): TargetQuery | null {
  const s = String(raw ?? "").trim();
  const m = s.replace(/\s+/g, "").toUpperCase().match(/^(ES|SOR|SO)?#?(\d+)$/);
  if (m) {
    const digits = m[2];
    const prefix = (m[1] as "ES" | "SO" | "SOR" | undefined) ?? null;
    // SOR numbers are short (SOR61); estimate and order numbers need 3 digits to search.
    if (digits.length > 9 || (prefix !== "SOR" && digits.length < 3)) return null;
    return { kind: "number", prefix, digits };
  }
  const name = s.replace(/\s+/g, " ");
  if (name.length >= 3 && name.length <= 60 && /^[A-Za-z][A-Za-z .'&-]*$/.test(name)) return { kind: "name", name };
  return null;
}

export interface EstimateTarget {
  id: string;
  tranId: string;
  customerId: string | null;
  customerName: string;
  customerCategoryId: string;
  customerCategory: string;
  status: string;
  date: string;
  total: number | null;
  /** Only an open estimate takes items (as the estimate push allows). */
  open: boolean;
}

export async function searchEstimateTargets(q: TargetQuery): Promise<EstimateTarget[]> {
  let where: string;
  if (q.kind === "number") {
    if (q.prefix === "SO" || q.prefix === "SOR") return [];
    where = `t.tranid LIKE '%${q.digits}%'`;
  } else {
    where = customerNameFilter(q.name);
  }
  const result = await executeSuiteQL<{
    id: string; tranid: string; entity: string | null; entityname: string | null; status: string | null;
    trandate: string | null; total: string | null; ccat: string | null; ccatname: string | null; ecat: string | null; ecatname: string | null;
  }>(`
    SELECT t.id, t.tranid, t.entity, BUILTIN.DF(t.entity) AS entityname, BUILTIN.DF(t.status) AS status, t.trandate, t.total,
      c.category AS ccat, BUILTIN.DF(c.category) AS ccatname,
      t.custbody_customer_category AS ecat, BUILTIN.DF(t.custbody_customer_category) AS ecatname
    FROM transaction t LEFT JOIN customer c ON c.id = t.entity
    WHERE t.type = 'Estimate' AND (${where})
    ORDER BY t.id DESC
    FETCH FIRST 25 ROWS ONLY
  `);
  const all = result.items.map(row => {
    const status = (row.status ?? "").replace(/^Estimate\s*:\s*/i, "");
    return {
      id: String(row.id),
      tranId: row.tranid,
      customerId: row.entity != null ? String(row.entity) : null,
      customerName: row.entityname ?? "",
      customerCategoryId: row.ccat != null ? String(row.ccat) : row.ecat != null ? String(row.ecat) : "",
      customerCategory: (row.ccat != null ? row.ccatname : row.ecatname) ?? "",
      status,
      date: row.trandate ?? "",
      total: row.total != null ? parseFloat(row.total) : null,
      open: /open/i.test(status),
    };
  });
  // As the estimate search: Voided and Declined are left out. Open ones first, newest first.
  return all
    .filter(e => !/voided|declined/i.test(e.status))
    .sort((a, b) => Number(b.open) - Number(a.open))
    .slice(0, 12);
}

export async function searchOrderTargets(q: TargetQuery): Promise<OrderForNewSor[]> {
  if (q.kind === "name") return searchOrdersByCustomerName(q.name);
  if (q.prefix === "ES") return [];
  if (q.prefix === "SOR") {
    const order = await orderForSorNumber(q.digits);
    return order ? [order] : [];
  }
  const orders = await searchOrdersForNewSor(q.digits);
  if (q.prefix === null && orders.length === 0 && q.digits.length <= 4) {
    // A bare short number may be a revision number.
    const order = await orderForSorNumber(q.digits).catch(() => null);
    return order ? [order] : [];
  }
  return orders;
}
