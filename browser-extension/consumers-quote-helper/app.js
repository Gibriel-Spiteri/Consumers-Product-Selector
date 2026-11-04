// Consumers Quote Helper, on the Product Selector's own pages: passes messages between the page and the extension.
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

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== FROM_PAGE) return;
    // if (data.type === "request-picks") sendPicks();
    // The page asks once it is listening (after sign-in), which can be after the extension-ready sent at load.
    if (data.type === "request-picks") {
      toPage("extension-ready", { version: chrome.runtime.getManifest().version });
      sendPicks();
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
