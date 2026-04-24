type EventType =
  | "page_view"
  | "category_view"
  | "product_view"
  | "product_modal_open"
  | "search";

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

function getApiBase(): string {
  const base = (import.meta as any).env?.BASE_URL || "/";
  return `${String(base).replace(/\/$/, "")}/api`;
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
let identity: { employeeId: string | null; employeeName: string | null } = {
  employeeId: null,
  employeeName: null,
};
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
    employeeId: identity.employeeId,
    employeeName: identity.employeeName,
    events,
  });
  const url = `${getApiBase()}/analytics/event`;
  try {
    if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
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
  if (queue.length >= 20) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush(false);
  } else {
    scheduleFlush();
  }
}

export function setAnalyticsIdentity(employeeId: string | null, employeeName: string | null) {
  identity = { employeeId, employeeName };
}

export function trackPageView(path: string) {
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;
  enqueue({ eventType: "page_view", path });
}

export function trackCategoryView(path: string, categoryId: number | null | undefined) {
  enqueue({ eventType: "category_view", path, categoryId: categoryId ?? null });
}

export function trackProductView(productId: number, path?: string) {
  enqueue({ eventType: "product_view", productId, path: path ?? null });
}

export function trackProductModalOpen(productId: number, path?: string) {
  enqueue({ eventType: "product_modal_open", productId, path: path ?? null });
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
  if (flushTimer) clearTimeout(flushTimer);
  if (intervalTimer) clearInterval(intervalTimer);
  flushTimer = null;
  intervalTimer = null;
}
