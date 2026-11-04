// Consumers Quote Helper, on vendor websites (only the product lines' domains): shows an "Add to Consumers Quote"
// button on product pages. The panel lives in a shadow root so the vendor's styles and ours never mix.
(() => {
  "use strict";
  if (window.__consumersQuoteHelper) return;
  window.__consumersQuoteHelper = true;
  const X = globalThis.ConsumersExtract;

  const host = document.createElement("div");
  host.setAttribute("data-consumers-quote-helper", "");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      .fab { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; display: none; align-items: center; gap: 8px;
        background: #0f1b33; color: #fff; border: 0; border-radius: 999px; padding: 14px 20px; font-size: 15px; font-weight: 650;
        box-shadow: 0 6px 20px rgba(15, 27, 51, .35); cursor: pointer; }
      .fab:hover { background: #1b2846; }
      .fab .dot { background: #1f4fd1; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
      .panel { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; width: 360px; max-width: calc(100vw - 32px);
        max-height: calc(100vh - 40px); overflow: auto; display: none; background: #fff; color: #1d2433; border: 1px solid #d6dae2;
        border-radius: 12px; box-shadow: 0 12px 40px rgba(15, 27, 51, .25); }
      .head { background: #0f1b33; color: #fff; padding: 12px 16px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; }
      .head b { font-size: 15px; font-weight: 650; }
      .head small { display: block; color: #b8c2d6; font-size: 12px; font-weight: 400; }
      .x { background: transparent; border: 0; color: #b8c2d6; font-size: 22px; cursor: pointer; line-height: 1; }
      .body { padding: 14px 16px; display: grid; gap: 10px; }
      .prod { display: flex; gap: 12px; align-items: center; }
      .prod img { width: 64px; height: 64px; object-fit: contain; border: 1px solid #e3e6ec; border-radius: 8px; background: #fff; }
      .prod .name { font-size: 14px; font-weight: 600; line-height: 1.3; }
      label { display: grid; gap: 4px; min-width: 0; font-size: 11px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: #5b6475; }
      input, select { width: 100%; min-width: 0; font-size: 14px; padding: 9px 10px; border: 1px solid #c3c9d6; border-radius: 8px; background: #fff; color: #1d2433; text-transform: none; letter-spacing: 0; font-weight: 400; }
      .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .hint { font-size: 12px; color: #6b7385; }
      .actions { display: flex; gap: 8px; justify-content: flex-end; padding: 0 16px 16px; }
      .btn { border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid #c3c9d6; background: #fff; color: #1d2433; }
      .btn.primary { background: #1f4fd1; border-color: #1f4fd1; color: #fff; }
      .btn.primary:hover { background: #183fa8; }
      .btn:disabled { opacity: .6; cursor: default; }
      .ok { background: #e3f4ea; color: #1d7a46; border-radius: 8px; padding: 10px 12px; font-size: 13px; }
      .err { background: #fdecec; color: #a12a2a; border-radius: 8px; padding: 10px 12px; font-size: 13px; }
    </style>
    <button class="fab" type="button" part="fab"><span>Add to Consumers Quote</span><span class="dot" hidden></span></button>
    <div class="panel" role="dialog" aria-label="Add to Consumers Quote">
      <div class="head"><div><b>Add to Consumers Quote</b><small>Your sales rep finishes it in the Product Selector</small></div><button class="x" type="button" aria-label="Close">&times;</button></div>
      <div class="body">
        <div class="prod"><img alt=""><div class="name"></div></div>
        <label class="variant-wrap">Option<select class="variant"></select></label>
        <div class="row">
          <label>Model<input class="model" maxlength="300"></label>
          <label>Color / finish<input class="color" maxlength="300"></label>
        </div>
        <div class="row">
          <label>Price on this site<input class="price" type="number" min="0" step="0.01" inputmode="decimal"></label>
          <label>Quantity<input class="qty" type="number" min="1" max="1000000" step="1" value="1" inputmode="numeric"></label>
        </div>
        <div class="hint manual-hint" hidden>We could not read this item from the page. Type the model number and color shown on it.</div>
        <div class="hint">Your Consumers sales rep confirms the list price and finishes this on your quote.</div>
        <div class="msg" hidden></div>
      </div>
      <div class="actions"><button class="btn cancel" type="button">Close</button><button class="btn primary add" type="button">Add to quote</button></div>
    </div>`;
  const $ = sel => root.querySelector(sel);
  const fab = $(".fab"), panel = $(".panel"), dot = $(".dot"), msg = $(".msg");
  const f = { img: $(".prod img"), name: $(".prod .name"), variantWrap: $(".variant-wrap"), variant: $(".variant"),
    model: $(".model"), color: $(".color"), price: $(".price"), qty: $(".qty"), add: $(".add"),
    manualHint: $(".manual-hint") };

  let items = [];
  let selected = -1;
  let manual = false; // nothing readable on the page: the customer types the model in
  let lastUrl = "";

  // The page's schema.org Product microdata (Top Knobs), shaped like a JSON-LD Product for extract.js.
  function microdata() {
    const el = document.querySelector('[itemscope][itemtype*="schema.org/Product" i]');
    if (!el) return null;
    const scopeOf = n => (n.parentElement ? n.parentElement.closest("[itemscope]") : null);
    const value = n => (n.getAttribute("content") || n.getAttribute("src") || n.getAttribute("href") || n.textContent || "").trim();
    const prop = (name, nested) => {
      for (const n of el.querySelectorAll(`[itemprop~="${name}"]`)) if (nested || scopeOf(n) === el) return value(n);
      return "";
    };
    return {
      "@type": "Product", name: prop("name"), sku: prop("sku"), mpn: prop("mpn"), model: prop("model"),
      color: prop("color"), image: prop("image"), offers: { price: prop("price", true), priceCurrency: prop("priceCurrency", true) },
    };
  }

  // The first visible h1, the page's visible text (for sites that only print the model and price) and microdata.
  function pageText() {
    const h1 = [...document.querySelectorAll("h1")].find(h => h.getClientRects().length && h.innerText.trim());
    return {
      heading: h1 ? h1.innerText.replace(/\s+/g, " ").trim() : "",
      text: (document.body ? document.body.innerText : "").replace(/\s+/g, " "),
      microdata: microdata(),
    };
  }

  function readPage() {
    const blocks = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent || "");
    const meta = {};
    for (const m of document.querySelectorAll("meta[property], meta[name]")) {
      const key = m.getAttribute("property") || m.getAttribute("name");
      if (key && !(key in meta)) meta[key] = m.getAttribute("content") || "";
    }
    // return X.extract(blocks, meta, location.href);
    const page = pageText();
    return { found: X.extract(blocks, meta, location.href, page), meta, page };
  }

  // Single-page sites can keep the previous page's data in the DOM; the page's own HTML is the fallback.
  async function readFromServer() {
    try {
      const html = await (await fetch(location.href, { credentials: "include" })).text();
      const { blocks, meta, page } = X.scanHtml(html);
      return X.extract(blocks, meta, location.href, page);
    } catch {
      return { items: [], selected: -1 };
    }
  }

  async function detect() {
    const live = readPage();
    let found = live.found;
    if (!found.items.length) found = await readFromServer();
    manual = !found.items.length;
    // 1.0.0: the button showed only on pages with product data.
    // items = found.items;
    // selected = found.selected;
    // fab.style.display = items.length ? "flex" : "none";
    // if (!items.length) panel.style.display = "none";
    // Every page of a vendor site keeps the button: without product data the customer types the model in.
    items = manual ? [X.blankItem(live.meta, live.page, document.title, location.href)] : found.items;
    selected = manual ? 0 : found.selected;
    fab.style.display = "flex";
  }

  function show(i) {
    const it = items[i];
    if (!it) return;
    selected = i;
    f.img.src = it.imageUrl || "";
    f.img.style.display = it.imageUrl ? "" : "none";
    f.name.textContent = it.name || it.model;
    f.model.value = it.model;
    f.color.value = it.color;
    f.price.value = it.price != null ? String(it.price) : "";
  }

  function openPanel() {
    if (!items.length) return;
    f.variant.innerHTML = "";
    items.forEach((it, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = [it.color, it.model].filter(Boolean).join(" - ") || it.name;
      f.variant.appendChild(o);
    });
    f.variantWrap.style.display = items.length > 1 ? "" : "none";
    f.manualHint.hidden = !manual;
    f.variant.value = String(Math.max(selected, 0));
    f.qty.value = "1";
    msg.hidden = true;
    f.add.disabled = false;
    show(Math.max(selected, 0));
    panel.style.display = "block";
    fab.style.display = "none";
  }

  function closePanel() {
    panel.style.display = "none";
    fab.style.display = items.length ? "flex" : "none";
  }

  async function refreshCount() {
    try {
      const res = await chrome.runtime.sendMessage({ type: "pick-count" });
      const n = (res && res.count) || 0;
      dot.hidden = n === 0;
      dot.textContent = String(n);
    } catch {}
  }

  async function add() {
    const it = items[selected] || {};
    const pick = {
      name: it.name || "",
      model: f.model.value,
      color: f.color.value,
      price: f.price.value,
      currency: it.currency || "USD",
      imageUrl: it.imageUrl || "",
      quantity: f.qty.value,
    };
    f.add.disabled = true;
    let res = null;
    try {
      res = await chrome.runtime.sendMessage({ type: "add-pick", pick });
    } catch {}
    msg.hidden = false;
    if (res && res.ok) {
      msg.className = "msg ok";
      msg.textContent = `Added to your Consumers quote. ${res.count} item${res.count === 1 ? "" : "s"} waiting for your sales rep.`;
      refreshCount();
    } else {
      msg.className = "msg err";
      msg.textContent = "Could not add this item. Please ask your sales rep.";
      f.add.disabled = false;
    }
  }

  fab.addEventListener("click", openPanel);
  $(".x").addEventListener("click", closePanel);
  $(".cancel").addEventListener("click", closePanel);
  f.variant.addEventListener("change", () => show(Number(f.variant.value)));
  f.add.addEventListener("click", add);

  (document.body || document.documentElement).appendChild(host);
  // Re-read when a single-page site changes the address without a page load.
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      closePanel();
      setTimeout(detect, 800);
    }
  }, 1000);
  lastUrl = location.href;
  detect();
  refreshCount();
})();
