// New SOR (2026-11-12): start a Draft Sales Order Revision on an order with the Quote List already on it. The server
// side and its rules are in api-server lib/newSor.ts.

/** "SO714729", "so 714729", "714729" -> the digits; anything else -> null. */
export function orderDigits(q: string): string | null {
  const s = q.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  const m = s.match(/^(?:SO)?#?(\d{1,9})$/);
  return m ? m[1] : null;
}

/** One id per press of Create; a retry of the same press sends the same id, so the server never starts two. */
export function newAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.padEnd(20, "0");
}

export function createdSorMessage(sorNumber: string, soTranId: string, lineCount: number): string {
  return `Created ${sorNumber} on ${soTranId} with ${lineCount} item${lineCount === 1 ? "" : "s"} from your Quote List`;
}

/*
 * A Create whose answer never arrived (connection lost, page closed) is kept in this browser, so the Quote List asks
 * the server what happened before anything else: the items come off only when the revision really has them.
 */
export const PENDING_SOR_KEY = "cps-new-sor-pending";
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingNewSor<T = unknown> {
  attemptId: string;
  soId: string;
  soTranId: string;
  snapshot: T[];
  startedAt: number;
}

export function parsePendingSor<T = unknown>(raw: string | null, now = Date.now()): PendingNewSor<T> | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingNewSor<T>;
    if (!p || typeof p.attemptId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(p.attemptId)) return null;
    if (typeof p.soId !== "string" || !/^\d+$/.test(p.soId) || !Array.isArray(p.snapshot)) return null;
    if (!(typeof p.startedAt === "number" && now - p.startedAt < PENDING_MAX_AGE_MS)) return null;
    return p;
  } catch {
    return null;
  }
}

export function loadPendingSor<T = unknown>(): PendingNewSor<T> | null {
  try { return parsePendingSor<T>(localStorage.getItem(PENDING_SOR_KEY)); } catch { return null; }
}

export function savePendingSor(p: PendingNewSor): void {
  try { localStorage.setItem(PENDING_SOR_KEY, JSON.stringify(p)); } catch { /* the page still works while it stays open */ }
}

export function clearPendingSor(): void {
  try { localStorage.removeItem(PENDING_SOR_KEY); } catch { /* nothing to clear */ }
}
