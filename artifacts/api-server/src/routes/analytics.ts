import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql, and, gte, lt, isNotNull, desc, eq, inArray, notInArray, or, isNull } from "drizzle-orm";
import {
  db,
  analyticsEventsTable,
  productsTable,
  categoriesTable,
  type InsertAnalyticsEvent,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { netsuiteRequest, isNetSuiteConfigured } from "../lib/netsuite";
import {
  getAdminEmployeeIds,
  getEmployeeNames,
  getEmployeeByNetsuiteId,
  isAdminRecord,
} from "../lib/employees";

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
  "product_modal_open",
  "search",
  "add_to_list",
  "push_to_estimate",
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
    logger.warn({ ip }, "Analytics ingestion rate-limited");
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  try {
    const body = (req.body ?? {}) as IncomingBody;
    const sessionId = trimStr(body.sessionId, MAX_SESSION_LEN);
    if (!sessionId) {
      logger.warn({ ip }, "Analytics ingestion rejected: missing sessionId");
      return res.status(400).json({ error: "sessionId required" });
    }

    // Identity is server-attached from the trusted X-Employee-Id header
    // (same header the rest of the app uses for auth). Body-supplied identity
    // is intentionally ignored to prevent client-side spoofing.
    const employeeIdHeader = trimStr(
      req.headers["x-employee-id"],
      MAX_EMPLOYEE_ID_LEN,
    );
    const numericEmployeeId = employeeIdHeader ? Number(employeeIdHeader) : NaN;
    const employeeId = Number.isInteger(numericEmployeeId)
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

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers["x-employee-id"];
  const headerStr = Array.isArray(raw) ? raw[0] : raw;
  if (typeof headerStr !== "string" || !headerStr.trim()) {
    logger.warn({ raw }, "Analytics admin gate rejected: missing X-Employee-Id");
    return res.status(401).json({ error: "Authentication required" });
  }
  const trimmed = headerStr.trim();
  const numericId = Number(trimmed);
  if (!Number.isFinite(numericId)) {
    logger.warn({ trimmed }, "Analytics admin gate rejected: non-numeric X-Employee-Id");
    return res.status(401).json({ error: "Invalid employee id" });
  }
  const safeId = Math.trunc(numericId);
  try {
    const emp = await getEmployeeByNetsuiteId(safeId);
    if (!isAdminRecord(emp)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch {
    return res.status(500).json({ error: "Authorization check failed" });
  }
}

const ET_TZ = "America/New_York";

/**
 * Returns the UTC Date that equals midnight of the given YYYY-MM-DD string in
 * Eastern Time, correctly accounting for EST vs EDT (DST).
 * Strategy: try both possible ET offsets (UTC-4 and UTC-5); verify by
 * re-formatting the candidate back to ET and checking it reads "00:00".
 */
function etMidnight(dateStr: string): Date {
  for (const offsetH of [4, 5]) {
    const candidate = new Date(
      `${dateStr}T${String(offsetH).padStart(2, "0")}:00:00Z`,
    );
    const etTime = new Intl.DateTimeFormat("en-US", {
      timeZone: ET_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(candidate);
    if (etTime === "00:00") return candidate;
  }
  // Fallback (shouldn't happen for valid dates)
  return new Date(`${dateStr}T05:00:00Z`);
}

/** Returns today's date string (YYYY-MM-DD) in Eastern Time. */
function etTodayStr(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ET_TZ }).format(now);
}

/** Returns YYYY-MM-DD string daysAgo days before the given ET date string. */
function etDateMinusDays(etStr: string, days: number): string {
  const [y, m, d] = etStr.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d - days));
  return shifted.toISOString().slice(0, 10);
}

function rangeToWindow(range: unknown): { since: Date; until?: Date; label: string } {
  const now = new Date();
  const todayET = etTodayStr(now);

  if (range === "today") {
    return { since: etMidnight(todayET), label: "today" };
  }
  if (range === "yesterday") {
    const yesterdayET = etDateMinusDays(todayET, 1);
    return { since: etMidnight(yesterdayET), until: etMidnight(todayET), label: "yesterday" };
  }
  if (range === "30d") return { since: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), label: "30d" };
  if (range === "90d") return { since: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), label: "90d" };
  return { since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), label: "7d" };
}

async function fetchAdminEmployeeIds(): Promise<string[]> {
  try {
    return await getAdminEmployeeIds();
  } catch (err) {
    logger.warn({ err }, "Failed to fetch admin employee ids from DB");
    return [];
  }
}

async function fetchEmployeeNames(
  ids: string[],
): Promise<Map<string, string>> {
  try {
    return await getEmployeeNames(ids);
  } catch (err) {
    logger.warn({ err }, "Failed to fetch employee names from DB");
    return new Map<string, string>();
  }
}

router.get("/admin/analytics/summary", requireAdmin, async (req, res) => {
  try {
    const { since, until, label: rangeLabel } = rangeToWindow(req.query.range);

    const includeAdmins = req.query.includeAdmins === "1";
    const adminIds = includeAdmins ? [] : await fetchAdminEmployeeIds();
    const adminFilter =
      adminIds.length > 0
        ? or(
            isNull(analyticsEventsTable.employeeId),
            notInArray(analyticsEventsTable.employeeId, adminIds),
          )
        : undefined;

    const timeFilter = until
      ? and(gte(analyticsEventsTable.createdAt, since), lt(analyticsEventsTable.createdAt, until))
      : gte(analyticsEventsTable.createdAt, since);

    const notHomePage = sql`NOT (${analyticsEventsTable.eventType} = 'page_view' AND ${analyticsEventsTable.path} = '/')`;

    const baseWhere = adminFilter
      ? and(timeFilter, adminFilter, notHomePage)!
      : and(timeFilter, notHomePage)!;

    const [totals] = await db
      .select({
        totalEvents: sql<number>`count(*)::int`,
        totalSessions: sql<number>`count(distinct ${analyticsEventsTable.sessionId})::int`,
        totalUsers: sql<number>`count(distinct ${analyticsEventsTable.employeeId})::int`,
        addToListEvents: sql<number>`coalesce(sum(case when ${analyticsEventsTable.eventType} = 'add_to_list' then 1 else 0 end), 0)::int`,
        pushToEstimateEvents: sql<number>`coalesce(sum(case when ${analyticsEventsTable.eventType} = 'push_to_estimate' then 1 else 0 end), 0)::int`,
      })
      .from(analyticsEventsTable)
      .where(baseWhere);

    const activeUsersRaw = await db
      .select({
        employeeId: analyticsEventsTable.employeeId,
        sessions: sql<number>`count(distinct ${analyticsEventsTable.sessionId})::int`,
        pageViews: sql<number>`coalesce(sum(case when ${analyticsEventsTable.eventType} = 'page_view' then 1 else 0 end), 0)::int`,
        addsToList: sql<number>`coalesce(sum(case when ${analyticsEventsTable.eventType} = 'add_to_list' then 1 else 0 end), 0)::int`,
        pushesToEstimate: sql<number>`coalesce(sum(case when ${analyticsEventsTable.eventType} = 'push_to_estimate' then 1 else 0 end), 0)::int`,
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
      addsToList: u.addsToList,
      pushesToEstimate: u.pushesToEstimate,
      events: u.events,
      lastSeen: u.lastSeen,
    }));

    const anonAgg = await db
      .select({
        sessions: sql<number>`count(distinct ${analyticsEventsTable.sessionId})::int`,
        pageViews: sql<number>`coalesce(sum(case when ${analyticsEventsTable.eventType} = 'page_view' then 1 else 0 end), 0)::int`,
        events: sql<number>`count(*)::int`,
        lastSeen: sql<Date>`max(${analyticsEventsTable.createdAt})`,
      })
      .from(analyticsEventsTable)
      .where(and(baseWhere, sql`${analyticsEventsTable.employeeId} is null`));

    const topCategoriesRaw = await db
      .select({
        categoryId: analyticsEventsTable.categoryId,
        path: analyticsEventsTable.path,
        views: sql<number>`count(*)::int`,
      })
      .from(analyticsEventsTable)
      .where(
        and(
          baseWhere,
          eq(analyticsEventsTable.eventType, "category_view"),
        ),
      )
      .groupBy(analyticsEventsTable.categoryId, analyticsEventsTable.path)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    const categoryIds = topCategoriesRaw
      .map((r) => r.categoryId)
      .filter((v): v is number => v != null);
    const allCategories =
      categoryIds.length > 0
        ? await db
            .select({
              id: categoriesTable.id,
              name: categoriesTable.name,
              parentId: categoriesTable.parentId,
            })
            .from(categoriesTable)
        : [];
    const catById = new Map(allCategories.map((c) => [c.id, c]));
    const buildCategoryPath = (id: number | null): string => {
      if (id == null) return "Unknown";
      const parts: string[] = [];
      let current = catById.get(id);
      const seen = new Set<number>();
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        parts.unshift(current.name);
        if (current.parentId == null) break;
        current = catById.get(current.parentId);
      }
      if (parts.length === 0) return `#${id}`;
      return parts.join(" › ");
    };
    const pathToName: Record<string, string> = {
      "/clearance": "Clearance",
      "/express-bath": "Quick Ship Bath",
      "/uncategorized": "Uncategorized",
    };
    const topCategories = topCategoriesRaw.map((r) => ({
      categoryId: r.categoryId,
      name:
        r.categoryId != null
          ? buildCategoryPath(r.categoryId)
          : (r.path != null ? (pathToName[r.path] ?? r.path) : "Other"),
      views: r.views,
    }));

    const topProductsRaw = await db
      .select({
        productId: analyticsEventsTable.productId,
        modalOpens: sql<number>`count(*)::int`,
      })
      .from(analyticsEventsTable)
      .where(
        and(
          baseWhere,
          isNotNull(analyticsEventsTable.productId),
          eq(analyticsEventsTable.eventType, "product_modal_open"),
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
        modalOpens: r.modalOpens,
      };
    });

    const useHourly = rangeLabel === "today" || rangeLabel === "yesterday";
    const dailyPageViews = await db
      .select({
        day: useHourly
          ? sql<string>`to_char(date_trunc('hour', ${analyticsEventsTable.createdAt}), 'YYYY-MM-DD"T"HH24:MI')`
          : sql<string>`to_char(date_trunc('day', ${analyticsEventsTable.createdAt}), 'YYYY-MM-DD')`,
        views: sql<number>`count(*)::int`,
      })
      .from(analyticsEventsTable)
      .where(and(baseWhere, eq(analyticsEventsTable.eventType, "page_view")))
      .groupBy(useHourly
        ? sql`date_trunc('hour', ${analyticsEventsTable.createdAt})`
        : sql`date_trunc('day', ${analyticsEventsTable.createdAt})`)
      .orderBy(useHourly
        ? sql`date_trunc('hour', ${analyticsEventsTable.createdAt})`
        : sql`date_trunc('day', ${analyticsEventsTable.createdAt})`);

    const topAddedRaw = await db
      .select({
        productId: analyticsEventsTable.productId,
        adds: sql<number>`count(*)::int`,
        qtyAdded: sql<number>`coalesce(sum(case when (${analyticsEventsTable.metadata}->>'quantity') ~ '^-?[0-9]+$' then (${analyticsEventsTable.metadata}->>'quantity')::int else 0 end), 0)::int`,
        users: sql<number>`count(distinct ${analyticsEventsTable.employeeId})::int`,
      })
      .from(analyticsEventsTable)
      .where(
        and(
          baseWhere,
          isNotNull(analyticsEventsTable.productId),
          eq(analyticsEventsTable.eventType, "add_to_list"),
        ),
      )
      .groupBy(analyticsEventsTable.productId)
      .orderBy(desc(sql`count(*)`))
      .limit(25);

    const addedProductIds = topAddedRaw
      .map((r) => r.productId)
      .filter((v): v is number => v != null);
    const missingAddedIds = addedProductIds.filter((id) => !productById.has(id));
    const addedProducts =
      missingAddedIds.length > 0
        ? await db
            .select({
              id: productsTable.id,
              name: productsTable.name,
              sku: productsTable.sku,
            })
            .from(productsTable)
            .where(inArray(productsTable.id, missingAddedIds))
        : [];
    for (const p of addedProducts) productById.set(p.id, p);
    const topAddedItems = topAddedRaw.map((r) => {
      const p = r.productId != null ? productById.get(r.productId) : undefined;
      return {
        productId: r.productId,
        name: p?.name ?? `#${r.productId}`,
        sku: p?.sku ?? null,
        adds: r.adds,
        qtyAdded: r.qtyAdded,
        users: r.users,
      };
    });

    const recentEstimatesRaw = await db
      .select({
        createdAt: analyticsEventsTable.createdAt,
        employeeId: analyticsEventsTable.employeeId,
        metadata: analyticsEventsTable.metadata,
      })
      .from(analyticsEventsTable)
      .where(and(baseWhere, eq(analyticsEventsTable.eventType, "push_to_estimate")))
      .orderBy(desc(analyticsEventsTable.createdAt))
      .limit(25);

    const recentEstimateEmployeeIds = recentEstimatesRaw
      .map((e) => e.employeeId)
      .filter((v): v is string => v != null);
    const missingNameIds = recentEstimateEmployeeIds.filter(
      (id) => !employeeNames.has(id),
    );
    if (missingNameIds.length > 0) {
      const extra = await fetchEmployeeNames(missingNameIds);
      for (const [id, name] of extra) employeeNames.set(id, name);
    }
    const recentEstimates = recentEstimatesRaw.map((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      const tranId = typeof meta.tranId === "string" ? meta.tranId : null;
      const estimateId =
        typeof meta.estimateId === "number" || typeof meta.estimateId === "string"
          ? meta.estimateId
          : null;
      const itemCount = typeof meta.itemCount === "number" ? meta.itemCount : null;
      const lineCount = typeof meta.lineCount === "number" ? meta.lineCount : null;
      const totalValue =
        typeof meta.totalValue === "number" ? meta.totalValue : null;
      return {
        createdAt: e.createdAt,
        employeeId: e.employeeId,
        employeeName:
          e.employeeId && employeeNames.get(e.employeeId)
            ? employeeNames.get(e.employeeId)!
            : e.employeeId
            ? `Employee #${e.employeeId}`
            : null,
        estimateId,
        tranId,
        itemCount,
        lineCount,
        totalValue,
      };
    });

    res.json({
      range: rangeLabel,
      totals: {
        events: totals?.totalEvents ?? 0,
        sessions: totals?.totalSessions ?? 0,
        users: totals?.totalUsers ?? 0,
        addToList: totals?.addToListEvents ?? 0,
        pushToEstimate: totals?.pushToEstimateEvents ?? 0,
      },
      activeUsers,
      anonymous: anonAgg[0] ?? { sessions: 0, pageViews: 0, events: 0, lastSeen: null },
      topCategories,
      topProducts,
      topAddedItems,
      recentEstimates,
      dailyPageViews,
    });
  } catch (err) {
    logger.error({ err }, "Failed to load analytics summary");
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

const USER_EVENTS_MAX = 200;

router.get("/admin/analytics/recent", requireAdmin, async (req, res) => {
  try {
    const includeAdmins = req.query.includeAdmins === "1";
    const limitParam = Number(req.query.limit);
    const limit =
      Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 200
        ? limitParam
        : 50;

    const { since, until } = rangeToWindow(req.query.range);

    const adminIds = includeAdmins ? [] : await fetchAdminEmployeeIds();
    const adminFilter =
      adminIds.length > 0
        ? or(
            isNull(analyticsEventsTable.employeeId),
            notInArray(analyticsEventsTable.employeeId, adminIds),
          )
        : undefined;

    const timeFilter = until
      ? and(gte(analyticsEventsTable.createdAt, since), lt(analyticsEventsTable.createdAt, until))
      : gte(analyticsEventsTable.createdAt, since);

    const notHomePage = sql`NOT (${analyticsEventsTable.eventType} = 'page_view' AND ${analyticsEventsTable.path} = '/')`;

    const whereClause = adminFilter ? and(timeFilter, adminFilter, notHomePage)! : and(timeFilter, notHomePage)!;

    const events = await db
      .select({
        id: analyticsEventsTable.id,
        createdAt: analyticsEventsTable.createdAt,
        eventType: analyticsEventsTable.eventType,
        path: analyticsEventsTable.path,
        categoryId: analyticsEventsTable.categoryId,
        productId: analyticsEventsTable.productId,
        sessionId: analyticsEventsTable.sessionId,
        employeeId: analyticsEventsTable.employeeId,
        metadata: analyticsEventsTable.metadata,
      })
      .from(analyticsEventsTable)
      .where(whereClause)
      .orderBy(desc(analyticsEventsTable.createdAt))
      .limit(limit);

    const categoryIds = Array.from(
      new Set(events.map((e) => e.categoryId).filter((v): v is number => v != null)),
    );
    const productIds = Array.from(
      new Set(events.map((e) => e.productId).filter((v): v is number => v != null)),
    );
    const employeeIds = Array.from(
      new Set(events.map((e) => e.employeeId).filter((v): v is string => v != null)),
    );

    const [categories, products, employeeNames] = await Promise.all([
      categoryIds.length > 0
        ? db
            .select({ id: categoriesTable.id, name: categoriesTable.name })
            .from(categoriesTable)
            .where(inArray(categoriesTable.id, categoryIds))
        : Promise.resolve([] as { id: number; name: string }[]),
      productIds.length > 0
        ? db
            .select({
              id: productsTable.id,
              name: productsTable.name,
              sku: productsTable.sku,
            })
            .from(productsTable)
            .where(inArray(productsTable.id, productIds))
        : Promise.resolve(
            [] as { id: number; name: string; sku: string | null }[],
          ),
      employeeIds.length > 0
        ? fetchEmployeeNames(employeeIds)
        : Promise.resolve(new Map<string, string>()),
    ]);

    const catNameById = new Map(categories.map((c) => [c.id, c.name]));
    const productById = new Map(products.map((p) => [p.id, p]));

    res.json({
      limit,
      events: events.map((e) => {
        const product =
          e.productId != null ? productById.get(e.productId) : undefined;
        return {
          id: e.id,
          createdAt: e.createdAt,
          eventType: e.eventType,
          path: e.path,
          sessionId: e.sessionId,
          employeeId: e.employeeId,
          employeeName:
            e.employeeId != null
              ? employeeNames.get(e.employeeId) ?? `Employee #${e.employeeId}`
              : null,
          categoryId: e.categoryId,
          categoryName:
            e.categoryId != null ? catNameById.get(e.categoryId) ?? null : null,
          productId: e.productId,
          productName: product?.name ?? null,
          productSku: product?.sku ?? null,
          metadata: e.metadata,
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "Failed to load recent activity");
    res.status(500).json({ error: "Failed to load recent activity" });
  }
});

router.get("/admin/analytics/user/:id", requireAdmin, async (req, res) => {
  try {
    const numericId = Number(req.params.id);
    if (!Number.isInteger(numericId)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const employeeId = String(numericId);

    const events = await db
      .select({
        id: analyticsEventsTable.id,
        createdAt: analyticsEventsTable.createdAt,
        eventType: analyticsEventsTable.eventType,
        path: analyticsEventsTable.path,
        categoryId: analyticsEventsTable.categoryId,
        productId: analyticsEventsTable.productId,
        sessionId: analyticsEventsTable.sessionId,
        metadata: analyticsEventsTable.metadata,
      })
      .from(analyticsEventsTable)
      .where(eq(analyticsEventsTable.employeeId, employeeId))
      .orderBy(desc(analyticsEventsTable.createdAt))
      .limit(USER_EVENTS_MAX);

    const categoryIds = Array.from(
      new Set(
        events
          .map((e) => e.categoryId)
          .filter((v): v is number => v != null),
      ),
    );
    const productIds = Array.from(
      new Set(
        events
          .map((e) => e.productId)
          .filter((v): v is number => v != null),
      ),
    );

    const [categories, products, employeeNames] = await Promise.all([
      categoryIds.length > 0
        ? db
            .select({ id: categoriesTable.id, name: categoriesTable.name })
            .from(categoriesTable)
            .where(inArray(categoriesTable.id, categoryIds))
        : Promise.resolve([] as { id: number; name: string }[]),
      productIds.length > 0
        ? db
            .select({
              id: productsTable.id,
              name: productsTable.name,
              sku: productsTable.sku,
            })
            .from(productsTable)
            .where(inArray(productsTable.id, productIds))
        : Promise.resolve(
            [] as { id: number; name: string; sku: string | null }[],
          ),
      fetchEmployeeNames([employeeId]),
    ]);

    const catNameById = new Map(categories.map((c) => [c.id, c.name]));
    const productById = new Map(products.map((p) => [p.id, p]));

    res.json({
      employeeId,
      employeeName: employeeNames.get(employeeId) ?? `Employee #${employeeId}`,
      limit: USER_EVENTS_MAX,
      truncated: events.length === USER_EVENTS_MAX,
      events: events.map((e) => {
        const product =
          e.productId != null ? productById.get(e.productId) : undefined;
        return {
          id: e.id,
          createdAt: e.createdAt,
          eventType: e.eventType,
          path: e.path,
          sessionId: e.sessionId,
          categoryId: e.categoryId,
          categoryName:
            e.categoryId != null
              ? catNameById.get(e.categoryId) ?? null
              : null,
          productId: e.productId,
          productName: product?.name ?? null,
          productSku: product?.sku ?? null,
          metadata: e.metadata,
        };
      }),
    });
  } catch (err) {
    logger.error({ err, userId: req.params.id }, "Failed to load user activity");
    res.status(500).json({ error: "Failed to load user activity" });
  }
});

const PRODUCT_ADDS_LIMIT = 200;
const ESTIMATE_EVENTS_LIMIT = 50;

router.get("/admin/analytics/product-adds/:productId", requireAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Invalid productId" });
    }
    const { since, until } = rangeToWindow(req.query.range);
    const includeAdmins = req.query.includeAdmins === "1";
    const adminIds = includeAdmins ? [] : await fetchAdminEmployeeIds();

    const filters = [
      eq(analyticsEventsTable.productId, productId),
      eq(analyticsEventsTable.eventType, "add_to_list"),
      gte(analyticsEventsTable.createdAt, since),
      ...(until ? [lt(analyticsEventsTable.createdAt, until)] : []),
    ];
    if (adminIds.length > 0) {
      filters.push(
        or(
          isNull(analyticsEventsTable.employeeId),
          notInArray(analyticsEventsTable.employeeId, adminIds),
        )!,
      );
    }

    const events = await db
      .select({
        id: analyticsEventsTable.id,
        createdAt: analyticsEventsTable.createdAt,
        employeeId: analyticsEventsTable.employeeId,
        sessionId: analyticsEventsTable.sessionId,
        metadata: analyticsEventsTable.metadata,
      })
      .from(analyticsEventsTable)
      .where(and(...filters))
      .orderBy(desc(analyticsEventsTable.createdAt))
      .limit(PRODUCT_ADDS_LIMIT);

    const productRow = await db
      .select({ id: productsTable.id, name: productsTable.name, sku: productsTable.sku })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    const employeeIds = Array.from(
      new Set(events.map((e) => e.employeeId).filter((v): v is string => v != null)),
    );
    const employeeNames = employeeIds.length > 0 ? await fetchEmployeeNames(employeeIds) : new Map();

    res.json({
      productId,
      name: productRow[0]?.name ?? null,
      sku: productRow[0]?.sku ?? null,
      range: `${days}d`,
      limit: PRODUCT_ADDS_LIMIT,
      truncated: events.length === PRODUCT_ADDS_LIMIT,
      events: events.map((e) => {
        const meta = (e.metadata ?? {}) as Record<string, unknown>;
        const qty = typeof meta.quantity === "number" ? meta.quantity : null;
        return {
          id: e.id,
          createdAt: e.createdAt,
          employeeId: e.employeeId,
          employeeName:
            e.employeeId && employeeNames.get(e.employeeId)
              ? employeeNames.get(e.employeeId)!
              : e.employeeId
              ? `Employee #${e.employeeId}`
              : null,
          sessionId: e.sessionId,
          quantity: qty,
        };
      }),
    });
  } catch (err) {
    logger.error({ err, productId: req.params.productId }, "Failed to load product adds");
    res.status(500).json({ error: "Failed to load product adds" });
  }
});

router.get("/admin/analytics/estimate-detail/:estimateId", requireAdmin, async (req, res) => {
  try {
    const estimateId = Number(req.params.estimateId);
    if (!Number.isInteger(estimateId) || estimateId <= 0) {
      return res.status(400).json({ error: "Invalid estimateId" });
    }

    const events = await db
      .select({
        id: analyticsEventsTable.id,
        createdAt: analyticsEventsTable.createdAt,
        employeeId: analyticsEventsTable.employeeId,
        sessionId: analyticsEventsTable.sessionId,
        metadata: analyticsEventsTable.metadata,
      })
      .from(analyticsEventsTable)
      .where(
        and(
          eq(analyticsEventsTable.eventType, "push_to_estimate"),
          sql`(${analyticsEventsTable.metadata}->>'estimateId') = ${String(estimateId)}`,
        ),
      )
      .orderBy(desc(analyticsEventsTable.createdAt))
      .limit(ESTIMATE_EVENTS_LIMIT);

    const employeeIds = Array.from(
      new Set(events.map((e) => e.employeeId).filter((v): v is string => v != null)),
    );
    const employeeNames = employeeIds.length > 0 ? await fetchEmployeeNames(employeeIds) : new Map();

    const enrichedEvents = events.map((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      return {
        id: e.id,
        createdAt: e.createdAt,
        employeeId: e.employeeId,
        employeeName:
          e.employeeId && employeeNames.get(e.employeeId)
            ? employeeNames.get(e.employeeId)!
            : e.employeeId
            ? `Employee #${e.employeeId}`
            : null,
        sessionId: e.sessionId,
        tranId: typeof meta.tranId === "string" ? meta.tranId : null,
        itemCount: typeof meta.itemCount === "number" ? meta.itemCount : null,
        lineCount: typeof meta.lineCount === "number" ? meta.lineCount : null,
        totalValue: typeof meta.totalValue === "number" ? meta.totalValue : null,
      };
    });

    let netsuite: {
      tranId: string | null;
      customerName: string | null;
      status: string | null;
      tranDate: string | null;
      total: number | null;
      items: Array<{
        netsuiteId: number | null;
        name: string | null;
        sku: string | null;
        quantity: number | null;
        amount: number | null;
      }>;
    } | null = null;
    let netsuiteError: string | null = null;

    if (isNetSuiteConfigured()) {
      try {
        const ns = await netsuiteRequest<{
          id?: number;
          tranId?: string;
          tranDate?: string;
          status?: { id?: string; refName?: string } | string;
          total?: number | string;
          entity?: { refName?: string };
          item?: {
            items?: Array<{
              item: { id: number; refName?: string };
              quantity?: number;
              amount?: number;
            }>;
          };
        }>(`/estimate/${estimateId}?expandSubResources=true`);

        const items = ns.item?.items ?? [];
        const itemIds = Array.from(
          new Set(items.map((it) => it.item?.id).filter((v): v is number => typeof v === "number")),
        );
        const dbItems = itemIds.length > 0
          ? await db
              .select({
                id: productsTable.id,
                netsuiteId: productsTable.netsuiteId,
                name: productsTable.name,
                sku: productsTable.sku,
              })
              .from(productsTable)
              .where(inArray(productsTable.netsuiteId, itemIds.map(String)))
          : [];
        const byNetsuiteId = new Map(dbItems.map((p) => [p.netsuiteId, p]));

        const statusLabel =
          typeof ns.status === "object" && ns.status
            ? ns.status.refName ?? ns.status.id ?? null
            : typeof ns.status === "string"
            ? ns.status
            : null;

        netsuite = {
          tranId: ns.tranId ?? null,
          customerName: ns.entity?.refName ?? null,
          status: statusLabel,
          tranDate: ns.tranDate ?? null,
          total: typeof ns.total === "number"
            ? ns.total
            : typeof ns.total === "string"
            ? parseFloat(ns.total)
            : null,
          items: items.map((it) => {
            const matched = it.item?.id != null ? byNetsuiteId.get(String(it.item.id)) : undefined;
            return {
              netsuiteId: it.item?.id ?? null,
              name: matched?.name ?? it.item?.refName ?? null,
              sku: matched?.sku ?? null,
              quantity: typeof it.quantity === "number" ? it.quantity : null,
              amount: typeof it.amount === "number" ? it.amount : null,
            };
          }),
        };
      } catch (err) {
        logger.warn({ err, estimateId }, "Failed to fetch estimate from NetSuite");
        netsuiteError = "Could not load live estimate detail from NetSuite.";
      }
    } else {
      netsuiteError = "NetSuite not configured.";
    }

    res.json({
      estimateId,
      events: enrichedEvents,
      netsuite,
      netsuiteError,
    });
  } catch (err) {
    logger.error({ err, estimateId: req.params.estimateId }, "Failed to load estimate detail");
    res.status(500).json({ error: "Failed to load estimate detail" });
  }
});

export default router;
