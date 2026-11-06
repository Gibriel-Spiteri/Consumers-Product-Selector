import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { requireEmployee } from "../lib/session";
import { getEmployeeByNetsuiteId, isAdminRecord } from "../lib/employees";
import {
  richelieu, richelieuPagePath, RICHELIEU_SECRET_NAMES, RichelieuBlockedError, RichelieuNotConfiguredError,
} from "../lib/richelieu";

// Vendor prices for QuickAdd (11/6/2026): Richelieu's price for the product page a rep has open, read on the server
// with Consumers' shared Richelieu account (lib/richelieu.ts). Signed-in employees only. Only the list price leaves
// the server: the QuickAdd panel can be in front of a customer.
// 11/6: the price the shared sales login sees is Richelieu's list price (Gib, with screenshots), so that is what
// leaves the server; a corporate login's cost never does (its "Suggested retail" is taken instead).
const router: IRouter = Router();
router.use("/vendor-price", requireEmployee);

// A rep's browser asks once per Richelieu page (QuickAdd caches it too); this only stops a runaway loop.
const LOOKUPS_PER_HOUR = 300;
const lookups = new Map<string, number[]>();
function overLimit(employeeId: string): boolean {
  const now = Date.now();
  const recent = (lookups.get(employeeId) ?? []).filter(t => now - t < 3600_000);
  recent.push(now);
  lookups.set(employeeId, recent);
  return recent.length > LOOKUPS_PER_HOUR;
}

async function requireVendorPriceAdmin(_req: Request, res: Response, next: NextFunction) {
  const employee = await getEmployeeByNetsuiteId(res.locals.employeeId);
  if (!isAdminRecord(employee)) { res.status(403).json({ error: "Admin access required" }); return; }
  next();
}

const failure = (err: unknown) => {
  if (err instanceof RichelieuNotConfiguredError) return { status: 503, body: { error: "Richelieu pricing is not set up yet.", configured: false } };
  if (err instanceof RichelieuBlockedError) {
    return { status: 503, body: { error: `Richelieu prices are paused: ${err.message}.`, until: new Date(err.until).toISOString() } };
  }
  return { status: 502, body: { error: "Could not read the price from Richelieu." } };
};

router.get("/vendor-price/richelieu", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const path = richelieuPagePath(String(req.query.url ?? ""));
  if (!path) { res.status(400).json({ error: "Not a Richelieu product page." }); return; }
  if (!richelieu.configured()) { res.status(503).json({ error: "Richelieu pricing is not set up yet.", configured: false }); return; }
  if (overLimit(String(res.locals.employeeId))) { res.status(429).json({ error: "Too many Richelieu price lookups this hour." }); return; }
  try {
    const page = await richelieu.page(path);
    // res.json({
    //   ok: true, listPrice: page.listPrice, currency: path.startsWith("/ca/") ? "CAD" : "USD",
    //   sku: page.sku, cached: page.cached, checkedAt: page.checkedAt,
    // });
    // 11/6: the shared "Consumers Sales" login (the Replit Secrets) sees one price, Richelieu's list price (Gib checked
    // it against a corporate login, which shows our cost and the list price as "Suggested retail"). So SmartAdd fills
    // that price as the list price. A labeled list price ("Suggested retail") comes first, so a login that sees our
    // cost never fills it.
    const price = page.listPrice ?? page.accountPrice;
    res.json({
      // ok: true, listPrice: page.listPrice, price, priceKind: page.listPrice != null ? "list" : price != null ? "account" : null,
      ok: true, listPrice: page.listPrice ?? page.accountPrice, price, priceKind: price != null ? "list" : null,
      currency: path.startsWith("/ca/") ? "CAD" : "USD", sku: page.sku, cached: page.cached, checkedAt: page.checkedAt,
    });
  } catch (err) {
    const f = failure(err);
    req.log.warn({ path, error: err instanceof Error ? err.message : String(err) }, "Richelieu price lookup failed");
    res.status(f.status).json(f.body);
  }
});

// Admins: the sign-in state and, for one page, every amount the page shows with its words (to set up which one is the
// list price). Never the email, the password or the cookies.
router.get("/vendor-price/richelieu/status", requireVendorPriceAdmin, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  // const out: Record<string, unknown> = { ...richelieu.status(), secretNames: RICHELIEU_SECRET_NAMES };
  const out: Record<string, unknown> = { ...richelieu.status(), ...richelieu.browserSessionStatus(), secretNames: RICHELIEU_SECRET_NAMES };
  if (req.query.url) {
    const path = richelieuPagePath(String(req.query.url));
    if (!path) { out.pageError = "Not a Richelieu product page."; res.json(out); return; }
    try {
      out.page = await richelieu.page(path, { fresh: req.query.fresh === "1", diagnostics: req.query.markup === "1" });
    } catch (err) {
      out.pageError = failure(err).body.error;
    }
    Object.assign(out, richelieu.status());
  }
  res.json(out);
});

// 11/6 (Gib, "#3"): sign a sales rep's browser in to richelieu.com. SmartAdd asks when a Richelieu page shows the
// browser signed out; the server opens a NEW session with the shared account and hands its cookies to SmartAdd, which
// sets them in that browser only (until it closes). Gib chose this knowing that anyone at that browser can use the
// Consumers Richelieu account and that Richelieu may end sessions it does not like. Signed-in employees only; a few per
// hour per employee; each one is logged with the employee (never the cookies).
router.use("/vendor-session", requireEmployee);
const SESSIONS_PER_HOUR = 6;
const sessionsGiven = new Map<string, number[]>();
router.post("/vendor-session/richelieu", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  if (!richelieu.configured()) { res.status(503).json({ error: "Richelieu sign-in is not set up yet.", configured: false }); return; }
  const employeeId = String(res.locals.employeeId);
  const now = Date.now();
  const recent = (sessionsGiven.get(employeeId) ?? []).filter(t => now - t < 3600_000);
  if (recent.length >= SESSIONS_PER_HOUR) { res.status(429).json({ error: "Too many Richelieu sign-ins this hour." }); return; }
  try {
    const cookies = await richelieu.browserSession();
    if (!cookies.length) { res.status(502).json({ error: "Richelieu gave no session." }); return; }
    recent.push(now);
    sessionsGiven.set(employeeId, recent);
    req.log.info({ employeeId, cookies: cookies.map(c => c.name) }, "Richelieu session handed to a browser");
    res.json({ ok: true, cookies });
  } catch (err) {
    const f = failure(err);
    req.log.warn({ employeeId, error: err instanceof Error ? err.message : String(err) }, "Richelieu browser sign-in failed");
    res.status(f.status).json({ ...f.body, error: String(f.body.error).replace("Richelieu prices are paused", "Richelieu sign-in is paused").replace("Could not read the price from Richelieu.", "Could not sign in to Richelieu.") });
  }
});

export default router;
