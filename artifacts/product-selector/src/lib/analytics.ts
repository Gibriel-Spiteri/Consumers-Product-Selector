type EventType =
  | "page_view"
  | "category_view"
  | "product_modal_open"
  | "search"
  | "add_to_list"
  | "push_to_estimate"
  | "vendor_site_visit"
  | "quickadd_capture";

interface QueuedEvent {
  eventType: EventType;
  path?: string | null;
  categoryId?: number | null;
  productId?: number | null;
  metadata?: Record<string, unknown> | null;
}

const SESSION_KEY = "ps_analytics_session";
const FLUSH_DEBOUNCE_MS = 1500;
const FLUSH_INTERVAL_MS = 15_000;
const FLUSH_BATCH_THRESHOLD = 20;

function getApiBase(): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/api`;
}

function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fallthrough */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = generateId();
    sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return generateId();
  }
}

let queue: QueuedEvent[] = [];
let employeeId: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;
let lastTrackedPath: string | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush(false);
  }, FLUSH_DEBOUNCE_MS);
}

async function flush(useBeacon: boolean) {
  if (queue.length === 0) return;
  const events = queue;
  queue = [];
  const payload = JSON.stringify({
    sessionId: getSessionId(),
    events,
  });
  const url = `${getApiBase()}/analytics/event`;
  try {
    // keepalive preserves signed identity even on tab hiding/unload; sendBeacon
    // cannot send the Authorization header and previously lost attribution.
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = localStorage.getItem("ps_session");
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: payload,
      keepalive: true,
      credentials: "same-origin",
    });
    // Retry only definite pre-insert rejections, never ambiguous network failures
    // (which could have inserted events and would double counts on retry).
    if (response.status === 429) queue = [...events, ...queue].slice(-200);
  } catch {
    /* swallow — analytics must never break the app */
  }
}

function attachListenersOnce() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  const onHide = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush(true);
  };
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
  });
  window.addEventListener("pagehide", onHide);
  window.addEventListener("beforeunload", onHide);
  intervalTimer = setInterval(() => void flush(false), FLUSH_INTERVAL_MS);
}

function shouldSkipPath(path: string): boolean {
  return path.startsWith("/admin");
}

function enqueue(event: QueuedEvent) {
  if (typeof window === "undefined") return;
  attachListenersOnce();
  if (event.path && shouldSkipPath(event.path)) return;
  queue.push(event);
  if (queue.length >= FLUSH_BATCH_THRESHOLD) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush(false);
  } else {
    scheduleFlush();
  }
}

export function setAnalyticsIdentity(id: string | null) {
  if (id !== employeeId) {
    // Do not attribute queued events from another signed-in user to the new user.
    queue = [];
    lastTrackedPath = null;
  }
  employeeId = id;
}

export function trackVendorSiteVisit(line: { id: string; name: string; websiteUrl?: string | null }) {
  if (!line.websiteUrl) return;
  enqueue({
    eventType: "vendor_site_visit", path: currentPath(),
    metadata: { pageUrl: line.websiteUrl, productLineId: line.id, productLineName: line.name, source: "cps_link" },
  });
}

export function trackSpecialOrderAdd(input: {
  sku?: string | null; quantity: number;
  details: { productLineId: string; productLineName: string; description?: string; model?: string };
  vendorPick?: { vendorDomain: string; pageUrl: string };
}) {
  enqueue({ eventType: "add_to_list", path: currentPath(), metadata: {
    quantity: input.quantity, productName: `${input.details.productLineName} Special Order`,
    sku: input.sku, productLineId: input.details.productLineId,
    model: input.details.model, source: input.vendorPick ? "quickadd" : "manual_special_order",
    vendorDomain: input.vendorPick?.vendorDomain,
  } });
}

export function trackPageView(path: string) {
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;
  enqueue({ eventType: "page_view", path });
}

export function trackCategoryView(path: string, categoryId: number | null | undefined) {
  enqueue({ eventType: "category_view", path, categoryId: categoryId ?? null });
}

function currentPath(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname + window.location.search;
}

export function trackProductModalOpen(productId: number, path?: string) {
  enqueue({ eventType: "product_modal_open", productId, path: path ?? currentPath() });
}

export function trackAddToList(
  productId: number,
  quantity: number,
  productName?: string,
  sku?: string | null,
) {
  if (!Number.isFinite(productId)) return;
  enqueue({
    eventType: "add_to_list",
    productId,
    path: currentPath(),
    metadata: {
      quantity,
      productName: productName ?? null,
      sku: sku ?? null,
    },
  });
}

export function trackPushToEstimate(payload: {
  estimateId: number | string;
  tranId: string;
  itemCount: number;
  lineCount: number;
  totalValue: number;
}) {
  enqueue({
    eventType: "push_to_estimate",
    path: currentPath(),
    metadata: {
      estimateId: payload.estimateId,
      tranId: payload.tranId,
      itemCount: payload.itemCount,
      lineCount: payload.lineCount,
      totalValue: payload.totalValue,
    },
  });
}

export function trackSearch(query: string, resultsCount?: number) {
  enqueue({
    eventType: "search",
    path: `/search/${encodeURIComponent(query)}`,
    metadata: { query, resultsCount: resultsCount ?? null },
  });
}

export function _resetForTests() {
  queue = [];
  lastTrackedPath = null;
  employeeId = null;
  if (flushTimer) clearTimeout(flushTimer);
  if (intervalTimer) clearInterval(intervalTimer);
  flushTimer = null;
  intervalTimer = null;
}
