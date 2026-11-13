/**
 * nsGuard: one shared way for our apps to call NetSuite without losing work
 * when the account's concurrency limit is full.
 *
 * Copy this file as-is into an app (for Replit apps: artifacts/api-server/src/lib/nsGuard.ts)
 * and send every NetSuite HTTP call through guardedFetch(). It has no dependencies.
 *
 * What it does
 *  1. Per-app limiter: at most NS_MAX_IN_FLIGHT requests from this process at once (default 2).
 *     The whole account only allows 5, shared by every app and script.
 *  2. Retries a request NetSuite REFUSED for concurrency (HTTP 429, or a body containing
 *     SSS_REQUEST_LIMIT_EXCEEDED / CONCURRENCY_LIMIT_EXCEEDED / "Request Limit Exceeded").
 *     A refused request was never run, so retrying it is safe for writes too.
 *     Same ~30 s window as the Product Selector (RETRY_429_DELAYS_MS, 2026-11-13), plus jitter,
 *     and it honors a Retry-After header when NetSuite sends one.
 *  3. Retries 502/503/504 and network errors ONLY for reads (GET/HEAD, SuiteQL POSTs), or for a
 *     write the caller marks idempotent (for example a PATCH that sets fixed values, or a create
 *     that carries an externalId). A write that timed out may have run, so it is not retried blind.
 *  4. Counts every call, refusal, retry and final failure (getNsStats()), so the app can show
 *     them at /api/ns-health and the concurrency dashboard can read them.
 *
 * What it does NOT do: keep work that still fails after the window. Callers that write must catch
 * NetSuiteBusyError and put the write in their outbox (see OUTBOX.md) instead of dropping it.
 */

export const RETRY_DELAYS_MS = [500, 1000, 1500, 2000, 2500, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000];
const TRANSIENT_STATUS = new Set([502, 503, 504]);
const BUSY_TEXT = /SSS_REQUEST_LIMIT_EXCEEDED|CONCURRENCY_LIMIT_EXCEEDED|Request Limit Exceeded|concurrent request limit/i;

/** Thrown when NetSuite was still busy (or unreachable) after the whole retry window. */
export class NetSuiteBusyError extends Error {
  constructor(message: string, readonly status: number | null, readonly attempts: number) {
    super(message);
    this.name = "NetSuiteBusyError";
  }
}

// ---------------------------------------------------------------- limiter

const MAX_IN_FLIGHT = Math.max(1, Number(process.env.NS_MAX_IN_FLIGHT || process.env.NETSUITE_MAX_CONCURRENCY) || 2);
let inFlight = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  while (inFlight >= MAX_IN_FLIGHT) await new Promise<void>(resolve => waiting.push(resolve));
  inFlight += 1;
  try {
    return await work();
  } finally {
    inFlight -= 1;
    waiting.shift()?.();
  }
}

// ---------------------------------------------------------------- stats

type Hour = { hour: string; calls: number; refused: number; retries: number; failed: number; recovered: number };
const hours = new Map<string, Hour>();
const recentFailures: Array<{ at: string; label: string; status: number | null; message: string }> = [];
const startedAt = new Date().toISOString();

function bucket(): Hour {
  const key = new Date().toISOString().slice(0, 13) + ":00Z";
  let h = hours.get(key);
  if (!h) {
    h = { hour: key, calls: 0, refused: 0, retries: 0, failed: 0, recovered: 0 };
    hours.set(key, h);
    // keep 7 days
    const keys = [...hours.keys()].sort();
    while (keys.length > 168) hours.delete(keys.shift()!);
  }
  return h;
}

/** Hourly counts since the process started (last 7 days), newest last, plus the latest final failures. */
export function getNsStats() {
  const list = [...hours.values()].sort((a, b) => a.hour.localeCompare(b.hour));
  const total = list.reduce(
    (t, h) => ({ calls: t.calls + h.calls, refused: t.refused + h.refused, retries: t.retries + h.retries, failed: t.failed + h.failed, recovered: t.recovered + h.recovered }),
    { calls: 0, refused: 0, retries: 0, failed: 0, recovered: 0 },
  );
  return { since: startedAt, maxInFlight: MAX_IN_FLIGHT, inFlight, queued: waiting.length, total, hours: list, recentFailures: [...recentFailures] };
}

/** Optional hook: log or persist events (e.g. to a table). Must never throw. */
export let onNsEvent: (event: { kind: "refused" | "retry" | "failed" | "recovered"; label: string; status: number | null; attempt: number; message?: string }) => void = () => {};
export function setNsEventHook(hook: typeof onNsEvent) { onNsEvent = hook; }

function note(kind: "refused" | "retry" | "failed" | "recovered", label: string, status: number | null, attempt: number, message?: string) {
  const h = bucket();
  if (kind === "refused") h.refused += 1;
  if (kind === "retry") h.retries += 1;
  if (kind === "recovered") h.recovered += 1;
  if (kind === "failed") {
    h.failed += 1;
    recentFailures.push({ at: new Date().toISOString(), label, status, message: (message ?? "").slice(0, 300) });
    if (recentFailures.length > 50) recentFailures.shift();
  }
  try { onNsEvent({ kind, label, status, attempt, message }); } catch { /* never let telemetry break a call */ }
}

// ---------------------------------------------------------------- the guarded fetch

export type GuardOptions = {
  /** Short label for logs and the dashboard, e.g. "PRO photo upload". Defaults to METHOD + path. */
  label?: string;
  /** Safe to repeat even if a previous attempt may have run (reads, fixed-value PATCH, externalId upsert). */
  idempotent?: boolean;
  /** Per-attempt timeout (default 90 s; 0 = none). NetSuite can accept a request under load and never answer. */
  timeoutMs?: number;
  /** Return NetSuite's last refusal (429) instead of throwing NetSuiteBusyError, for callers that already handle it. */
  returnBusyResponse?: boolean;
  /** Override the retry ladder (tests). */
  delaysMs?: number[];
  /** Override fetch (tests). */
  fetchImpl?: typeof fetch;
};

function isReadRequest(url: string, method: string): boolean {
  if (method === "GET" || method === "HEAD") return true;
  return method === "POST" && /\/services\/rest\/query\/v1\/suiteql/i.test(url);
}

function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("retry-after");
  if (!raw) return null;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.min(30_000, Math.max(0, secs * 1000));
  const when = Date.parse(raw);
  return Number.isFinite(when) ? Math.min(30_000, Math.max(0, when - Date.now())) : null;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * fetch() for NetSuite. Returns the final Response (which may still be a non-OK answer such as
 * 400 validation errors; the caller handles those as before). Throws NetSuiteBusyError when the
 * account stayed full, or the network failed, for the whole retry window.
 */
export async function guardedFetch(url: string, init: RequestInit = {}, options: GuardOptions = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const label = options.label ?? `${method} ${url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]}`;
  const delays = options.delaysMs ?? RETRY_DELAYS_MS;
  const doFetch = options.fetchImpl ?? fetch;
  const canRetryTransient = options.idempotent ?? isReadRequest(url, method);
  const timeoutMs = options.timeoutMs ?? 90_000;
  let refusedOnce = false;

  for (let attempt = 0; ; attempt++) {
    const delay = delays[attempt];
    if (attempt === 0) bucket().calls += 1;
    let res: Response | null = null;
    let networkError: unknown = null;
    try {
      res = await withSlot(async () => {
        const controller = new AbortController();
        const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
        try {
          return await doFetch(url, { ...init, signal: init.signal ?? (timeoutMs > 0 ? controller.signal : undefined) });
        } finally {
          if (timer) clearTimeout(timer);
        }
      });
    } catch (err) {
      networkError = err;
    }

    if (res) {
      let busy = res.status === 429;
      if (!busy && (res.status === 400 || res.status === 403 || res.status >= 500)) {
        // RESTlets and some REST errors report the concurrency refusal in the body, not as 429.
        const text = await res.clone().text().catch(() => "");
        busy = BUSY_TEXT.test(text);
      }
      if (busy) {
        refusedOnce = true;
        note("refused", label, res.status, attempt + 1);
        if (delay === undefined) {
          const text = await res.clone().text().catch(() => "");
          note("failed", label, res.status, attempt + 1, text);
          if (options.returnBusyResponse) return res;
          throw new NetSuiteBusyError(`NetSuite stayed busy for ${label} after ${attempt + 1} tries`, res.status, attempt + 1);
        }
        await res.body?.cancel().catch(() => {});
        note("retry", label, res.status, attempt + 1);
        await sleep((retryAfterMs(res) ?? delay) + Math.floor(Math.random() * 250));
        continue;
      }
      if (TRANSIENT_STATUS.has(res.status) && canRetryTransient && delay !== undefined) {
        await res.body?.cancel().catch(() => {});
        note("retry", label, res.status, attempt + 1);
        await sleep(delay + Math.floor(Math.random() * 250));
        continue;
      }
      if (refusedOnce && res.ok) note("recovered", label, res.status, attempt + 1);
      return res;
    }

    // network error or timeout
    const message = networkError instanceof Error ? networkError.message : String(networkError);
    if (canRetryTransient && delay !== undefined) {
      note("retry", label, null, attempt + 1, message);
      await sleep(delay + Math.floor(Math.random() * 250));
      continue;
    }
    note("failed", label, null, attempt + 1, message);
    throw new NetSuiteBusyError(`NetSuite call ${label} failed: ${message}`, null, attempt + 1);
  }
}
