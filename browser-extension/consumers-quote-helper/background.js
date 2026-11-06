// Consumers QuickAdd service worker (Chrome and Edge, Manifest V3). Named Consumers Quote Helper until 1.5.0.
// - Keeps the vendor domain list the Product Selector sends (product lines' websites from NetSuite) and runs
//   vendor.js only on those domains.
// - Holds the items customers add on vendor sites until the Product Selector picks them up.
// importScripts("extract.js");
importScripts("extract.js", "seed-sites.js");

const APP_ORIGINS = [
  "https://consumers-product-selector.replit.app",
  "https://consumersstore.com",
  "https://www.consumersstore.com",
  "https://52197461-b75a-404e-bf3a-1b07572baf55-00-c88ny32zcnr9.riker.replit.dev",
];
const APP_MATCHES = APP_ORIGINS.map(o => `${o}/*`);
// Vendor domains of the special-order product lines on 2026-11-04, used until a Product Selector tab sends the
// current list.
// const SEED_DOMAINS = [
//   "avancecabinetry.com", "brizo.com", "craftandmain.com", "deltafaucet.com", "elkay.com", "fleurco.com",
//   "flussofaucets.com", "franke.com", "icerabath.com", "johnboos.com", "kohler.com", "produitsneptune.com",
//   "richelieu.com", "strategicbrandsincorporated.com", "topknobs.com", "totousa.com",
// ];
// 2026-11-05 (1.5.3), from PROD: Bain Ultra, Grohe and Sofia became special-order lines; Neptune stopped being one.
const SEED_DOMAINS = [
  "avancecabinetry.com", "bainultra.com", "brizo.com", "craftandmain.com", "deltafaucet.com", "elkay.com",
  "fleurco.com", "flussofaucets.com", "franke.com", "grohe.us", "icerabath.com", "johnboos.com", "kohler.com",
  "richelieu.com", "sofiamedicinecabinets.com", "strategicbrandsincorporated.com", "topknobs.com", "totousa.com",
];
const VENDOR_SCRIPT_ID = "consumers-vendor";
const MAX_PICKS = 50;
const { registrableDomain, text, number } = globalThis.ConsumersExtract;

async function state() {
  // return chrome.storage.local.get({ vendorDomains: SEED_DOMAINS, picks: [], siteLines: {} });
  const s = await chrome.storage.local.get({ vendorDomains: SEED_DOMAINS, picks: [], siteLines: {} });
  // 1.5.0: until a Product Selector tab sends the current product lines, the bundled PROD list gives the panel its Types.
  if (!s.siteLines || !Object.keys(s.siteLines).length) s.siteLines = seedLines();
  return s;
}

const nsId = v => (typeof v === "string" && /^[1-9]\d{0,17}$/.test(v) ? v : "");

// Each vendor domain's product lines and their special-order Types, from the Product Selector (since 1.3.0), so the
// panel can offer the Type. Only ids and plain, length-limited names are kept.
function siteLinesFrom(sites) {
  const out = {};
  for (const s of sites) {
    let domain = "";
    try {
      const u = new URL(String(s.websiteUrl || ""));
      domain = /^https?:$/.test(u.protocol) ? registrableDomain(u.hostname) : "";
    } catch {}
    const id = nsId(s.productLineId);
    if (!domain || !id) continue;
    const types = (Array.isArray(s.types) ? s.types : []).slice(0, 200)
      .map(t => ({ id: nsId(t && t.id), name: text(t && t.name), requiresAttachment: !!(t && t.requiresAttachment) }))
      .filter(t => t.id && t.name);
    (out[domain] = out[domain] || []).push({ id, name: text(s.productLineName), types });
  }
  return out;
}

// The bundled lines (seed-sites.js), worked out once.
let seeded = null;
const seedLines = () => (seeded = seeded || siteLinesFrom(Array.isArray(globalThis.ConsumersSeedSites) ? globalThis.ConsumersSeedSites : []));

async function registerVendorScripts(domains) {
  // const matches = domains.flatMap(d => [`https://${d}/*`, `https://*.${d}/*`]);
  // 1.5.3 (sweep 11/5): plain http too, on the vendor domains only: Sofia's own "Shop" link opens
  // http://shop.sofiamedicinecabinets.com, which has no https redirect.
  const matches = domains.flatMap(d => [`https://${d}/*`, `https://*.${d}/*`, `http://${d}/*`, `http://*.${d}/*`]);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [VENDOR_SCRIPT_ID] });
  if (matches.length === 0) {
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [VENDOR_SCRIPT_ID] });
    return;
  }
  const script = { id: VENDOR_SCRIPT_ID, matches, js: ["extract.js", "vendor.js"], runAt: "document_idle", persistAcrossSessions: true };
  if (existing.length) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}

async function setBadge(count) {
  await chrome.action.setBadgeBackgroundColor({ color: "#1f4fd1" });
  await chrome.action.setBadgeText({ text: count ? String(count) : "" });
}

async function init() {
  const { vendorDomains, picks } = await state();
  await registerVendorScripts(vendorDomains);
  await setBadge(picks.length);
}
chrome.runtime.onInstalled.addListener(() => { init(); });
chrome.runtime.onStartup.addListener(() => { init(); });

function senderOrigin(sender) {
  try {
    return new URL(sender.url || (sender.tab && sender.tab.url) || "").origin;
  } catch {
    return "";
  }
}
const fromApp = sender => sender.id === chrome.runtime.id && APP_ORIGINS.includes(senderOrigin(sender));

async function broadcastPicks(picks) {
  await setBadge(picks.length);
  const tabs = await chrome.tabs.query({ url: APP_MATCHES });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: "picks", picks }).catch(() => {});
  }
}

// An item a customer added on a vendor page. Only plain, length-limited values are kept; the page address comes
// from the browser, not from the page.
function cleanPick(raw, sender) {
  const pageUrl = sender.url || (sender.tab && sender.tab.url) || "";
  let image = "";
  try {
    const u = new URL(String(raw.imageUrl || ""));
    image = u.protocol === "https:" ? u.href : "";
  } catch {}
  const qty = Math.trunc(Number(raw.quantity));
  return {
    id: crypto.randomUUID(),
    pickedAt: new Date().toISOString(),
    pageUrl: pageUrl.slice(0, 2000),
    vendorDomain: registrableDomain(new URL(pageUrl).hostname),
    name: text(raw.name),
    model: text(raw.model),
    color: text(raw.color),
    price: number(raw.price),
    currency: text(raw.currency) || "USD",
    imageUrl: image,
    quantity: qty >= 1 && qty <= 1000000 ? qty : 1,
    // 1.3.0: what the customer chose or the page showed for the special-order fields.
    productLineId: nsId(raw.productLineId),
    typeId: nsId(raw.typeId),
    typeName: text(raw.typeName),
    collection: text(raw.collection),
    description: text(raw.description),
    category: text(raw.category),
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const { vendorDomains, picks, siteLines } = await state();
    switch (message && message.type) {
      case "vendor-sites": {
        // The Product Selector's current product lines; their websites decide where vendor.js runs.
        if (!fromApp(sender) || !Array.isArray(message.sites)) return sendResponse({ ok: false });
        const domains = [...new Set(message.sites.map(s => {
          try {
            const u = new URL(String(s.websiteUrl || ""));
            return /^https?:$/.test(u.protocol) ? registrableDomain(u.hostname) : "";
          } catch {
            return "";
          }
        }).filter(Boolean))].sort();
        if (domains.length === 0) return sendResponse({ ok: false }); // never wipe the list on an empty answer
        // await chrome.storage.local.set({ vendorDomains: domains });
        await chrome.storage.local.set({ vendorDomains: domains, siteLines: siteLinesFrom(message.sites.slice(0, 1000)) });
        await registerVendorScripts(domains);
        return sendResponse({ ok: true, domains: domains.length });
      }
      case "get-picks":
        return sendResponse({ picks: fromApp(sender) ? picks : [] });
      case "pick-done": {
        if (!fromApp(sender)) return sendResponse({ ok: false });
        const next = picks.filter(p => p.id !== message.id);
        await chrome.storage.local.set({ picks: next });
        await broadcastPicks(next);
        return sendResponse({ ok: true });
      }
      case "add-pick": {
        // Only from a vendor page of a known product line.
        const host = (() => { try { return new URL(sender.url || sender.tab.url).hostname; } catch { return ""; } })();
        if (!vendorDomains.includes(registrableDomain(host)) || !message.pick) return sendResponse({ ok: false });
        const pick = cleanPick(message.pick, sender);
        if (!pick.name && !pick.model) return sendResponse({ ok: false });
        const next = [...picks, pick].slice(-MAX_PICKS);
        await chrome.storage.local.set({ picks: next });
        await broadcastPicks(next);
        return sendResponse({ ok: true, count: next.length });
      }
      // 1.5.5 (Gib 11/6): a kit's parts (Fleurco's door, base, drain and Mix & Match Kit), one pick each, stored together
      // so none is left out.
      case "add-picks": {
        const host = (() => { try { return new URL(sender.url || sender.tab.url).hostname; } catch { return ""; } })();
        if (!vendorDomains.includes(registrableDomain(host)) || !Array.isArray(message.picks)) return sendResponse({ ok: false });
        const kit = message.picks.slice(0, 20).map(raw => cleanPick(raw || {}, sender));
        if (!kit.length || kit.some(p => !p.name && !p.model)) return sendResponse({ ok: false });
        const next = [...picks, ...kit].slice(-MAX_PICKS);
        await chrome.storage.local.set({ picks: next });
        await broadcastPicks(next);
        return sendResponse({ ok: true, count: next.length, added: kit.length });
      }
      // 1.5.7 (Gib 11/6, "add a report issue button to the extension"): the panel's report goes to the Product Selector's
      // own Report Issue endpoint, which opens a NetSuite case for IT. It needs no sign-in.
      // 1.5.8: the Product Selector's Report Issue now needs a signed-in employee (Bearer session) and a request id, the
      // page address, the browser and its logs; the report also shows in Admin > Issues & Bugs. The session comes from
      // the Product Selector page in this browser (app.js), kept in memory only.
      case "app-session": {
        if (!fromApp(sender)) return sendResponse({ ok: false });
        const token = typeof message.token === "string" && message.token.length < 4000 ? message.token : "";
        await chrome.storage.session.set({ appSession: token ? { token, name: text(message.name).slice(0, 100), at: Date.now() } : null });
        return sendResponse({ ok: true });
      }
      case "report-issue": {
        const host = (() => { try { return new URL(sender.url || sender.tab.url).hostname; } catch { return ""; } })();
        if (!vendorDomains.includes(registrableDomain(host)) || !message.report) return sendResponse({ ok: false, error: "Not a vendor page" });
        const pageUrl = sender.url || (sender.tab && sender.tab.url) || "";
        const { appSession } = await chrome.storage.session.get("appSession");
        const signIn = { ok: false, signIn: true, error: "Sign in to the Product Selector in this browser first" };
        if (!appSession || !appSession.token) return sendResponse(signIn);
        const report = globalThis.ConsumersExtract.issueReport({ ...message.report, reporter: message.report.reporter || appSession.name, pageUrl, version: chrome.runtime.getManifest().version });
        if (!report) return sendResponse({ ok: false, error: "Please say what went wrong." });
        // const payload = globalThis.ConsumersExtract.issueReport({ ...message.report, pageUrl, version: chrome.runtime.getManifest().version });
        const payload = { requestId: crypto.randomUUID(), ...report, browserLogs: [] };
        try {
          // const res = await fetch(`${APP_ORIGINS[0]}/api/cases`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          const res = await fetch(`${APP_ORIGINS[0]}/api/cases`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${appSession.token}` }, body: JSON.stringify(payload) });
          const data = await res.json().catch(() => null);
          if (res.status === 401) {
            await chrome.storage.session.set({ appSession: null });
            return sendResponse(signIn);
          }
          if (!res.ok) return sendResponse({ ok: false, error: (data && data.error) || `The Product Selector answered ${res.status}` });
          return sendResponse({ ok: true, caseNumber: (data && data.caseNumber) || "", caseId: (data && data.caseId) || "" });
        } catch (e) {
          return sendResponse({ ok: false, error: "Could not reach the Product Selector" });
        }
      }
      case "pick-count":
        return sendResponse({ count: picks.length });
      case "site-info": {
        // The product lines (with their Types) of the vendor site this page is on.
        const host = (() => { try { return new URL(sender.url || sender.tab.url).hostname; } catch { return ""; } })();
        return sendResponse({ lines: siteLines[registrableDomain(host)] || [] });
      }
      case "popup-state":
        return sendResponse({ vendorDomains, picks });
      case "clear-picks": {
        if (sender.id !== chrome.runtime.id || sender.tab) return sendResponse({ ok: false }); // the popup only
        await chrome.storage.local.set({ picks: [] });
        await broadcastPicks([]);
        return sendResponse({ ok: true });
      }
      default:
        return sendResponse({ ok: false });
    }
  })();
  return true; // answered asynchronously
});
