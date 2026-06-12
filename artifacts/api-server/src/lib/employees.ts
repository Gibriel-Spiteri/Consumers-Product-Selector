import { db, employeesTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";

export type EmployeeRecord = typeof employeesTable.$inferSelect;

function isNumericId(id: string): boolean {
  return /^-?\d+$/.test(id);
}

/** Looks up a synced employee by their NetSuite internal id. */
export async function getEmployeeByNetsuiteId(
  id: string | number
): Promise<EmployeeRecord | null> {
  const safe = String(id).trim();
  if (!isNumericId(safe)) return null;
  const rows = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.netsuiteId, safe))
    .limit(1);
  return rows[0] ?? null;
}

/** Looks up a synced employee by email (case-insensitive). */
export async function getEmployeeByEmail(
  email: string
): Promise<EmployeeRecord | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const rows = await db
    .select()
    .from(employeesTable)
    .where(sql`lower(${employeesTable.email}) = ${normalized}`)
    .limit(1);
  return rows[0] ?? null;
}

/** Returns NetSuite ids of all employees flagged as webstore admins. */
export async function getAdminEmployeeIds(): Promise<string[]> {
  const rows = await db
    .select({ netsuiteId: employeesTable.netsuiteId })
    .from(employeesTable)
    .where(eq(employeesTable.webstoreAdmin, true));
  return rows.map((r) => r.netsuiteId);
}

/** Maps NetSuite ids to display names for the given employees. */
export async function getEmployeeNames(
  ids: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const safe = Array.from(new Set(ids.filter((id) => isNumericId(String(id)))));
  if (safe.length === 0) return out;
  const rows = await db
    .select({
      netsuiteId: employeesTable.netsuiteId,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      entityId: employeesTable.entityId,
    })
    .from(employeesTable)
    .where(inArray(employeesTable.netsuiteId, safe));
  for (const r of rows) {
    const name =
      `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || r.entityId || "";
    if (name) out.set(r.netsuiteId, name);
  }
  return out;
}

/** True when the employee has system + webstore access and is a webstore admin. */
export function isAdminRecord(emp: EmployeeRecord | null): boolean {
  return !!emp && emp.giveAccess && emp.webstoreAccess && emp.webstoreAdmin;
}

/** True when the employee has both system and webstore access. */
export function hasEmployeeAccess(emp: EmployeeRecord | null): boolean {
  return !!emp && emp.giveAccess && emp.webstoreAccess;
}
