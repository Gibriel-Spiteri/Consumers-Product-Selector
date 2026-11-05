// Consumers QuickAdd (Consumers Quote Helper until 1.5.0), on vendor websites (only the product lines' domains): shows an "Add to CPS Quote List"
// button on product pages. The panel lives in a shadow root so the vendor's styles and ours never mix.
(() => {
  "use strict";
  if (window.__consumersQuoteHelper) return;
  window.__consumersQuoteHelper = true;
  // 1.5.1: another copy of the extension (one loaded by hand next to the Group Policy one) already put its button on
  // this page; one button is enough. Each copy runs in its own isolated world, so only the shared DOM shows it.
  if (document.querySelector("[data-consumers-quote-helper]")) return;
  const X = globalThis.ConsumersExtract;

  const host = document.createElement("div");
  host.setAttribute("data-consumers-quote-helper", "");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      /* 2026-11-05 (Jim): Consumers Confirm's blue (--blue #1f4fd1, --blue-dark #183fa8 in its sign_style.css) for the
         button and the panel header. Was Confirm's navy bar color #0f1b33 (hover #1b2846). */
      .fab { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; display: none; align-items: center; gap: 8px;
        background: #1f4fd1; color: #fff; border: 0; border-radius: 999px; padding: 14px 20px; font-size: 15px; font-weight: 650;
        box-shadow: 0 6px 20px rgba(31, 79, 209, .35); cursor: pointer; }
      .fab:hover { background: #183fa8; }
      .fab .dot { background: #fff; color: #1f4fd1; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
      .panel { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; width: 360px; max-width: calc(100vw - 32px);
        max-height: calc(100vh - 40px); overflow: auto; display: none; background: #fff; color: #1d2433; border: 1px solid #d6dae2;
        border-radius: 12px; box-shadow: 0 12px 40px rgba(15, 27, 51, .25); }
      .head { background: linear-gradient(135deg, #1f4fd1, #183fa8); color: #fff; padding: 12px 16px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; }
      .head b { font-size: 15px; font-weight: 650; }
      .head small { display: block; color: #dbe4ff; font-size: 12px; font-weight: 400; }
      .x { background: transparent; border: 0; color: #dbe4ff; font-size: 22px; cursor: pointer; line-height: 1; }
      .body { padding: 14px 16px; display: grid; gap: 10px; }
      .prod { display: flex; gap: 12px; align-items: center; }
      .prod img { width: 64px; height: 64px; object-fit: contain; border: 1px solid #e3e6ec; border-radius: 8px; background: #fff; }
      .prod .name { font-size: 14px; font-weight: 600; line-height: 1.3; }
      label { display: grid; gap: 4px; min-width: 0; font-size: 11px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: #5b6475; }
      input, select { width: 100%; min-width: 0; font-size: 14px; padding: 9px 10px; border: 1px solid #c3c9d6; border-radius: 8px; background: #fff; color: #1d2433; text-transform: none; letter-spacing: 0; font-weight: 400; }
      .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
      .hint { font-size: 12px; color: #6b7385; }
      [hidden] { display: none !important; }
      .actions { display: flex; gap: 8px; justify-content: flex-end; padding: 0 16px 16px; }
      .btn { border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid #c3c9d6; background: #fff; color: #1d2433; }
      .btn.primary { background: #1f4fd1; border-color: #1f4fd1; color: #fff; }
      .btn.primary:hover { background: #183fa8; }
      .btn:disabled { opacity: .6; cursor: default; }
      .ok { background: #e3f4ea; color: #1d7a46; border-radius: 8px; padding: 10px 12px; font-size: 13px; }
      .err { background: #fdecec; color: #a12a2a; border-radius: 8px; padding: 10px 12px; font-size: 13px; }
      /* 1.4.2 (Gib 11/5): while the page changes under the open panel (another finish), it stays open, greyed out with a
         spinner, until the new values are read. The header (and its close button) stays clear. */
      .busy { position: absolute; left: 0; right: 0; bottom: 0; top: 0; z-index: 1; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 10px; background: rgba(236, 239, 245, .85); color: #3b4456;
        font-size: 13px; font-weight: 600; border-radius: 0 0 12px 12px; }
      .spin { width: 30px; height: 30px; border-radius: 50%; border: 3px solid #c9d3ea; border-top-color: #1f4fd1;
        animation: cqh-spin .8s linear infinite; }
      @keyframes cqh-spin { to { transform: rotate(360deg); } }
      /* 1.5.1: a required field left empty when Add is clicked. */
      input.missing, select.missing { border-color: #d93025; box-shadow: 0 0 0 2px rgba(217, 48, 37, .15); outline-color: #d93025; }
    </style>
    <!-- 1.5.0 (Gib 11/5): "Add to CPS Quote List", and the subtext asks to check the fields. Was:
    <button class="fab" type="button" part="fab"><span>Add to Consumers Quote</span><span class="dot" hidden></span></button>
    <div class="panel" role="dialog" aria-label="Add to Consumers Quote">
      <div class="head"><div><b>Add to Consumers Quote</b><small>Your sales rep finishes it in the Product Selector</small></div>... -->
    <button class="fab" type="button" part="fab"><span>Add to CPS Quote List</span><span class="dot" hidden></span></button>
    <div class="panel" role="dialog" aria-label="Add to CPS Quote List">
      <div class="head"><div><b>Add to CPS Quote List</b><small>Confirm all fields are correct before adding</small></div><button class="x" type="button" aria-label="Close">&times;</button></div>
      <div class="body">
        <div class="prod"><img alt=""><div class="name"></div></div>
        <label class="variant-wrap">Option<select class="variant"></select></label>
        <label class="line-wrap" hidden>Product line<select class="line"></select></label>
        <label class="type-wrap" hidden>Type<select class="type"></select></label>
        <div class="row">
          <label>Model<input class="model" maxlength="300"></label>
          <label>Color / finish<input class="color" maxlength="300"></label>
        </div>
        <!-- 2026-11-05 (Gib): one field, as NetSuite's Coll/Desc. Was two:
        <label>Collection<input class="collection" maxlength="300"></label>
        <label>Description<input class="description" maxlength="300"></label> -->
        <label>Collection / Description<input class="description" maxlength="300"></label>
        <div class="row">
          <label>Price on this site<input class="price" type="number" min="0" step="0.01" inputmode="decimal"></label>
          <label>Quantity<input class="qty" type="number" min="1" max="1000000" step="1" value="1" inputmode="numeric"></label>
        </div>
        <div class="hint manual-hint" hidden>We could not read this item from the page. Type the model number and color shown on it.</div>
        <div class="hint">Your Consumers sales rep confirms the list price and finishes this on your quote.</div>
        <div class="msg" hidden></div>
      </div>
      <div class="actions"><button class="btn cancel" type="button">Close</button><button class="btn primary add" type="button">Add to quote</button></div>
      <div class="busy" role="status" hidden><div class="spin"></div><span>Updating...</span></div>
    </div>`;
  const $ = sel => root.querySelector(sel);
  const fab = $(".fab"), panel = $(".panel"), dot = $(".dot"), msg = $(".msg");
  const f = { img: $(".prod img"), name: $(".prod .name"), variantWrap: $(".variant-wrap"), variant: $(".variant"),
    model: $(".model"), color: $(".color"), price: $(".price"), qty: $(".qty"), add: $(".add"),
    manualHint: $(".manual-hint"),
    lineWrap: $(".line-wrap"), line: $(".line"), typeWrap: $(".type-wrap"), type: $(".type"),
    description: $(".description") }; // was also collection: $(".collection") (until 1.4.1)
  const busy = $(".busy"), head = $(".head"), bodyEl = $(".body"), actionsEl = $(".actions");

  // 1.4.2: grey the open panel out with a spinner while it re-reads the page; nothing under it can be clicked or typed.
  function setBusy(on) {
    if (on) busy.style.top = head.offsetHeight + "px";
    busy.hidden = !on;
    bodyEl.inert = on;
    actionsEl.inert = on;
    panel.setAttribute("aria-busy", String(on));
  }

  let items = [];
  let selected = -1;
  let manual = false; // nothing readable on the page: the customer types the model in
  let lastUrl = ""; // since 11/5 the address plus the shown model and finish (pageKey)
  let followsPage = false; // the page shows which variant is chosen, so no Option list
  const MANUAL_HINT = f.manualHint.textContent;
  let category = ""; // the vendor's breadcrumbs, for the Type guess
  let siteLines = []; // this vendor's product lines and their special-order Types, from the Product Selector

  async function loadSiteLines() {
    try {
      const res = await chrome.runtime.sendMessage({ type: "site-info" });
      siteLines = (res && Array.isArray(res.lines)) ? res.lines : [];
    } catch {
      siteLines = [];
    }
  }

  // Visible text of the first element matching a selector, and the label of a checked radio button.
  // const textOf = sel => {
  //   const el = document.querySelector(sel);
  //   return el && el.getClientRects().length ? el.textContent.replace(/\s+/g, " ").trim() : "";
  // };
  // The first visible match: Delta's page carries a hidden copy of its collection name before the shown one.
  const textOf = sel => {
    const el = [...document.querySelectorAll(sel)].find(e => e.getClientRects().length);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
  };
  const checkedLabel = name => {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    const label = r && (r.closest("label") || (r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`)));
    return label ? label.textContent.replace(/\s+/g, " ").trim() : "";
  };

  // Fleurco's product title without its own tags: "*New* Vespero Pivot" is the Vespero Pivot (1.5.1).
  const fleurcoTitle = () => textOf(".product-page .title").replace(/\*[^*]*\*/g, " ").replace(/\s+/g, " ").trim();

  // Vendor sites that need their own rule, by main domain.
  const SITE_RULES = {
    // Fleurco's shower door configurator (2026-11-04) prints the model number and total only once every choice is
    // made, Mix & Match Kit included, under the options: "NHS160-25-40R-79 Total : $1821 (USD)". There is no h1.
    "fleurco.com": {
      requireModel: true, // nothing else on the page describes the item
      model: () => textOf(".product-total .product-sku"),
      price: () => (textOf(".product-total").match(/\$\s?(\d[\d,]*(?:\.\d{2})?)/) || [])[1],
      color: () => checkedLabel("rdoHardwareFinish"),
      // name: () => [textOf(".product-page .title"), checkedLabel("rdoGlassType")].filter(Boolean).join(", "),
      // collection: () => textOf(".product-page .title"),
      name: () => [fleurcoTitle(), checkedLabel("rdoGlassType")].filter(Boolean).join(", "),
      collection: () => fleurcoTitle(),
      hint: "Choose every option on the page, Mix & Match Kit included, until the model number shows under them. Then click Add to CPS Quote List again, or type the model here.",
    },
    // Delta (2026-11-04): picking a finish changes the address (/9190TL-DST.html -> /9190TL-PN-DST.html) and the
    // price shown, but not the page's product data. The chosen swatch is titled "Finish: Polished Nickel, selected",
    // the shown list price carries itemprop="price" content="1242.00", and the collection is ".collection-name".
    "deltafaucet.com": {
      // model: () => X.urlModel(location.href),
      // The shown "MODEL#: 35442-CZMPU-DST" first: the address can lag a moment behind the swatch (Jim, 11/5: the
      // panel had 35442-MPU-DST with Champagne Bronze).
      model: () => textOf(".model-name").replace(/^\s*model\s*#?\s*:?\s*/i, "") || X.urlModel(location.href),
      color: () => {
        const b = [...document.querySelectorAll("button.product-attribute__swatch")]
          .find(s => /selected/i.test(s.title || "") || s.getAttribute("aria-pressed") === "true");
        return b ? String(b.title || b.getAttribute("aria-label") || "").replace(/^\s*finish:\s*/i, "").replace(/,\s*selected\s*$/i, "") : "";
      },
      price: () => {
        const el = [...document.querySelectorAll('[itemprop="price"]')].find(e => e.getClientRects().length);
        return el ? el.getAttribute("content") || el.textContent : "";
      },
      collection: () => textOf(".collection-name"),
    },
    // Kohler (2026-11-05): the color swatches change "?skuId=28000-CM6" (no "K-") and the shown SKU
    // (.product-detail-page__sku-id "K-28000-CM6"); the product data lists every color. The shown SKU picks the
    // color, so the panel follows the page as on Delta instead of offering a dropdown.
    "kohler.com": {
      model: () => textOf(".product-detail-page__sku-id"),
      color: () => {
        const r = document.querySelector(".product-detail-page__color-swatch input:checked");
        return r ? r.getAttribute("aria-label") || "" : "";
      },
    },
    // Strategic Brands (2026-11-05, Jim): names read "128mm Austin Pull - Satin Nickel"; the finish is the last part,
    // and the collection is in the "parts in this collection" link (...termsFilters[product_collection][Austin]=1).
    "strategicbrandsincorporated.com": {
      color: () => {
        const parts = textOf("h1").split(/\s+-\s+/);
        return parts.length > 1 ? parts[parts.length - 1] : "";
      },
      collection: () => {
        const a = document.querySelector('a[href*="product_collection"]');
        const m = a && /product_collection\]\[([^\]]+)\]/.exec(decodeURIComponent(a.getAttribute("href") || ""));
        return m ? m[1].replace(/\+/g, " ") : "";
      },
    },
  };
  const siteRule = SITE_RULES[X.registrableDomain(location.hostname)] || null;

  // What the site's rule reads from the live page (only the non-empty values).
  function siteValues() {
    const out = {};
    if (!siteRule) return out;
    for (const k of ["model", "color", "price", "name", "collection"]) {
      const v = siteRule[k] ? X.text(siteRule[k]()) : "";
      if (v) out[k] = v;
    }
    return out;
  }

  function siteItem() {
    if (!siteRule) return null;
    // const model = X.text(siteRule.model());
    // if (!model) return null;
    // return {
    //   name: X.text(siteRule.name()) || document.title, model, color: X.text(siteRule.color()),
    //   price: X.number(siteRule.price()), currency: "USD", priceIsList: false, imageUrl: "",
    // };
    const v = siteValues();
    if (!v.model) return null;
    return {
      name: v.name || document.title, model: v.model, color: v.color || "", price: X.number(v.price),
      currency: "USD", priceIsList: false, imageUrl: "", collection: v.collection || "",
    };
  }

  // The site's live values over what the product data says (Delta's chosen finish, its price and collection).
  function withSiteValues(found) {
    if (!siteRule || siteRule.requireModel || !found.items.length) return found;
    const v = siteValues();
    // The page shows which of the product data's colors is chosen (Kohler): select it; its color and price are its own.
    const shown = v.model ? found.items.findIndex(it => String(it.model).toUpperCase() === v.model.toUpperCase()) : -1;
    if (found.items.length > 1 && shown >= 0) {
      return { ...found, selected: shown, follows: true, items: found.items.map((x, j) => (j === shown && v.collection
        ? { ...x, collection: v.collection.replace(/[®™]/g, "").trim() } : x)) };
    }
    const i = Math.max(found.selected, 0);
    const it = { ...found.items[i] };
    if (v.model) it.model = v.model;
    if (v.color) it.color = v.color;
    if (v.price && X.number(v.price)) it.price = X.number(v.price);
    if (v.name) it.name = v.name;
    if (v.collection) it.collection = v.collection.replace(/[®™]/g, "").trim();
    return { ...found, follows: !!v.model, items: found.items.map((x, j) => (j === i ? it : x)) };
  }

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

  // The first visible h1, the page's visible text (for sites that only print the model and price), microdata and the
  // breadcrumb links.
  function pageText() {
    const h1 = [...document.querySelectorAll("h1")].find(h => h.getClientRects().length && h.innerText.trim());
    const crumbs = [...document.querySelectorAll('nav[aria-label*="breadcrumb" i] a, [class*="breadcrumb" i] a, [class*="breadcrumb" i] li')]
      .filter(e => e.getClientRects().length).map(e => e.textContent.replace(/\s+/g, " ").trim()).filter(t => t && t.length < 60);
    return {
      heading: h1 ? h1.innerText.replace(/\s+/g, " ").trim() : "",
      headingText: h1 ? h1.textContent.replace(/\s+/g, " ").trim() : "", // as written, before CSS capitals
      text: (document.body ? document.body.innerText : "").replace(/\s+/g, " "),
      microdata: microdata(),
      crumbs,
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
    // const site = siteItem();
    // if (site) found = { items: [site], selected: 0 };
    const site = siteRule && siteRule.requireModel ? siteItem() : null;
    if (site) found = { ...found, items: [site], selected: 0 };
    else found = withSiteValues(found);
    if (!found.items.length) found = await readFromServer();
    category = found.category || live.found.category || "";
    await loadSiteLines();
    manual = !found.items.length;
    // 1.0.0: the button showed only on pages with product data.
    // items = found.items;
    // selected = found.selected;
    // fab.style.display = items.length ? "flex" : "none";
    // if (!items.length) panel.style.display = "none";
    // Every page of a vendor site keeps the button: without product data the customer types the model in.
    // items = manual ? [X.blankItem(live.meta, live.page, document.title, location.href)] : found.items;
    // 1.5.1: on a page with no model yet (Fleurco mid-configurator), the site rule's own name, finish and collection
    // beat the tab title ("Vespero Pivot, Fluted (6mm)", not "Vespero Pivot| High-Quality Shower Doors | Fleurco").
    if (manual) {
      const blank = X.blankItem(live.meta, live.page, document.title, location.href);
      const v = siteValues();
      items = [{ ...blank, name: v.name || blank.name, color: v.color || "", collection: v.collection || "" }];
    } else {
      items = found.items;
    }
    selected = manual ? 0 : found.selected;
    // The page says which color or finish is chosen (Kohler's shown SKU, the model in the address): the panel follows
    // it and needs no Option list. Jim (11/5): it should work the same on every site.
    const url = location.href.toUpperCase();
    followsPage = !!found.follows || items.some(it => it.model && url.includes(String(it.model).toUpperCase()));
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
    // f.collection.value = it.collection || "";
    // f.description.value = it.name || "";
    // Coll/Desc as reps type it in NetSuite: the collection, then the description ("Altado Two Handle Widespread
    // Bathroom Faucet"), not repeated when the name already has it.
    f.description.value = X.collDesc(it.collection, it.name || "");
    fillTypes();
  }

  // The vendor's product lines (only asked for when the site has several, like Foremost) and the chosen line's
  // special-order Types, with the best fit preselected. Without the Product Selector's list the Type stays hidden and
  // the rep picks it on the quote list.
  function fillLines() {
    f.line.innerHTML = "";
    if (siteLines.length > 1) {
      f.line.appendChild(new Option("Choose the product line", ""));
      for (const l of siteLines) f.line.appendChild(new Option(l.name, l.id));
    }
    f.lineWrap.hidden = siteLines.length <= 1;
  }
  function currentLine() {
    return siteLines.length === 1 ? siteLines[0] : siteLines.find(l => l.id === f.line.value) || null;
  }
  function fillTypes() {
    const line = currentLine();
    const options = line ? (line.types || []).filter(t => !t.requiresAttachment) : [];
    f.type.innerHTML = "";
    // f.type.appendChild(new Option("Choose a type (or leave it to your sales rep)", ""));
    f.type.appendChild(new Option("Choose a type", "")); // required since 1.5.1
    for (const t of options) f.type.appendChild(new Option(t.name, t.id));
    const it = items[selected] || {};
    const guess = X.suggestType({ name: it.name || f.description.value, pageUrl: location.href, category }, options);
    f.type.value = guess ? guess.id : "";
    f.typeWrap.hidden = options.length === 0;
  }

  // keep: the panel is already open and the page changed under it (another finish); keep the quantity and line.
  function openPanel(keep = false) {
    if (!items.length) return;
    f.variant.innerHTML = "";
    items.forEach((it, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = [it.color, it.model].filter(Boolean).join(" - ") || it.name;
      f.variant.appendChild(o);
    });
    // f.variantWrap.style.display = items.length > 1 ? "" : "none";
    f.variantWrap.style.display = items.length > 1 && !followsPage ? "" : "none";
    f.manualHint.hidden = !manual;
    f.manualHint.textContent = (siteRule && siteRule.hint) || MANUAL_HINT;
    f.variant.value = String(Math.max(selected, 0));
    // f.qty.value = "1";
    if (!keep) f.qty.value = "1";
    const lineBefore = f.line.value;
    fillLines();
    if (keep && lineBefore) f.line.value = lineBefore;
    msg.hidden = true;
    f.add.disabled = false;
    show(Math.max(selected, 0));
    clearMissing();
    panel.style.display = "block";
    fab.style.display = "none";
  }

  // 1.5.1 (Gib 11/5): every field is required before adding (John Boos left Color / finish empty). Product line and
  // Type count only when the panel shows them.
  const REQUIRED = [
    ["line", "Product line", () => !f.lineWrap.hidden],
    ["type", "Type", () => !f.typeWrap.hidden],
    ["model", "Model"],
    ["color", "Color / finish"],
    ["description", "Collection / Description"],
    ["price", "Price on this site"],
    ["qty", "Quantity"],
  ];
  function missingFields() {
    const out = [];
    for (const [key, label, shown] of REQUIRED) {
      const el = f[key];
      if (shown && !shown()) {
        el.classList.remove("missing");
        continue;
      }
      const v = String(el.value || "").trim();
      let ok = v !== "";
      if (key === "price") ok = ok && Number(v) > 0;
      if (key === "qty") ok = ok && Number.isInteger(Number(v)) && Number(v) >= 1;
      el.classList.toggle("missing", !ok);
      if (!ok) out.push({ el, label });
    }
    return out;
  }
  function clearMissing() {
    for (const [key] of REQUIRED) f[key].classList.remove("missing");
  }

  function closePanel() {
    setBusy(false);
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
    const missing = missingFields();
    if (missing.length) {
      msg.hidden = false;
      msg.className = "msg err";
      msg.textContent = `Please fill in ${missing.map(m => m.label).join(", ")} before adding.` +
        (missing.some(m => m.el === f.price) ? " If this site shows no price, ask your sales rep for it." : "");
      missing[0].el.focus();
      return;
    }
    const it = items[selected] || {};
    const line = currentLine();
    const typeOption = f.type.selectedOptions[0];
    const pick = {
      // name: it.name || "",
      // name: f.description.value || it.name || "",
      name: it.name || f.description.value || "",
      model: f.model.value,
      color: f.color.value,
      price: f.price.value,
      currency: it.currency || "USD",
      imageUrl: it.imageUrl || "",
      quantity: f.qty.value,
      // 1.3.0: the special-order fields.
      productLineId: line ? line.id : "",
      typeId: f.type.value,
      typeName: f.type.value && typeOption ? typeOption.textContent : "",
      // collection: f.collection.value,
      // description: f.description.value,
      // The one Coll/Desc field (collection included); the Product Selector uses it as is.
      collection: "",
      description: f.description.value,
      category,
    };
    f.add.disabled = true;
    let res = null;
    try {
      res = await chrome.runtime.sendMessage({ type: "add-pick", pick });
    } catch {}
    msg.hidden = false;
    if (res && res.ok) {
      msg.className = "msg ok";
      // msg.textContent = `Added to your Consumers quote. ${res.count} item${res.count === 1 ? "" : "s"} waiting for your sales rep.`;
      msg.textContent = `Added to the CPS Quote List. ${res.count} item${res.count === 1 ? "" : "s"} waiting for your sales rep.`;
      refreshCount();
    } else {
      msg.className = "msg err";
      msg.textContent = "Could not add this item. Please ask your sales rep.";
      f.add.disabled = false;
    }
  }

  // fab.addEventListener("click", openPanel);
  // Read the page again on each click: configurators (Fleurco) and option pickers change it without a page load.
  let reading = false;
  fab.addEventListener("click", async () => {
    if (reading) return;
    reading = true;
    try {
      await detect();
    } finally {
      reading = false;
    }
    openPanel();
  });
  $(".x").addEventListener("click", closePanel);
  $(".cancel").addEventListener("click", closePanel);
  f.variant.addEventListener("change", () => show(Number(f.variant.value)));
  f.line.addEventListener("change", fillTypes);
  f.add.addEventListener("click", add);
  // A field filled in loses its red outline.
  for (const [key] of REQUIRED) {
    for (const ev of ["input", "change"]) f[key].addEventListener(ev, () => f[key].classList.remove("missing"));
  }

  (document.body || document.documentElement).appendChild(host);
  // Re-read when a single-page site changes the address without a page load.
  // setInterval(() => {
  //   if (location.href !== lastUrl) {
  //     lastUrl = location.href;
  //     closePanel();
  //     setTimeout(detect, 800);
  //   }
  // }, 1000);
  // An open panel follows the page (Delta's finish swatches change the address): it refreshes instead of closing.
  // setInterval(() => {
  //   if (location.href !== lastUrl) {
  //     lastUrl = location.href;
  //     const open = panel.style.display === "block";
  //     if (!open) closePanel();
  //     setTimeout(async () => {
  //       await detect();
  //       if (open) openPanel(true);
  //     }, 800);
  //   }
  // }, 1000);
  // 2026-11-05: also when the page's shown model or finish changes without a new address (Delta updates the address
  // after the swatch; Kohler's SKU line), so the panel never keeps an older finish.
  // const pageKey = () => {
  //   const v = siteRule && !siteRule.requireModel ? siteValues() : {};
  //   return `${location.href}|${v.model || ""}|${v.color || ""}`;
  // };
  // 1.5.1 (Gib 11/5, Fleurco's Vespero Pivot): a configurator (requireModel) changes the shown model, finish and total
  // without a new address, so those count too; the open panel greys out and follows each choice.
  const pageKey = () => {
    const v = siteValues();
    return `${location.href}|${v.model || ""}|${v.color || ""}|${v.price || ""}`;
  };
  // setInterval(() => {
  //   const key = pageKey();
  //   if (key !== lastUrl) {
  //     lastUrl = key;
  //     const open = panel.style.display === "block";
  //     if (!open) closePanel();
  //     setTimeout(async () => {
  //       await detect();
  //       if (open) openPanel(true);
  //     }, 800);
  //   }
  // }, 1000);
  // 1.4.2 (Gib 11/5): the open panel greys out with a spinner as soon as the page changes (checked every 0.3 s) and
  // is read 0.8 s after the last change (Delta changes the swatch, then the MODEL#, then the address), at most 4 s
  // after the first. Only the newest read fills the panel.
  let refreshTimer = 0, firstChange = 0, refreshRun = 0;
  setInterval(() => {
    const key = pageKey();
    if (key === lastUrl) return;
    lastUrl = key;
    if (panel.style.display === "block") setBusy(true);
    else closePanel();
    if (!refreshTimer) firstChange = Date.now();
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      refreshTimer = 0;
      const run = ++refreshRun;
      try {
        await detect();
      } catch {}
      if (run !== refreshRun) return; // a later change is being read
      if (panel.style.display === "block") openPanel(true);
      setBusy(false);
    }, Math.max(0, Math.min(800, 4000 - (Date.now() - firstChange))));
  }, 300);
  // lastUrl = location.href;
  lastUrl = pageKey();
  detect();
  refreshCount();
})();
