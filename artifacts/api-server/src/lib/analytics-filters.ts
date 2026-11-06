import { and, eq, gte, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { analyticsEventsTable } from "@workspace/db";

const ET_TZ = "America/New_York";

export function etMidnight(dateStr: string): Date {
  for (const offset of [4, 5]) {
    const candidate = new Date(`${dateStr}T0${offset}:00:00Z`);
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: ET_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(candidate);
    if (time === "00:00") return candidate;
  }
  throw new Error("Invalid Eastern date");
}

export function rangeToWindow(range: unknown, now = new Date()): { since: Date; until?: Date; label: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ET_TZ }).format(now);
  if (range === "today") return { since: etMidnight(today), label: "today" };
  if (range === "yesterday") {
    const [y, m, d] = today.split("-").map(Number);
    const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
    return { since: etMidnight(yesterday), until: etMidnight(today), label: "yesterday" };
  }
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;
  return { since: new Date(now.getTime() - days * 86400000), label: `${days}d` };
}

/** All totals and drill-downs must use the same scope, including home-page exclusion. */
export function analyticsWhere(range: unknown, adminIds: string[] = [], employeeId?: string) {
  const { since, until } = rangeToWindow(range);
  return and(
    gte(analyticsEventsTable.createdAt, since),
    until ? lt(analyticsEventsTable.createdAt, until) : undefined,
    adminIds.length ? or(isNull(analyticsEventsTable.employeeId), notInArray(analyticsEventsTable.employeeId, adminIds)) : undefined,
    employeeId ? eq(analyticsEventsTable.employeeId, employeeId) : undefined,
    sql`NOT (${analyticsEventsTable.eventType} = 'page_view' AND ${analyticsEventsTable.path} = '/')`,
  );
}
