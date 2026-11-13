// The Quote List's "Send to NetSuite" redesign (2026-11-13, Gib picked variant B of
// https://claude.ai/artifact/XVP62opudtXRsG2HTq6vRp). Behind a preview switch until Gib makes it the default:
// ?pushui=new turns it on in this browser, ?pushui=classic turns it off.

export type PushUi = "classic" | "new";
export const PUSH_UI_KEY = "cps-push-ui";

export function pushUiFrom(search: string, stored: string | null): { ui: PushUi; store: PushUi | null } {
  const param = new URLSearchParams(search).get("pushui");
  if (param === "new" || param === "classic") return { ui: param, store: param };
  return { ui: stored === "new" ? "new" : "classic", store: null };
}

export function readPushUi(): PushUi {
  try {
    const { ui, store } = pushUiFrom(window.location.search, localStorage.getItem(PUSH_UI_KEY));
    if (store) localStorage.setItem(PUSH_UI_KEY, store);
    return ui;
  } catch {
    return "classic";
  }
}

export function setPushUi(ui: PushUi): void {
  try { localStorage.setItem(PUSH_UI_KEY, ui); } catch { /* stays as it is */ }
}

/** What the one search box can search: an ES / SO / SOR number (3+ digits, SOR any) or 3+ letters of a name. */
export function searchableQuery(raw: string): string | null {
  const s = raw.trim();
  const compact = s.replace(/\s+/g, "").toUpperCase();
  const m = compact.match(/^(ES|SOR|SO)?#?(\d+)$/);
  if (m) return m[2].length <= 9 && (m[1] === "SOR" || m[2].length >= 3) ? compact : null;
  return s.length >= 3 && /^[A-Za-z][A-Za-z .'&-]*$/.test(s) ? s : null;
}

/** "104453 Baloga" (NetSuite's customer display) -> name "Baloga", number "104453". */
export function splitCustomer(display: string): { name: string; number: string | null } {
  const m = String(display ?? "").match(/^(\d+)\s+(.+)$/);
  return m ? { name: m[2], number: m[1] } : { name: String(display ?? ""), number: null };
}

/*
 * The records this browser last sent items to. Clicking one searches it again, so what it can take is always current.
 */
export const RECENT_KEY = "cps-push-recent";
export interface RecentTarget { label: string; customer: string; at: number }

export function withRecent(list: RecentTarget[], entry: RecentTarget, max = 5): RecentTarget[] {
  return [entry, ...list.filter(r => r.label !== entry.label)].slice(0, max);
}

export function loadRecent(): RecentTarget[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter(r => r && typeof r.label === "string" && typeof r.at === "number").slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function saveRecent(list: RecentTarget[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* the list is a convenience */ }
}

export function recentWhen(at: number, now = Date.now()): string {
  const day = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const days = Math.round((day(now) - day(at)) / 86400000);
  if (days <= 0) return "Sent today";
  if (days === 1) return "Sent yesterday";
  return `Sent ${new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
