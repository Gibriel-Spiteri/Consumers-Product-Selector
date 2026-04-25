type EventType =
  | "page_view"
  | "category_view"
  | "product_modal_open"
  | "search"
  | "add_to_list"
  | "push_to_estimate";

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
    // On page-hide / visibility-hidden flushes, use sendBeacon: it is the
    // most reliable transport during unload. sendBeacon cannot set custom
    // headers, so identity is omitted — these unload-time flushes will be
    // recorded as anonymous, which is an acceptable trade-off because the
    // bulk of events have already been flushed via the debounced/interval
    // path below (which does attach the X-Employee-Id header).
    if (
      useBeacon &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([payload], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
    // Normal debounced / interval flush: use fetch with keepalive so the
    // X-Employee-Id header travels with the request and identity is
    // server-attached from a trusted source.
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (employeeId) headers["X-Employee-Id"] = employeeId;
    await fetch(url, {
      method: "POST",
      headers,
      body: payload,
      keepalive: true,
      credentials: "same-origin",
    });
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
  employeeId = id;
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
