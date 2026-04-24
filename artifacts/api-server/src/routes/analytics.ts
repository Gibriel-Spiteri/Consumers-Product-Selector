import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql, and, gte, isNotNull, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  analyticsEventsTable,
  productsTable,
  categoriesTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { executeSuiteQL } from "../lib/netsuite";

const router: IRouter = Router();

const MAX_BATCH = 50;
const MAX_PATH_LEN = 512;
const MAX_TYPE_LEN = 64;
const MAX_NAME_LEN = 256;

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

router.post("/analytics/event", async (req, res) => {
  const ip = (req.ip || "unknown").toString();
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  try {
    const body = req.body || {};
    const sessionId = trimStr(body.sessionId, 64);
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    const employeeId = trimStr(body.employeeId, 64);
    const employeeName = trimStr(body.employeeName, MAX_NAME_LEN);
    const events = Array.isArray(body.events) ? body.events.slice(0, MAX_BATCH) : [];
    if (events.length === 0) return res.json({ ok: true, inserted: 0 });

    const userAgent = trimStr(req.headers["user-agent"], MAX_NAME_LEN);

    const rows = events
      .map((e: any) => {
        const eventType = trimStr(e?.eventType, MAX_TYPE_LEN);
        if (!eventType) return null;
        return {
          employeeId,
          employeeName,
          sessionId,
          eventType,
          path: trimStr(e?.path, MAX_PATH_LEN),
          categoryId: toIntOrNull(e?.categoryId),
          productId: toIntOrNull(e?.productId),
          metadata:
            e?.metadata && typeof e.metadata === "object" ? e.metadata : null,
          userAgent,
        };
      })
      .filter((r: any): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) return res.json({ ok: true, inserted: 0 });

    await db.insert(analyticsEventsTable).values(rows);
    res.json({ ok: true, inserted: rows.length });
  } catch (err) {
    logger.error({ err }, "Failed to ingest analytics events");
    res.status(500).json({ error: "Failed to ingest events" });
  }
});

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const employeeId = req.headers["x-employee-id"] as string | undefined;
  if (!employeeId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const numericId = Number(employeeId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(401).json({ error: "Invalid employee id" });
  }
  try {
    const result = await executeSuiteQL<{
      id: string;
      giveaccess: string;
      custentity_webstore_access: string;
      custentity_webstore_admin: string;
    }>(
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

    const activeUsers = await db
      .select({
        employeeId: analyticsEventsTable.employeeId,
        employeeName: sql<string | null>`max(${analyticsEventsTable.employeeName})`,
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
      name: r.categoryId != null ? catNameById.get(r.categoryId) ?? `#${r.categoryId}` : "Unknown",
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
