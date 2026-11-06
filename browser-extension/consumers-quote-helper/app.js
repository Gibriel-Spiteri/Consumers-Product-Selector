// Consumers QuickAdd (Consumers Quote Helper until 1.5.0), on the Product Selector's own pages: passes messages between the page and the extension.
// The page sends its product lines' vendor websites and finished picks; the extension sends the picks customers
// made on vendor sites. Only same-window messages from this origin are accepted.
(() => {
  "use strict";
  const FROM_PAGE = "consumers-product-selector";
  const FROM_EXTENSION = "consumers-quote-helper";

  function toPage(type, data) {
    window.postMessage({ source: FROM_EXTENSION, type, ...data }, location.origin);
  }

  async function ask(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch {
      return null; // extension reloaded or updated; the page keeps working without it
    }
  }

  async function sendPicks() {
    const res = await ask({ type: "get-picks" });
    toPage("vendor-picks", { picks: (res && res.picks) || [] });
  }

  // 1.5.8: the rep's Product Selector sign-in (the page's own "ps_session" token and name), so the QuickAdd panel's Report
  // issue can send as them: the Product Selector's Report Issue needs a signed-in employee. The background keeps it in
  // memory only (chrome.storage.session) and forgets it when the browser closes or the page signs out.
  let lastSession = null;
  function sendSession() {
    let token = "", name = "";
    try {
      token = localStorage.getItem("ps_session") || "";
      const who = JSON.parse(localStorage.getItem("ps_auth") || "null");
      if (who) name = `${who.firstName || ""} ${who.lastName || ""}`.trim();
    } catch {}
    const key = `${token}|${name}`;
    if (key === lastSession) return;
    lastSession = key;
    ask({ type: "app-session", token, name });
  }
  sendSession();
  setInterval(sendSession, 15000);

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== FROM_PAGE) return;
    // if (data.type === "request-picks") sendPicks();
    // The page asks once it is listening (after sign-in), which can be after the extension-ready sent at load.
    if (data.type === "request-picks") {
      toPage("extension-ready", { version: chrome.runtime.getManifest().version });
      sendPicks();
      sendSession(); // 1.5.8: just signed in
    }
    if (data.type === "pick-done" && typeof data.id === "string") ask({ type: "pick-done", id: data.id }).then(sendPicks);
    if (data.type === "vendor-sites" && Array.isArray(data.sites)) ask({ type: "vendor-sites", sites: data.sites.slice(0, 1000) });
  });

  chrome.runtime.onMessage.addListener(message => {
    if (message && message.type === "picks") toPage("vendor-picks", { picks: message.picks || [] });
  });

  toPage("extension-ready", { version: chrome.runtime.getManifest().version });
  sendPicks();
})();
