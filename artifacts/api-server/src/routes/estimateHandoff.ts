import { Router, type IRouter } from "express";
import { isNetSuiteConfigured } from "../lib/netsuite";
import { logger } from "../lib/logger";
import { EstimateItemsSchema, SpecialOrderValidationError } from "../lib/specialOrders";
import { bearerToken, requireEmployee } from "../lib/session";
import { estimateSessionId, recordEstimatePush } from "../lib/estimate-analytics";
import { trackingId, vendorDomain } from "../lib/vendor-conversions";
import { appBaseUrl } from "../lib/estimateRefresh";
import {
  activeItems, deleteHandoff, findHandoffEstimate, handoffExternalId, handoffLabels, handoffPopupUrl, HANDOFF_TTL_MS,
  isHandoffToken, loadHandoff, newHandoffToken, priceHandoffLines, purgeExpiredHandoffs, saveHandoff,
} from "../lib/estimateHandoff";

/*
 * New estimate from the Quote List through NetSuite's Customer Search pop-up (2026-11-11). lib/estimateHandoff.ts
 * explains the three steps. The rep's own routes need the CPS sign-in; the read that NetSuite's server makes is
 * authorized by the one-time token and the NetSuite user, who must be the rep who started the hand-off.
 */
const router: IRouter = Router();
router.use("/estimates/handoff", requireEmployee);

const busy = (err: unknown) => / 429 /.test(String((err as any)?.message));

// 1. Store the Quote List and return the pop-up URL.
router.post("/estimates/handoff", async (req, res) => {
  const parsed = EstimateItemsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid quote items", details: parsed.error.issues });
  if (!isNetSuiteConfigured()) return res.status(503).json({ error: "NetSuite not configured" });
  try {
    const items = parsed.data.items;
    const catalog = await activeItems(items.map(i => i.netsuiteId));
    const invalidIds = Array.from(new Set(items.map(i => String(i.netsuiteId)).filter(id => !catalog.has(id))));
    const goodItems = items.filter(i => catalog.has(String(i.netsuiteId)));
    if (goodItems.length === 0) {
      return res.status(400).json({
        error: "None of the items can go on an estimate: they no longer exist in NetSuite.",
        invalidNetsuiteIds: invalidIds,
      });
    }
    // Every special order is checked now, so a problem shows here and not after the rep has picked the customer.
    // The prices themselves are worked out again for the chosen customer.
    await priceHandoffLines(goodItems, { customerCategory: "1", estimateCategory: "1", location: null }, catalog);

    await purgeExpiredHandoffs().catch(err => logger.warn({ err }, "Could not purge expired estimate hand-offs"));
    const token = newHandoffToken();
    const now = Date.now();
    await saveHandoff(token, {
      employeeId: String(res.locals.employeeId),
      items: goodItems,
      labels: handoffLabels(goodItems, catalog),
      analyticsSessionId: estimateSessionId(parsed.data.analyticsSessionId, bearerToken(req)!),
      createdAt: now,
      expiresAt: now + HANDOFF_TTL_MS,
    });
    logger.info({ employeeId: res.locals.employeeId, lines: goodItems.length, skipped: invalidIds }, "Started a new-estimate hand-off");
    const netsuiteOrigin = appBaseUrl();
    return res.json({
      token,
      url: handoffPopupUrl(token, netsuiteOrigin),
      // The only origin the Quote List takes the pop-up's message from.
      netsuiteOrigin,
      expiresAt: now + HANDOFF_TTL_MS,
      skippedNetsuiteIds: invalidIds,
    });
  } catch (err: any) {
    if (err instanceof SpecialOrderValidationError) return res.status(400).json({ error: err.message });
    logger.error({ err }, "Could not start a new-estimate hand-off");
    if (busy(err)) return res.status(503).json({ error: "NetSuite is busy right now. Wait a few seconds and try again." });
    return res.status(500).json({ error: "Could not start the new estimate. Try again." });
  }
});

// 2. NetSuite's server reads the hand-off: the item names for the pop-up, or the lines priced for the chosen customer.
router.get("/handoff/estimate/:token", async (req, res) => {
  const token = String(req.params.token ?? "");
  if (!isHandoffToken(token)) return res.status(400).json({ error: "This link from the Product Selector is not valid. Start again from the Quote List." });
  const q = (name: string) => (typeof req.query[name] === "string" ? String(req.query[name]).trim() : "");
  const employeeId = q("employeeId");
  try {
    const handoff = await loadHandoff(token);
    if (!handoff) {
      return res.status(404).json({ error: "This Quote List hand-off has expired or was already used. Start again from the Quote List." });
    }
    if (!employeeId || employeeId !== handoff.employeeId) {
      logger.warn({ employeeId, startedBy: handoff.employeeId }, "New-estimate hand-off read by a different NetSuite user");
      return res.status(403).json({ error: "This Quote List was sent by a different user. Sign in to NetSuite as yourself, or start again from your own Quote List." });
    }
    const customerId = q("customerId");
    if (!customerId) return res.json({ items: handoff.labels });
    if (!/^[1-9]\d{0,9}$/.test(customerId)) return res.status(400).json({ error: "Invalid customer" });
    const category = /^\d{1,4}$/.test(q("customerCategory")) ? q("customerCategory") : null;
    const location = /^\d{1,6}$/.test(q("location")) ? q("location") : null;
    // A new estimate's Customer Category is the customer's (the estimate form sets it from the customer).
    const lines = await priceHandoffLines(handoff.items, { customerCategory: category, estimateCategory: category, location });
    logger.info({ employeeId, customerId, lines: lines.length }, "Priced a new-estimate hand-off for NetSuite");
    return res.json({ lines, externalId: handoffExternalId(token) });
  } catch (err: any) {
    if (err instanceof SpecialOrderValidationError) return res.status(400).json({ error: err.message });
    logger.error({ err }, "Could not read a new-estimate hand-off");
    if (busy(err)) return res.status(503).json({ error: "The Product Selector found NetSuite busy. Wait a few seconds and press Create Estimate again." });
    return res.status(500).json({ error: "The Product Selector could not read the Quote List. Press Create Estimate again." });
  }
});

// One confirm per hand-off at a time: the pop-up's message and the window closing can both ask.
const confirmsRunning = new Map<string, Promise<{ status: number; body: unknown }>>();

async function confirmHandoff(token: string, employeeId: string, userAgent: string | null) {
  const estimate = await findHandoffEstimate(token);
  const handoff = await loadHandoff(token, 0); // an expired hand-off still says who started it and what it held
  if (handoff && handoff.employeeId !== employeeId) {
    return { status: 403, body: { error: "This Quote List hand-off was started by a different user." } };
  }
  if (!estimate) {
    return { status: 404, body: { error: "NetSuite has no estimate from this Quote List yet.", code: "NOT_CREATED" } };
  }
  const lines = handoff?.items ?? [];
  if (handoff) {
    await recordEstimatePush(`handoff-${token}`, {
      employeeId,
      sessionId: handoff.analyticsSessionId ?? `handoff:${token.slice(0, 16)}`,
      path: "/list",
      userAgent,
      metadata: {
        estimateId: estimate.id,
        tranId: estimate.tranId,
        newEstimate: true,
        itemCount: lines.reduce((sum, item) => sum + item.quantity, 0),
        lineCount: lines.length,
        specialOrderLines: lines.filter(item => item.specialOrder).map(item => ({
          productLineId: item.specialOrder!.productLineId,
          productLineName: item.specialOrder!.productLineName,
          quantity: item.quantity,
          vendorDomain: vendorDomain(item.analyticsVendorPick?.vendorDomain),
          pickId: trackingId(item.analyticsVendorPick?.pickId),
          visitId: trackingId(item.analyticsVendorPick?.visitId),
        })),
        totalValue: lines.length > 0 && lines.every(item => item.analyticsUnitPrice != null)
          ? lines.reduce((sum, item) => sum + item.analyticsUnitPrice! * item.quantity, 0) : null,
      },
    });
    await deleteHandoff(token);
  }
  logger.info({ employeeId, estimateId: estimate.id, tranId: estimate.tranId, lines: lines.length }, "Confirmed a new estimate from the Quote List");
  return { status: 200, body: { success: true, estimateId: estimate.id, tranId: estimate.tranId, customerName: estimate.customerName } };
}

// 3. The Quote List confirms the estimate NetSuite created (it looks it up by its externalid; the page's word is not enough).
router.post("/estimates/handoff/:token/confirm", async (req, res) => {
  const token = String(req.params.token ?? "");
  if (!isHandoffToken(token)) return res.status(400).json({ error: "Invalid hand-off" });
  if (!isNetSuiteConfigured()) return res.status(503).json({ error: "NetSuite not configured" });
  let running = confirmsRunning.get(token);
  if (!running) {
    running = confirmHandoff(token, String(res.locals.employeeId), req.get("user-agent")?.slice(0, 512) ?? null)
      .finally(() => confirmsRunning.delete(token));
    confirmsRunning.set(token, running);
  }
  try {
    const result = await running;
    return res.status(result.status).json(result.body);
  } catch (err: any) {
    logger.error({ err }, "Could not confirm a new estimate from the Quote List");
    if (busy(err)) return res.status(503).json({ error: "NetSuite is busy right now. Wait a few seconds and check again." });
    return res.status(500).json({ error: "Could not check NetSuite for the new estimate. Check again." });
  }
});

export default router;
