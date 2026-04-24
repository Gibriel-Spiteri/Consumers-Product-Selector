import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql, and, gte, isNotNull, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  analyticsEventsTable,
  productsTable,
  categoriesTable,
  type InsertAnalyticsEvent,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { executeSuiteQL } from "../lib/netsuite";

const router: IRouter = Router();

const MAX_BATCH = 50;
const MAX_PATH_LEN = 512;
const MAX_TYPE_LEN = 64;
const MAX_UA_LEN = 512;
const MAX_SESSION_LEN = 64;
const MAX_EMPLOYEE_ID_LEN = 64;

const ALLOWED_EVENT_TYPES = new Set([
  "page_view",
  "category_view",
  "product_view",
  "product_modal_open",
  "search",
]);

const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_MAX) return false;
  bucket.count += 1;
  return true;
}

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function toIntOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

interface IncomingEvent {
  eventType?: unknown;
  path?: unknown;
  categoryId?: unknown;
  productId?: unknown;
  metadata?: unknown;
}

interface IncomingBody {
  sessionId?: unknown;
  events?: unknown;
}

function isIncomingEvent(v: unknown): v is IncomingEvent {
  return typeof v === "object" && v !== null;
}

router.post("/analytics/event", async (req, res) => {
  const ip = (req.ip || "unknown").toString();
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  try {
    const body = (req.body ?? {}) as IncomingBody;
    const sessionId = trimStr(body.sessionId, MAX_SESSION_LEN);
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    // Identity is server-attached from the trusted X-Employee-Id header
    // (same header the rest of the app uses for auth). Body-supplied identity
    // is intentionally ignored to prevent client-side spoofing.
    const employeeIdHeader = trimStr(
      req.headers["x-employee-id"],
      MAX_EMPLOYEE_ID_LEN,
    );
    const numericEmployeeId = employeeIdHeader ? Number(employeeIdHeader) : NaN;
    const employeeId =
      Number.isInteger(numericEmployeeId) && numericEmployeeId > 0
        ? String(numericEmployeeId)
        : null;

    const rawEvents = Array.isArray(body.events) ? body.events.slice(0, MAX_BATCH) : [];
    if (rawEvents.length === 0) return res.json({ ok: true, inserted: 0 });

    const userAgent = trimStr(req.headers["user-agent"], MAX_UA_LEN);

    const rows: InsertAnalyticsEvent[] = [];
    for (const raw of rawEvents) {
      if (!isIncomingEvent(raw)) continue;
      const eventType = trimStr(raw.eventType, MAX_TYPE_LEN);
      if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) continue;
      const path = trimStr(raw.path, MAX_PATH_LEN);
      // Defense in depth: never store admin-route activity.
      if (path && path.startsWith("/admin")) continue;
      rows.push({
        employeeId,
        sessionId,
        eventType,
        path,
        categoryId: toIntOrNull(raw.categoryId),
        productId: toIntOrNull(raw.productId),
        metadata:
          raw.metadata && typeof raw.metadata === "object" ? raw.metadata : null,
        userAgent,
      });
    }

    if (rows.length === 0) return res.json({ ok: true, inserted: 0 });

    await db.insert(analyticsEventsTable).values(rows);
    res.json({ ok: true, inserted: rows.length });
  } catch (err) {
    logger.error({ err }, "Failed to ingest analytics events");
    res.status(500).json({ error: "Failed to ingest events" });
  }
});

interface NetSuiteEmployeeRow {
  id: string;
  giveaccess: string;
  custentity_webstore_access: string;
  custentity_webstore_admin: string;
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const employeeId = req.headers["x-employee-id"];
  const employeeIdStr = typeof employeeId === "string" ? employeeId : undefined;
  if (!employeeIdStr) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const numericId = Number(employeeIdStr);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(401).json({ error: "Invalid employee id" });
  }
  try {
    const result = await executeSuiteQL<NetSuiteEmployeeRow>(
      `SELECT id, giveaccess, custentity_webstore_access, custentity_webstore_admin
       FROM Employee WHERE id = ${numericId}`,
    );
    if (
      result.items.length === 0 ||
      result.items[0].giveaccess !== "T" ||
      result.items[0].custentity_webstore_access !== "T" ||
      result.items[0].custentity_webstore_admin !== "T"
    ) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch {
    return res.status(500).json({ error: "Authorization check failed" });
  }
}

function rangeToDays(range: unknown): number {
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7;
}

interface NetSuiteEmployeeName {
  id: string;
  firstname: string | null;
  lastname: string | null;
}

async function fetchEmployeeNames(
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const numericIds = ids
    .map((id) => Number(id))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (numericIds.length === 0) return out;
  try {
    const result = await executeSuiteQL<NetSuiteEmployeeName>(
      `SELECT id, firstname, lastname FROM Employee WHERE id IN (${numericIds.join(",")})`,
    );
    for (const row of result.items) {
      const fullName = `${row.firstname ?? ""} ${row.lastname ?? ""}`.trim();
      if (fullName) out.set(String(row.id), fullName);
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch employee names from NetSuite");
  }
  return out;
}

router.get("/admin/analytics/summary", requireAdmin, async (req, res) => {
  try {
    const days = rangeToDays(req.query.range);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const baseWhere = gte(analyticsEventsTable.createdAt, since);

    const [totals] = await db
      .select({
        totalEvents: sql<number>`count(*)::int`,
        totalSessions: sql<number>`count(distinct ${analyticsEventsTable.sessionId})::int`,
        totalUsers: sql<number>`count(distinct ${analyticsEventsTable.employeeId})::int`,
      })
      .from(analyticsEventsTable)
      .where(baseWhere);

    const activeUsersRaw = await db
      .select({
        employeeId: analyticsEventsTable.employeeId,
        sessions: sql<number>`count(distinct ${analyticsEventsTable.sessionId})::int`,
        pageViews: sql<number>`sum(case when ${analyticsEventsTable.eventType} = 'page_view' then 1 else 0 end)::int`,
        events: sql<number>`count(*)::int`,
        lastSeen: sql<Date>`max(${analyticsEventsTable.createdAt})`,
      })
      .from(analyticsEventsTable)
      .where(and(baseWhere, isNotNull(analyticsEventsTable.employeeId)))
      .groupBy(analyticsEventsTable.employeeId)
      .orderBy(desc(sql`count(*)`))
      .limit(50);

    const employeeNames = await fetchEmployeeNames(
      activeUsersRaw
        .map((u) => u.employeeId)
        .filter((v): v is string => v != null),
    );

    const activeUsers = activeUsersRaw.map((u) => ({
      employeeId: u.employeeId,
      employeeName:
        u.employeeId && employeeNames.get(u.employeeId)
          ? employeeNames.get(u.employeeId)!
          : u.employeeId
          ? `Employee #${u.employeeId}`
          : null,
      sessions: u.sessions,
      pageViews: u.pageViews,
      events: u.events,
      lastSeen: u.lastSeen,
    }));

    const anonAgg = await db
      .select({
        sessions: sql<number>`count(distinct ${analyticsEventsTable.sessionId})::int`,
        pageViews: sql<number>`sum(case when ${analyticsEventsTable.eventType} = 'page_view' then 1 else 0 end)::int`,
        events: sql<number>`count(*)::int`,
        lastSeen: sql<Date>`max(${analyticsEventsTable.createdAt})`,
      })
      .from(analyticsEventsTable)
      .where(and(baseWhere, sql`${analyticsEventsTable.employeeId} is null`));

    const topCategoriesRaw = await db
      .select({
        categoryId: analyticsEventsTable.categoryId,
        views: sql<number>`count(*)::int`,
      })
      .from(analyticsEventsTable)
      .where(
        and(
          baseWhere,
          isNotNull(analyticsEventsTable.categoryId),
          eq(analyticsEventsTable.eventType, "category_view"),
        ),
      )
      .groupBy(analyticsEventsTable.categoryId)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    const categoryIds = topCategoriesRaw
      .map((r) => r.categoryId)
      .filter((v): v is number => v != null);
    const categories =
      categoryIds.length > 0
        ? await db
            .select({ id: categoriesTable.id, name: categoriesTable.name })
            .from(categoriesTable)
            .where(inArray(categoriesTable.id, categoryIds))
        : [];
    const catNameById = new Map(categories.map((c) => [c.id, c.name]));
    const topCategories = topCategoriesRaw.map((r) => ({
      categoryId: r.categoryId,
      name:
        r.categoryId != null
          ? catNameById.get(r.categoryId) ?? `#${r.categoryId}`
          : "Unknown",
      views: r.views,
    }));

    const topProductsRaw = await db
      .select({
        productId: analyticsEventsTable.productId,
        views: sql<number>`sum(case when ${analyticsEventsTable.eventType} = 'product_view' then 1 else 0 end)::int`,
        modalOpens: sql<number>`sum(case when ${analyticsEventsTable.eventType} = 'product_modal_open' then 1 else 0 end)::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(analyticsEventsTable)
      .where(
        and(
          baseWhere,
          isNotNull(analyticsEventsTable.productId),
          inArray(analyticsEventsTable.eventType, [
            "product_view",
            "product_modal_open",
          ]),
        ),
      )
      .groupBy(analyticsEventsTable.productId)
      .orderBy(desc(sql`count(*)`))
      .limit(50);

    const productIds = topProductsRaw
      .map((r) => r.productId)
      .filter((v): v is number => v != null);
    const products =
      productIds.length > 0
        ? await db
            .select({
              id: productsTable.id,
              name: productsTable.name,
              sku: productsTable.sku,
            })
            .from(productsTable)
            .where(inArray(productsTable.id, productIds))
        : [];
    const productById = new Map(products.map((p) => [p.id, p]));
    const topProducts = topProductsRaw.map((r) => {
      const p = r.productId != null ? productById.get(r.productId) : undefined;
      return {
        productId: r.productId,
        name: p?.name ?? `#${r.productId}`,
        sku: p?.sku ?? null,
        views: r.views,
        modalOpens: r.modalOpens,
      };
    });

    const dailyPageViews = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${analyticsEventsTable.createdAt}), 'YYYY-MM-DD')`,
        views: sql<number>`count(*)::int`,
      })
      .from(analyticsEventsTable)
      .where(and(baseWhere, eq(analyticsEventsTable.eventType, "page_view")))
      .groupBy(sql`date_trunc('day', ${analyticsEventsTable.createdAt})`)
      .orderBy(sql`date_trunc('day', ${analyticsEventsTable.createdAt})`);

    res.json({
      range: `${days}d`,
      totals: {
        events: totals?.totalEvents ?? 0,
        sessions: totals?.totalSessions ?? 0,
        users: totals?.totalUsers ?? 0,
      },
      activeUsers,
      anonymous: anonAgg[0] ?? { sessions: 0, pageViews: 0, events: 0, lastSeen: null },
      topCategories,
      topProducts,
      dailyPageViews,
    });
  } catch (err) {
    logger.error({ err }, "Failed to load analytics summary");
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

export default router;
