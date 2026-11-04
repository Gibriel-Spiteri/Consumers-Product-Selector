// Consumers Quote Helper service worker (Chrome and Edge, Manifest V3).
// - Keeps the vendor domain list the Product Selector sends (product lines' websites from NetSuite) and runs
//   vendor.js only on those domains.
// - Holds the items customers add on vendor sites until the Product Selector picks them up.
importScripts("extract.js");

const APP_ORIGINS = [
  "https://consumers-product-selector.replit.app",
  "https://consumersstore.com",
  "https://www.consumersstore.com",
  "https://52197461-b75a-404e-bf3a-1b07572baf55-00-c88ny32zcnr9.riker.replit.dev",
];
const APP_MATCHES = APP_ORIGINS.map(o => `${o}/*`);
// Vendor domains of the special-order product lines on 2026-11-04, used until a Product Selector tab sends the
// current list.
const SEED_DOMAINS = [
  "avancecabinetry.com", "brizo.com", "craftandmain.com", "deltafaucet.com", "elkay.com", "fleurco.com",
  "flussofaucets.com", "franke.com", "icerabath.com", "johnboos.com", "kohler.com", "produitsneptune.com",
  "richelieu.com", "strategicbrandsincorporated.com", "topknobs.com", "totousa.com",
];
const VENDOR_SCRIPT_ID = "consumers-vendor";
const MAX_PICKS = 50;
const { registrableDomain, text, number } = globalThis.ConsumersExtract;

async function state() {
  return chrome.storage.local.get({ vendorDomains: SEED_DOMAINS, picks: [] });
}

async function registerVendorScripts(domains) {
  const matches = domains.flatMap(d => [`https://${d}/*`, `https://*.${d}/*`]);
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
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const { vendorDomains, picks } = await state();
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
        await chrome.storage.local.set({ vendorDomains: domains });
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
      case "pick-count":
        return sendResponse({ count: picks.length });
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
