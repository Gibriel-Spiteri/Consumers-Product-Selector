import { fetchNetSuite, getAccessToken, getBaseUrl } from "./netsuite";
import { logger } from "./logger";

/*
 * After a push, NetSuite refreshes the estimate with its own discount engine (2026-11-09, Gib: "Pushing from the
 * CPS should recalc PRAs on the Estimate").
 *
 * The push is a REST save, and NetSuite does not run the estimate's script (Estimate_UserEvents) for REST saves,
 * so the deposit, verification deposit, drop-ship backfill and delivery-tax backstop were left as they were, and
 * no promotion covered the new lines (ES241850, 11/9). The engine is the Suitelet behind "Apply / Recalculate
 * Discounts" (customscript_recalcpras, recalc_pras.js): it takes every discount off and puts it back in apply
 * order, each step a scripted save that runs the estimate's script. With resave=T it also saves the estimate
 * once when it changed no discount (no discounts, only order-level ones, or a refusal), and its last redirect
 * says which happened: rcresult=repriced | saved | notsaved.
 *
 * The engine works in passes; a pass that runs out of NetSuite governance redirects to the next one, the way a
 * browser follows it. This follows those redirects with the integration's OAuth 2.0 token and stops at the
 * redirect back to the estimate. A pass can take a minute on a large estimate.
 */

export type DiscountRefreshStatus = "repriced" | "saved" | "notsaved" | "unknown";

export interface DiscountRefreshResult {
  status: DiscountRefreshStatus;
  /** The engine's own note for staff (a discount that did not go back on, a refusal), or null. */
  warning: string | null;
  passes: number;
  seconds: number;
}

export type RecalcRedirect =
  | { kind: "pass"; url: string }
  | { kind: "done"; status: DiscountRefreshStatus; warning: string | null }
  | { kind: "signin"; url: string };

const MAX_HOPS = 14; // the engine stops itself at 12 passes (RC_MAX_PASSES)

export function appBaseUrl(): string {
  return getBaseUrl().replace(".suitetalk.api.netsuite.com", ".app.netsuite.com");
}

export function recalcStartUrl(estimateId: number, base = appBaseUrl()): string {
  return `${base}/app/site/hosting/scriptlet.nl?script=customscript_recalcpras&deploy=customdeploy1` +
    `&recid=${estimateId}&rectype=estimate&resave=T`;
}

/** Where one engine response points: another pass, the estimate (done), or NetSuite's sign-in page. */
export function readRecalcRedirect(location: string, from: string): RecalcRedirect {
  const url = new URL(location, from);
  if (url.pathname.endsWith("/app/site/hosting/scriptlet.nl")) return { kind: "pass", url: url.href };
  if (url.pathname.startsWith("/app/accounting/transactions/")) {
    const rc = url.searchParams.get("rcresult");
    const status: DiscountRefreshStatus = rc === "repriced" || rc === "saved" || rc === "notsaved" ? rc : "unknown";
    const alert = url.searchParams.get("topalert");
    return { kind: "done", status, warning: alert ? alert.replace(/^DISCOUNTS:\s*/, "") : null };
  }
  return { kind: "signin", url: url.href };
}

export async function refreshEstimateDiscounts(
  estimateId: number,
  deps: { fetch: typeof fetchNetSuite; token: () => Promise<string> } = { fetch: fetchNetSuite, token: getAccessToken },
): Promise<DiscountRefreshResult> {
  const started = Date.now();
  let url = recalcStartUrl(estimateId);
  for (let hop = 1; hop <= MAX_HOPS; hop++) {
    const t0 = Date.now();
    // GET only: the engine does its work on GET (a bearer POST to app pages is refused).
    const response = await deps.fetch(url, {
      headers: { Authorization: `Bearer ${await deps.token()}` },
      redirect: "manual",
    });
    const location = response.headers.get("location");
    await response.text().catch(() => "");
    logger.info({ estimateId, hop, status: response.status, ms: Date.now() - t0 }, "Estimate discount refresh pass");
    if (response.status < 300 || response.status >= 400 || !location) {
      throw new Error(`NetSuite's discount engine answered HTTP ${response.status} instead of a redirect`);
    }
    const next = readRecalcRedirect(location, url);
    if (next.kind === "signin") {
      throw new Error("NetSuite did not accept the app's sign-in for its discount engine");
    }
    if (next.kind === "done") {
      return { status: next.status, warning: next.warning, passes: hop, seconds: Math.round((Date.now() - started) / 1000) };
    }
    url = next.url;
  }
  throw new Error(`NetSuite's discount engine did not finish within ${MAX_HOPS} passes`);
}
