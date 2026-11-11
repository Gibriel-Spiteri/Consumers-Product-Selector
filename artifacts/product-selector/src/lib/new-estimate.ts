// New estimate from the Quote List through NetSuite's Customer Search pop-up (2026-11-11). The server side and the
// three steps are explained in api-server lib/estimateHandoff.ts.

export const POPUP_NAME = "cps-new-estimate";

/** A centered pop-up, as large as NetSuite's Customer Search needs (it is the Sales Appointments search page). */
export function popupFeatures(screenWidth: number, screenHeight: number): string {
  const width = Math.min(1100, Math.max(600, screenWidth - 80));
  const height = Math.min(900, Math.max(500, screenHeight - 120));
  const left = Math.max(0, Math.round((screenWidth - width) / 2));
  const top = Math.max(0, Math.round((screenHeight - height) / 2));
  return `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

export interface EstimateCreatedMessage {
  estimateId: string | number;
  tranId: string;
}

/**
 * The NetSuite pop-up's "estimate created" message, or null for anything else. Only a message from NetSuite's own
 * origin (from the server, never from the page) for this hand-off counts. It only says when to check: the server
 * confirms the estimate in NetSuite before anything leaves the Quote List.
 */
export function readEstimateCreatedMessage(
  event: { origin: string; data: unknown },
  expected: { origin: string; token: string },
): EstimateCreatedMessage | null {
  if (!expected.origin || event.origin !== expected.origin) return null;
  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return null;
  if (data.source !== "consumers-netsuite" || data.type !== "cps-estimate-created" || data.token !== expected.token) return null;
  const estimateId = data.estimateId;
  if (!(typeof estimateId === "string" || typeof estimateId === "number") || !/^[1-9]\d{0,9}$/.test(String(estimateId))) return null;
  return { estimateId, tranId: typeof data.tranId === "string" ? data.tranId : "" };
}

/*
 * The open hand-off is also kept in this browser, so the Quote List still takes the items off if the rep leaves the
 * page or reloads it while the pop-up is open: on its return the page checks NetSuite for the estimate first.
 */
export const PENDING_KEY = "cps-new-estimate-pending";
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingHandoff<T = unknown> {
  token: string;
  netsuiteOrigin: string;
  snapshot: T[];
  skipped: string[];
  startedAt: number;
}

export function parsePending<T = unknown>(raw: string | null, now = Date.now()): PendingHandoff<T> | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingHandoff<T>;
    if (!p || typeof p.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(p.token)) return null;
    if (typeof p.netsuiteOrigin !== "string" || !Array.isArray(p.snapshot) || !Array.isArray(p.skipped)) return null;
    if (!(typeof p.startedAt === "number" && now - p.startedAt < PENDING_MAX_AGE_MS)) return null;
    return p;
  } catch {
    return null;
  }
}

export function loadPending<T = unknown>(): PendingHandoff<T> | null {
  try { return parsePending<T>(localStorage.getItem(PENDING_KEY)); } catch { return null; }
}

export function savePending(p: PendingHandoff): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* the page still works while it stays open */ }
}

export function clearPending(): void {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* nothing to clear */ }
}

/** The success line on the Quote List. */
export function createdMessage(tranId: string, customerName: string, lineCount: number): string {
  const lines = `${lineCount} item${lineCount === 1 ? "" : "s"}`;
  return `Created estimate ${tranId}${customerName ? ` for ${customerName}` : ""} with ${lines} from your Quote List`;
}
