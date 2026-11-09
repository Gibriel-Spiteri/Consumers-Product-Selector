import type { IRouter, RequestHandler } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, analyticsEventsTable, productsTable } from "@workspace/db";
import { GetAnalyticsDrilldownResponse, GetAnalyticsDrilldownQueryParams } from "@workspace/api-zod";
import { analyticsWhere } from "../lib/analytics-filters";
import { getAdminEmployeeIds, getEmployeeNames } from "../lib/employees";

export function registerAnalyticsDrilldown(router: IRouter, requireAdmin: RequestHandler): void {
  router.get("/admin/analytics/drilldown", requireAdmin, async (req, res): Promise<void> => {
    const parsed = GetAnalyticsDrilldownQueryParams.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: "Invalid analytics filters." }); return; }
    const { range, includeAdmins, eventType, employeeId, vendorDomain, page = 1 } = parsed.data;
    if (!Number.isSafeInteger(page) || page > 100000
      || (employeeId && employeeId !== "anonymous" && !/^\d+$/.test(employeeId))) {
      res.status(400).json({ error: "Invalid analytics filters." }); return;
    }
    try {
      const adminIds = includeAdmins === "1" ? [] : await getAdminEmployeeIds();
      const domain = sql<string>`${analyticsEventsTable.metadata}->>'vendorDomain'`;
      const typeWhere = and(analyticsWhere(range, adminIds), eq(analyticsEventsTable.eventType, eventType));
      const actorWhere = and(typeWhere, vendorDomain ? eq(domain, vendorDomain) : undefined);
      const eventWhere = and(actorWhere, employeeId === "anonymous" ? isNull(analyticsEventsTable.employeeId)
        : employeeId ? eq(analyticsEventsTable.employeeId, employeeId) : undefined);
      const [actors, sites, [count], events] = await Promise.all([
        db.select({
          employeeId: analyticsEventsTable.employeeId,
          count: sql<number>`count(*)::int`,
          // SQL type annotations do not decode driver values. Reuse the column's
          // timestamp decoder so aggregates have the same UTC semantics as rows.
          lastSeen: sql<Date>`max(${analyticsEventsTable.createdAt})`.mapWith(analyticsEventsTable.createdAt),
        }).from(analyticsEventsTable).where(actorWhere).groupBy(analyticsEventsTable.employeeId).orderBy(desc(sql`count(*)`)),
        db.select({ domain, count: sql<number>`count(*)::int` }).from(analyticsEventsTable)
          .where(and(typeWhere, sql`${domain} is not null`)).groupBy(domain).orderBy(desc(sql`count(*)`)),
        db.select({ total: sql<number>`count(*)::int` }).from(analyticsEventsTable).where(eventWhere),
        db.select({
          id: analyticsEventsTable.id, createdAt: analyticsEventsTable.createdAt,
          employeeId: analyticsEventsTable.employeeId, metadata: analyticsEventsTable.metadata,
          productName: productsTable.name,
        }).from(analyticsEventsTable).leftJoin(productsTable, eq(productsTable.id, analyticsEventsTable.productId))
          .where(eventWhere).orderBy(desc(analyticsEventsTable.createdAt), desc(analyticsEventsTable.id)).limit(50).offset((page - 1) * 50),
      ]);
      const ids = [...new Set([...actors, ...events].map(row => row.employeeId).filter((id): id is string => id !== null))];
      const names = await getEmployeeNames(ids);
      const name = (id: string | null) => id === null ? "Anonymous / unattributed" : names.get(id) ?? `Employee #${id}`;
      res.json(GetAnalyticsDrilldownResponse.parse({
        total: count?.total ?? 0, page, pageSize: 50,
        actors: actors.map(actor => ({ ...actor, employeeName: name(actor.employeeId), lastSeen: actor.lastSeen.toISOString() })),
        sites,
        events: events.map(event => ({ ...event, employeeName: name(event.employeeId), createdAt: event.createdAt.toISOString() })),
      }));
    } catch (err) {
      req.log.error({ err }, "Could not load analytics drilldown");
      res.status(500).json({ error: "Could not load activity details." });
    }
  });
}
