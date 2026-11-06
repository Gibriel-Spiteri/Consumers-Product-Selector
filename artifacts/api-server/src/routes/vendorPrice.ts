import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { requireEmployee } from "../lib/session";
import { getEmployeeByNetsuiteId, isAdminRecord } from "../lib/employees";
import {
  richelieu, richelieuPagePath, RICHELIEU_SECRET_NAMES, RichelieuBlockedError, RichelieuNotConfiguredError,
} from "../lib/richelieu";

// Vendor prices for QuickAdd (11/6/2026): Richelieu's price for the product page a rep has open, read on the server
// with Consumers' shared Richelieu account (lib/richelieu.ts). Signed-in employees only. Only the list price leaves
// the server: the QuickAdd panel can be in front of a customer.
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
    res.json({
      ok: true, listPrice: page.listPrice, currency: path.startsWith("/ca/") ? "CAD" : "USD",
      sku: page.sku, cached: page.cached, checkedAt: page.checkedAt,
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
  const out: Record<string, unknown> = { ...richelieu.status(), secretNames: RICHELIEU_SECRET_NAMES };
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

export default router;
