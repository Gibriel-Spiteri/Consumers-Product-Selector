import type { IRouter, RequestHandler } from "express";
import { and, inArray } from "drizzle-orm";
import { db, analyticsEventsTable } from "@workspace/db";
import { GetVendorConversionsQueryParams, GetVendorConversionsResponse } from "@workspace/api-zod";
import { analyticsWhere } from "../lib/analytics-filters";
import { getAdminEmployeeIds, getEmployeeNames } from "../lib/employees";
import { buildVendorConversions } from "../lib/vendor-conversions";

export function registerAnalyticsConversions(router: IRouter, requireAdmin: RequestHandler): void {
  router.get("/admin/analytics/conversions", requireAdmin, async (req, res): Promise<void> => {
    const parsed = GetVendorConversionsQueryParams.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: "Invalid analytics filters." }); return; }
    try {
      const adminIds = parsed.data.includeAdmins === "1" ? [] : await getAdminEmployeeIds();
      const events = await db.select({
        id: analyticsEventsTable.id, employeeId: analyticsEventsTable.employeeId,
        eventType: analyticsEventsTable.eventType, metadata: analyticsEventsTable.metadata,
      }).from(analyticsEventsTable).where(and(
        analyticsWhere(parsed.data.range, adminIds),
        inArray(analyticsEventsTable.eventType, ["vendor_site_visit", "quickadd_capture", "add_to_list", "push_to_estimate"]),
      ));
      const rows = buildVendorConversions(events);
      const names = await getEmployeeNames([...new Set(rows.map(row => row.employeeId).filter(id => id !== "anonymous"))]);
      res.json(GetVendorConversionsResponse.parse({ rows: rows.map(row => ({
        ...row, employeeName: row.employeeId === "anonymous" ? "Anonymous / unattributed"
          : names.get(row.employeeId) ?? `Employee #${row.employeeId}`,
      })) }));
    } catch (err) {
      req.log.error({ err }, "Could not load vendor conversions");
      res.status(500).json({ error: "Could not load vendor conversions." });
    }
  });
}
