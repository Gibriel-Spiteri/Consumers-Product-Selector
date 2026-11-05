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
      /* 1.5.2: a required field left empty when Add is clicked. */
      input.missing, select.missing { border-color: #d93025; box-shadow: 0 0 0 2px rgba(217, 48, 37, .15); outline-color: #d93025; }
      /* 1.5.3: the page says the item is discontinued. */
      .hint.warn { background: #fff4e5; color: #8a4b00; border-radius: 8px; padding: 8px 10px; }
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
        <div class="hint warn gone-hint" hidden>This page says the item is discontinued. Check with your sales rep before adding it.</div>
        <div class="hint order-form-hint" hidden>This Type is ordered on the vendor's order form: your sales rep attaches it to your quote.</div>
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
    manualHint: $(".manual-hint"), goneHint: $(".gone-hint"), orderFormHint: $(".order-form-hint"), // 1.5.3
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
  let gone = false; // 1.5.3: the page says the item is discontinued
  let pickNeeded = false; // 1.5.3: the page needs a size, finish or color picked first
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

  // 1.5.3 (Gib 11/5, "add color readers"): small readers for where vendors print the color or finish.
  const clean = s => (s || "").replace(/\s+/g, " ").trim();
  // A visible heading like "Color: Cotton" (TOTO, Craft & Main) or "Selected Finish: Polished Chrome" (Brizo).
  const labeled = (sel, re) => {
    for (const e of document.querySelectorAll(sel)) {
      const m = re.exec(clean(e.textContent));
      if (m && e.getClientRects().length) return clean(m[1]);
    }
    return "";
  };
  // A spec table row by its label cell, shown or in a closed tab: "Product finish | Copper", "Material | Stainless Steel".
  const rowValue = (rows, labelRe) => {
    for (const r of document.querySelectorAll(rows)) {
      const c = r.cells;
      if (c && c.length >= 2 && labelRe.test(clean(c[0].textContent))) return clean(c[1].textContent);
    }
    return "";
  };
  // John Boos names start with the wood ("Maple Square Chopping Block", "Cherry Cucina D'Amico Wine Cart").
  const WOODS = /\b(American Black Walnut|Black Walnut|Walnut|Northern Hard Rock Maple|Hard Rock Maple|Maple|Cherry|White Oak|Red Oak|Oak|Teak|Acacia)\b/i;

  // 1.5.3 (sweep 11/5) helpers for the site rules below.
  // One price as printed ("$1,525.00", "List price: $612.00", "MSRP LIST PRICE$1,424.00"), never a range.
  const amountOf = s => {
    const x = clean(s);
    if (/\$\s?[\d,.]+\s*(?:-|\u2013|to|through)\s*\$/i.test(x)) return "";
    const m = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)/.exec(x);
    return m ? m[1].replace(/,/g, "") : "";
  };
  // A label and its value in a two-cell row: <tr><th>Finish</th><td>Polished Nickel</td></tr> (Top Knobs, Elkay).
  const specValue = (rows, labelRe) => {
    for (const r of document.querySelectorAll(rows)) {
      const k = r.querySelector("th, td:first-child"), v = r.querySelector("td:last-child");
      if (k && v && k !== v && labelRe.test(clean(k.textContent))) return clean(v.textContent);
    }
    return "";
  };
  // Richelieu's option pickers: "Finish: Orion Gray", "Center to Center: 3 25/32 in*".
  const richelieuOption = labelRe => {
    for (const q of document.querySelectorAll("rc-skuquestion")) {
      const head = q.querySelector('span[slot="head"]');
      if (head && labelRe.test(clean(head.textContent))) return clean(head.nextElementSibling && head.nextElementSibling.textContent).replace(/\*/g, "");
    }
    return "";
  };
  const richelieuSpec = labelRe => {
    for (const r of document.querySelectorAll(".pms-SpecTableRow")) {
      const k = r.querySelector(".pms-SpecName");
      if (k && labelRe.test(clean(k.textContent))) return clean(k.nextElementSibling && k.nextElementSibling.textContent).replace(/\*/g, "");
    }
    return "";
  };
  // The finish in a Strategic Brands name: a " - " part made only of finish words ("Steel T-Bar Pull - Oil Rubbed
  // Bronze - 192mm c/c - 241mm o/a"), else a run of finish words inside it ("Melrose Stainless Steel T-Bar Pull").
  const finishInName = name => {
    const parts = clean(name).split(/\s+-\s+/).slice(1);
    const whole = parts.find(p => !/\d/.test(p) && X.guessFinish(p) === p);
    if (whole) return whole;
    const words = clean(name).split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      for (let j = Math.min(words.length, i + 4); j > i; j--) {
        const run = words.slice(i, j).join(" ");
        if (!/\d/.test(run) && X.guessFinish(run) === run) return run;
      }
    }
    return "";
  };
  // Bain Ultra's configurator (11/5): pressed tiles per group ("Drain position: Right Drain", "Bath colour & finish:
  // Glossy Biscuit", "Bath technology: ThermoMasseur+$2610"), and the product data's tub variants
  // ("AMMA 6030 - TMU, BISCUIT, GLOSSY, STANDARD_DECK, RIGHT_DRAIN, ALCOVE", BAMBRA0RT-02, 6870.00).
  const bainChoices = () => {
    const out = {};
    for (const b of document.querySelectorAll("button.bu-configurator__selector-tile")) {
      if (b.getAttribute("aria-pressed") !== "true" && !/--selected\b/.test(b.className)) continue;
      let g = b.parentElement, title = "";
      for (let i = 0; i < 5 && g && !title; i++, g = g.parentElement) {
        const h = g.querySelector("[class*='selector-title'], [class*='step-title'], [class*='__title'], h2, h3, h4, legend");
        if (h && !b.contains(h)) title = clean(h.textContent).toLowerCase();
      }
      if (title && !(title in out)) out[title] = clean(b.textContent).replace(/\s*\+\s*\$[\d,.]+.*$/, "").trim();
    }
    return out;
  };
  const BAIN_TECH = { soaker: "TUB", thermomasseur: "TMU" };
  const bainVariant = () => {
    const c = bainChoices();
    const pick = re => Object.keys(c).find(k => re.test(k));
    const want = [];
    const drain = c[pick(/drain position/)], colour = c[pick(/colou?r/)], deck = c[pick(/deck/)], tech = c[pick(/technology/)];
    if (drain) want.push(drain.toLowerCase().replace(/\s+/g, "_"));
    if (deck) want.push(deck.toLowerCase().replace(/\s+/g, "_"));
    if (colour) want.push(...colour.toLowerCase().split(/\s+/));
    if (tech) want.push((BAIN_TECH[tech.toLowerCase().split(/\s+/)[0]] || tech.split(/\s+/)[0]).toLowerCase());
    if (!want.length) return null;
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      let j = null;
      try { j = JSON.parse(s.textContent); } catch { continue; }
      for (const o of [].concat(j || [])) {
        for (const v of [].concat((o && o.hasVariant) || [])) {
          const tokens = new Set(String(v.name || "").split(" - ").slice(1).join(" - ").split(/\s*,\s*/).map(x => x.trim().toLowerCase()));
          if (want.every(w => tokens.has(w))) {
            return { sku: String(v.sku || ""), price: String(([].concat(v.offers || [])[0] || {}).price || "") };
          }
        }
      }
    }
    return null;
  };
  const bainName = () => {
    const c = bainChoices();
    const get = re => c[Object.keys(c).find(k => re.test(k))] || "";
    const tech = get(/technology/);
    const techLabel = /^soaker/i.test(tech) ? "Soaker tub" : /^thermomasseur/i.test(tech) ? "ThermoMasseur air tub" : tech;
    const sub = clean((document.querySelector("h1 + *") || {}).textContent);
    const drainKit = [get(/drain finish/), get(/drain material/)].filter(Boolean).join(" ");
    return [clean(textOf("h1")) + (sub && sub.length < 60 ? ` ${sub}` : ""), techLabel, get(/drain position/),
      drainKit ? `drain kit ${drainKit}` : ""].filter(Boolean).join(", ");
  };

  // Sofia's shop (1.5.3): the chosen value of a select, the label of a checked radio, and the price lines it prints once a
  // model number is picked ("5 3/16 DEPTH (-1) POL $685", "POLISHED: $506", "LED POLISHED DBL STRIPS (DPLED) $887").
  const sofiaPick = name => { const s = document.querySelector(`select[name="${name}"]`); return s && s.value ? clean(s.value) : ""; };
  const sofiaChecked = name => {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    if (!r) return "";
    const lab = r.closest("label") || (r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`));
    return clean(lab && clean(lab.textContent) ? lab.textContent : r.value.replace(/([a-z])([A-Z])/g, "$1 $2"));
  };
  const sofiaEdgeOf = s => (/\(DPLED\)|^DPLED$/i.test(s) ? "dpled" : /\(PERLED\)|^PERLED$/i.test(s) ? "perled"
    : /\bBEV(?:EL(?:ED|LED)?)?\b/i.test(s) ? "bev" : /\bPOL(?:ISHED)?\b|FlatPolished/i.test(s) ? "pol" : "");
  const sofiaEdge = () => { const r = document.querySelector('input[name="ls"]:checked'); return r ? sofiaEdgeOf(r.value) : ""; };
  const sofiaPrices = () => (document.body ? document.body.innerText : "").split("\n").map(clean)
    .filter(l => /\$\s?\d/.test(l) && /DEPTH|POL|BEV/i.test(l) && !/\S\s{2,}\$/.test(l))
    .map(l => ({ depth: (/\((-\d)\)/.exec(l) || [])[1] || "", edge: sofiaEdgeOf(l), depthText: (/^(\d[\d\s\/]*DEPTH)/i.exec(l) || [])[1] || "",
      price: ((/\$\s?([\d,]+(?:\.\d{2})?)/.exec(l) || [])[1] || "").replace(/,/g, "") }));
  const sofiaDepthCode = () => {
    const d = sofiaPick("depth");
    if (!d) return "";
    const hit = sofiaPrices().find(p => p.depthText && p.depthText.toUpperCase() === d.toUpperCase());
    if (hit) return hit.depth;
    const s = document.querySelector('select[name="depth"]');
    const i = s ? [...s.options].filter(o => o.value).findIndex(o => o.value === s.value) : -1;
    return i >= 0 ? `-${i + 1}` : "";
  };

  // Fleurco's product title without its own tags: "*New* Vespero Pivot" is the Vespero Pivot (1.5.2).
  const fleurcoTitle = () => textOf(".product-page .title").replace(/\*[^*]*\*/g, " ").replace(/\s+/g, " ").trim();

  // Vendor sites that need their own rule, by main domain.
  const SITE_RULES = {
    // Fleurco's shower door configurator (2026-11-04) prints the model number and total only once every choice is
    // made, Mix & Match Kit included, under the options: "NHS160-25-40R-79 Total : $1821 (USD)". There is no h1.
    "fleurco.com": {
      requireModel: true, // nothing else on the page describes the item
      // model: () => textOf(".product-total .product-sku"),
      // 1.5.3 (sweep 11/5): the whole code before "Total :", add-ons included ("NHZT60-12-40 + NH-CONVKIT-33-MX
      // Total : $2070"), since the total includes them; nothing while a shown finish group has no choice (changing the
      // return can reset the finish while the page still prints the old code).
      model: () => {
        const finish = [...document.querySelectorAll('input[name="rdoHardwareFinish"]')];
        const shownFinish = finish.some(r => r.getClientRects().length ||
          [r.closest("label"), r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`)].some(l => l && l.getClientRects().length));
        if (shownFinish && !finish.some(r => r.checked)) return "";
        return clean(textOf(".product-total")).split(/\s*Total\s*:/i)[0].trim();
      },
      price: () => (textOf(".product-total").match(/\$\s?(\d[\d,]*(?:\.\d{2})?)/) || [])[1],
      // color: () => checkedLabel("rdoHardwareFinish"),
      // 1.5.3: bases, tubs and mirrors have their finish or material in other groups.
      color: () => checkedLabel("rdoHardwareFinish") || checkedLabel("rdoFinish") || checkedLabel("rdoMaterial"),
      // name: () => [textOf(".product-page .title"), checkedLabel("rdoGlassType")].filter(Boolean).join(", "),
      // collection: () => textOf(".product-page .title"),
      // name: () => [fleurcoTitle(), checkedLabel("rdoGlassType")].filter(Boolean).join(", "),
      // 1.5.3: with the subtitle's first part ("Tub enclosure", "Flat edge"), which also tells a tub door from a door.
      name: () => [fleurcoTitle(), clean(textOf(".product-page .subtitle")).split("|")[0].split(",")[0].trim(),
        checkedLabel("rdoGlassType")].filter(Boolean).join(", "),
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
      // price: () => {
      //   const el = [...document.querySelectorAll('[itemprop="price"]')].find(e => e.getClientRects().length);
      //   return el ? el.getAttribute("content") || el.textContent : "";
      // },
      // 1.5.3 (sweep 11/5): an Outlet / Recertified page shows its sale price in [itemprop=price] and the list price
      // struck through (.old-price "$1028.00"): the list price is the one for the quote.
      price: () => {
        const old = [...document.querySelectorAll(".pdp-prod-price-block .old-price")].find(e => e.getClientRects().length);
        if (old && amountOf(old.textContent)) return amountOf(old.textContent);
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
      // 1.5.3 (sweep 11/5): options that load another product (Crue to Touchless, Verdera width) change the h1 and the
      // price shown, while the product data still describes the first product. The price stays the one Kohler shows
      // ("Current Price $431.25"), as Gib decided on 11/5 ("Leave the Kohler price"); the "List Price $575.00" printed
      // beside it is not used:
      // price: () => amountOf(textOf(".product-detail-page__list-price--associate")),
      price: () => amountOf(textOf(".product-detail-page__price-value")),
      name: () => textOf("h1"),
    },
    // 1.5.3 color readers (Gib 11/5). Each reads what the page shows; the panel follows a change (pageKey).
    // TOTO: "Color: Cotton" over the swatches ("Trip Lever Color/Finish:" is a different option).
    "totousa.com": {
      // color: () => labeled("legend", /^colou?r\s*:\s*(.+)$/i),
      color: () => labeled("legend", /^colou?r\s*:\s*(.+)$/i).replace(/\s*Made to Order \(MTO\)\s*$/i, ""),
      // 1.5.3 (sweep 11/5): "MSRP LIST PRICE" adds the checked add-ons ("14″ [+$122.00]", a trip lever [+$59.00]) to
      // the toilet's own price, while the SKU stays the same: the SKU's price goes on the quote and the add-ons go in
      // Coll/Desc for the rep.
      price: () => {
        const total = Number(amountOf(textOf(".sku-row .price .amount") || textOf(".sku-row .price")));
        if (!total) return "";
        let extra = 0;
        for (const r of document.querySelectorAll('input[type="radio"]:checked')) {
          if (/^color_|quantity/i.test(r.name)) continue;
          const lab = r.closest("label") || (r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`));
          const m = lab && /\[\+\s*\$([\d,.]+)\]/.exec(lab.textContent);
          if (m) extra += Number(m[1].replace(/,/g, ""));
        }
        return String(Math.round((total - extra) * 100) / 100);
      },
      name: () => {
        const opts = [...document.querySelectorAll("legend")].map(l => clean(l.textContent))
          .filter(s => /:\s*\S/.test(s) && !/^colou?r\s*:/i.test(s) && !/coupon|quantity|contact|feedback/i.test(s))
          .map(s => s.replace(/\s*Option\s*:/i, ":").replace(/\s*Color\/Finish\s*:/i, ":").replace(/:\s*/, " "));
        return [textOf("h1"), ...opts].filter(Boolean).join(", ");
      },
    },
    // Craft & Main (Shopify): "Color: White Oak" over the options.
    "craftandmain.com": {
      color: () => labeled("legend", /^colou?r\s*:\s*(.+)$/i),
      // 1.5.3 (sweep 11/5): the product data keeps the first variant; the shown SKU follows the size, color and glass
      // picked (CVNA0474-CL-BN to CVNA0674-CL-SV), as reps enter it (LGDR4876-CL-SV). The price is hidden on the site.
      model: () => { const e = [...document.querySelectorAll(".product-sku")].find(x => x.getClientRects().length); return e ? clean(e.textContent) : ""; },
      price: () => { const e = [...document.querySelectorAll(".product-price-container .price")].find(x => x.getClientRects().length); return e ? amountOf(e.textContent) : ""; },
      ownPrice: true,
    },
    // Brizo: "Selected Finish: Polished Chrome" next to the swatches.
    "brizo.com": {
      color: () => labeled(".finish", /^selected finish\s*:\s*(.+)$/i),
      // 1.5.3 (sweep 11/5): a combo (faucet + handle kit + rough) lists each part under "Product(s) Shown" and a "List
      // price as shown"; its address has too many parts for a model. A single item lists itself there too.
      // A single item's "Product(s) Shown" can add its required rough valve (T66T030-PC + R35000-WS); only a combo's
      // address joins parts with "--" (65368LF-PCLHP-ECO--HL5368-PCCL).
      model: () => (/--/.test(location.pathname) ? [...document.querySelectorAll(".prd-as-shown .row .col-sm span")]
        .map(e => clean(e.textContent)).filter(s => /\d/.test(s)).join(" + ") : ""),
      price: () => (/--/.test(location.pathname) ? amountOf(textOf(".prd-as-shown .row.listPrice .prd-as-shown-price")) : ""),
    },
    // Richelieu: the option picker's "Finish:" heading, then the chosen finish ("Brushed Nickel").
    "richelieu.com": {
      // color: () => {
      //   for (const q of document.querySelectorAll("rc-skuquestion")) {
      //     const head = q.querySelector('span[slot="head"]');
      //     if (head && /^finish\b/i.test(clean(head.textContent))) return clean(head.nextElementSibling && head.nextElementSibling.textContent);
      //   }
      //   return "";
      // },
      // 1.5.3 (sweep 11/5): items without a finish picker name it in the specifications ("Finish | Brass, White").
      color: () => richelieuOption(/^finish\b/i) || richelieuSpec(/^finish$/i),
      // Only the product's own number counts: the home page's carousel tiles print "Product # WEBKIT1259480" above the
      // heading, and a family page says "The model 8160 is available in 8 finishes".
      model: () => textOf("#pm2_topInfo .pms-ProductNumber").replace(/^\s*product\s*#\s*/i, ""),
      productOnlyWithModel: true,
      // The size is part of what the customer picked: "Modern Metal Pull - 7325, 3 25/32 in".
      name: () => {
        const size = richelieuOption(/^center to center/i) || richelieuSpec(/^center to center/i) || richelieuSpec(/^diameter/i);
        return [textOf("h1"), size].filter(Boolean).join(", ");
      },
    },
    // Franke: the product information table, "Product finish | Copper".
    "franke.com": {
      color: () => rowValue("tr.cmp-product-information-table__section-list__item", /^product finish$/i),
      // 1.5.3 (sweep 11/5): reps order Franke by the model code that ends the heading ("Maris Undermount Sink -
      // MAG11031OW-SHG", "Colander - OC2-60S"; PROD lines: MAG61020-PWT, PS2X110-24), not the Article Number.
      // model: () => (/[-,]\s*([A-Z0-9][A-Z0-9-]*\d[A-Z0-9-]*)\.?$/.exec(textOf("h1")) || [])[1] || "",
      // Faucet codes can have no digit ("Mythos Masterpiece Pull-Down, MMX-PD-CPR"): capitals in dashed parts count too.
      model: () => (/[-,]\s*([A-Z0-9]*\d[A-Z0-9-]*|[A-Z0-9]{2,}(?:-[A-Z0-9]+)+)\.?$/.exec(textOf("h1")) || [])[1] || "",
    },
    // Elkay: the specifications table; a sink has only "Material | Stainless Steel", a faucet may have a finish row.
    "elkay.com": {
      // color: () => rowValue("tr", /^(finish|colou?r|colou?r\s*\/\s*finish)$/i) || rowValue("tr", /^material$/i),
      // 1.5.3 (sweep 11/5): the chosen finish tile first ("Lustrous Steel", "Greystone"); Material only when the page
      // has no finishes to pick ("Brass" is not a faucet's finish).
      color: () => {
        const tile = document.querySelector("a.pdp-configuration-finish.selected .pdp-configuration-finish-caption");
        if (tile) return clean(tile.textContent);
        const row = rowValue("tr", /^(finish|colou?r|colou?r\s*\/\s*finish)$/i);
        if (row) return row;
        return document.querySelector("a.pdp-configuration-finish") ? "" : rowValue("tr", /^material$/i);
      },
      // The list price sits behind "Show List Price" ("$745.00 (USD)", hidden until clicked); a base model shows a
      // range ("$1,154.00 - $1,574.00 (USD)") until a finish is picked.
      price: () => amountOf(textOf("h3.product-price") || (document.querySelector("h3.product-price") || {}).textContent || ""),
      category: () => rowValue("tr", /^room$/i), // "Kitchen": a sink's Type
      pickFirst: () => !!document.querySelector("a.pdp-configuration-finish") && !document.querySelector("a.pdp-configuration-finish.selected"),
      pickHint: "Pick the finish on the page first: each finish has its own model number and price.",
    },
    // John Boos: the wood is the first word of the name.
    "johnboos.com": {
      // color: () => {
      //   const m = WOODS.exec(textOf("h1"));
      //   return m ? m[1].replace(/\b\w/g, ch => ch.toUpperCase()) : "";
      // },
      // 1.5.3 (sweep 11/5): else the description ("...features a 1-1/2″ thick Northern Hard Rock Maple top").
      color: () => {
        const m = WOODS.exec(textOf("h1")) || WOODS.exec((document.querySelector('meta[name="description"]') || {}).content || "");
        return m ? m[1].replace(/\b\w/g, ch => ch.toUpperCase()) : "";
      },
      name: () => textOf("h1"), // the og:title is an SEO title ("John Boos R-Series ... End Grain" for an edge-grain board)
    },
    // 1.5.3 (sweep 11/5) new vendors and rules.
    // Grohe (Shopify): the product data keeps the linked variant and a price 75% of list; the page shows the variant it
    // switched to: "Model: 1062150000" ([data-product-sku]), "List price: $479.00" ([data-price-list="<variant id>"]),
    // the finish ([data-swatch-label="Finish"] "GROHE StarLight Chrome") and the collection before the h1 ("Listra").
    "grohe.us": {
      model: () => textOf("[data-product-sku]"),
      price: () => {
        const id = new URLSearchParams(location.search).get("variant");
        const el = (id && document.querySelector(`[data-price-list="${CSS.escape(id)}"]`)) ||
          [...document.querySelectorAll("[data-price-list]")].find(e => e.getClientRects().length);
        return el ? amountOf(el.textContent.replace(/^[\s\S]*?list price/i, "")) : "";
      },
      color: () => textOf('[data-swatch-label="Finish"]').replace(/^GROHE\s+/i, ""),
      collection: () => {
        const h = document.querySelector("h1");
        const p = h && h.previousElementSibling;
        const span = p && p.querySelector("span");
        return span ? clean(span.textContent).replace(/[®™]/g, "").replace(/^GROHE\s+/i, "") : "";
      },
      ownPrice: true,
    },
    // Icera (WooCommerce): picking a color changes the SKU (C-6690.01 to C-6690.55) and the variation price, not the
    // address. A two-piece toilet's SKU is bowl and tank together ("C-3690.01, T-3690.01"), as reps enter it.
    "icerabath.com": {
      model: () => textOf("span.sku"),
      // price: () => amountOf(textOf(".woocommerce-variation-price .price") || textOf(".summary .price")),
      price: () => amountOf(textOf(".woocommerce-variation-price .price") || textOf(".summary .price") || textOf("p.price, span.price, .price")),
      color: () => {
        const s = document.querySelector('select[name="attribute_pa_colors"]');
        return s && s.value && s.selectedOptions[0] ? clean(s.selectedOptions[0].textContent) : "";
      },
      pickFirst: () => { const s = document.querySelector('select[name="attribute_pa_colors"]'); return !!s && !s.value; },
      pickHint: "Pick the color on the page first: each color has its own model number and price.",
      ownPrice: true,
    },
    // Bain Ultra: a configurator. The pressed drain, colour, deck and technology tiles name one tub variant in the product
    // data (BAMBRA0RT-02, $6,870); the page's total adds the drain kit, which reps order on its own line.
    "bainultra.com": {
      model: () => { const v = bainVariant(); return v ? v.sku : textOf(".bu-configurator__summary-product-sku"); },
      price: () => { const v = bainVariant(); return v && v.price ? v.price : amountOf(textOf(".bu-configurator__summary-cta-price")); },
      color: () => { const c = bainChoices(); return c[Object.keys(c).find(k => /colou?r/.test(k))] || ""; },
      name: () => bainName(),
    },
    // Top Knobs (Magento): before a size and finish are picked, the item number is the product's name and the og price
    // is the family's lowest. After the picks: "Item Number TK1013PN", the price box, the "Finish" spec row.
    "topknobs.com": {
      model: () => { const s = textOf(".product-info-main [itemprop=sku]"); return /\d/.test(s) ? s : ""; },
      price: () => {
        const el = [...document.querySelectorAll('.product-info-main .price-box [data-price-amount]')]
          .find(e => /basePrice|finalPrice/i.test(e.getAttribute("data-price-type") || "")) ||
          document.querySelector(".product-info-main .price-box [data-price-amount]");
        return el ? el.getAttribute("data-price-amount") : "";
      },
      color: () => specValue("#product-attribute-specs-table tr", /^finish$/i),
      collection: () => specValue("#product-attribute-specs-table tr", /^collection$/i).replace(/^TOP BATH\s*(?:\(R\)|®)?\s*/i, ""),
      name: () => textOf("h1"),
      pickFirst: () => !/\d/.test(textOf(".product-info-main [itemprop=sku]")),
      pickHint: "Pick the size and finish on the page first: the item number and price show once both are chosen.",
      ownPrice: true,
    },
    // Flusso (Gib 11/5, "get Flusso working better"): the collection is the details row "Collection | Serie 250";
    // kitchen items say just "Kitchen" there, which is not a collection.
    "flussofaucets.com": {
      collection: () => {
        const v = rowValue("tr", /^collection$/i);
        // return /^(kitchen|bath|bathroom|shower|showering|tub|accessories)$/i.test(v) ? "" : v;
        return /^(kitchen|bath|bathroom|shower|showering|tub|accessories|universal fixtures)$/i.test(v) ? "" : v; // 1.5.3: a catch-all
      },
    },
    // Sofia (1.5.3, a special-order line since 11/5): the shop builds the item from a model number (size), a depth,
    // an edge or LED option and an interior or frame finish, then lists a price per depth and edge ("5 3/16 DEPTH (-1)
    // BEV $721", "POLISHED: $506", "LED POLISHED PERIMETER (PERLED) $1129"). Reps write "EVA 2134 1D-1": the model
    // number and the depth code.
    "sofiamedicinecabinets.com": {
      requireModel: true, // the shop pages have no product data: the item is what the picks make
      hint: "Pick the model number (size), and the depth when the page asks, first: the price shows for the edge you pick.",
      model: () => {
        const m = sofiaPick("model_number");
        if (!m) return "";
        const depth = sofiaDepthCode();
        return document.querySelector('select[name="depth"]') ? (depth ? `${m}${depth}` : "") : m;
      },
      price: () => {
        const edge = sofiaEdge();
        const depth = sofiaDepthCode();
        const fits = sofiaPrices().filter(p => (!depth || !p.depth || p.depth === depth) && (!edge || !p.edge || p.edge === edge));
        const prices = [...new Set(fits.map(p => p.price))];
        return prices.length === 1 ? prices[0] : "";
      },
      color: () => [sofiaChecked("eff"), sofiaChecked("ls"), sofiaChecked("interior_design") ? `${sofiaChecked("interior_design")} interior` : ""]
        .filter(Boolean).join(", "),
      name: () => {
        const extras = [...document.querySelectorAll('input[type="checkbox"]:checked')].map(c => clean(c.value).replace(/^,\s*/, "")).filter(Boolean);
        const depth = sofiaPick("depth").replace(/\s*DEPTH$/i, " depth").toLowerCase();
        const led = sofiaPick("lstrips") ? `LED ${sofiaPick("lstrips")}` : "";
        const hinge = sofiaChecked("hinge") ? `${sofiaChecked("hinge").replace(/^H/, "")} hinge` : "";
        return [textOf(".product_title h2"), depth, led, hinge, extras.length ? `with ${extras.join(", ")}` : ""].filter(Boolean).join(", ");
      },
      category: () => (/mirror/i.test(`${location.pathname} ${textOf(".product_title h2")}`) ? "Flat Mirror" : /cabinet/i.test(location.pathname) ? "Medicine Cabinet" : ""),
      pickFirst: () => !!document.querySelector('select[name="model_number"]') &&
        (!sofiaPick("model_number") || (!!document.querySelector('select[name="depth"]') && !sofiaPick("depth"))),
      pickHint: "Pick the model number (size), and the depth when the page asks, first: the price shows for the edge you pick.",
      ownPrice: true,
    },
    // Strategic Brands (2026-11-05, Jim): names read "128mm Austin Pull - Satin Nickel"; the finish is the last part,
    // and the collection is in the "parts in this collection" link (...termsFilters[product_collection][Austin]=1).
    "strategicbrandsincorporated.com": {
      // color: () => {
      //   const parts = textOf("h1").split(/\s+-\s+/);
      //   return parts.length > 1 ? parts[parts.length - 1] : "";
      // },
      // collection: () => {
      //   const a = document.querySelector('a[href*="product_collection"]');
      //   const m = a && /product_collection\]\[([^\]]+)\]/.exec(decodeURIComponent(a.getAttribute("href") || ""));
      //   return m ? m[1].replace(/\+/g, " ") : "";
      // },
      // 1.5.3 (sweep 11/5): the last part can be a size ("- 384mm - 17"" Overall", "- 241mm o/a"); the finish is the
      // part made of finish words. The collection comes only from the product's own "Click here to see all the parts in
      // this collection" link (the collections pages list many). The site doubles inch marks (3"" Pull).
      color: () => finishInName(textOf("h1")),
      collection: () => {
        const a = [...document.querySelectorAll('a[href*="product_collection"]')].find(x => /parts in this collection/i.test(x.textContent));
        const m = a && /product_collection\]\[([^\]]+)\]/.exec(decodeURIComponent(a.getAttribute("href") || ""));
        return m ? m[1].replace(/\+/g, " ") : "";
      },
      name: () => textOf("h1").replace(/""/g, '"'),
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
    // return {
    //   name: v.name || document.title, model: v.model, color: v.color || "", price: X.number(v.price),
    //   currency: "USD", priceIsList: false, imageUrl: "", collection: v.collection || "",
    // };
    // 1.5.3 (sweep 11/5): also for a page whose rule names the item while nothing else does (a Brizo combo has no
    // product data and too many parts in its address): its og:title, a short heading as the collection ("Allaria"),
    // and its og:image.
    const meta = p => (document.querySelector(`meta[property="${p}"]`) || {}).content || "";
    const name = v.name || X.text(meta("og:title")).replace(/\s*\|.*$/, "") || document.title;
    return {
      name, model: v.model, color: v.color || "", price: X.number(v.price),
      currency: "USD", priceIsList: false, collection: v.collection || X.guessCollection({ name }, pageText()),
      imageUrl: (() => { try { const u = new URL(meta("og:image"), location.href); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } })(),
    };
  }

  // The site's live values over what the product data says (Delta's chosen finish, its price and collection).
  function withSiteValues(found) {
    if (!siteRule || siteRule.requireModel || !found.items.length) return found;
    const v = siteValues();
    // The page shows which of the product data's colors is chosen (Kohler): select it; its color and price are its own.
    const shown = v.model ? found.items.findIndex(it => String(it.model).toUpperCase() === v.model.toUpperCase()) : -1;
    // if (found.items.length > 1 && shown >= 0) {
    //   return { ...found, selected: shown, follows: true, items: found.items.map((x, j) => (j === shown && v.collection
    //     ? { ...x, collection: v.collection.replace(/[®™]/g, "").trim() } : x)) };
    // }
    // 1.5.3 (sweep 11/5): the shown variant also takes the page's price and name (Kohler's list price, Bain's tub with
    // its options), not only its collection.
    const own = it => {
      const out = { ...it };
      if (v.color) out.color = v.color;
      if (v.price && X.number(v.price)) out.price = X.number(v.price);
      else if (siteRule.ownPrice) out.price = null; // the rule's price or none (Top Knobs' og price is the family's lowest)
      if (v.name) out.name = v.name;
      if (v.collection) out.collection = v.collection.replace(/[®™]/g, "").trim();
      return out;
    };
    if (found.items.length > 1 && shown >= 0) {
      return { ...found, selected: shown, follows: true, items: found.items.map((x, j) => (j === shown ? own(x) : x)) };
    }
    const i = Math.max(found.selected, 0);
    // const it = { ...found.items[i] };
    // if (v.model) it.model = v.model;
    // if (v.color) it.color = v.color;
    // if (v.price && X.number(v.price)) it.price = X.number(v.price);
    // if (v.name) it.name = v.name;
    // if (v.collection) it.collection = v.collection.replace(/[®™]/g, "").trim();
    const it = own(found.items[i]);
    if (v.model) it.model = v.model;
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
    // if (!found.items.length) found = await readFromServer();
    // 1.5.3 (sweep 11/5): on a site whose product pages always print their own number (Richelieu), a page without one
    // is not a product page, whatever else its text says (the home page's carousel, a family page's prose).
    const notProduct = !!(siteRule && siteRule.productOnlyWithModel && !siteValues().model);
    if (notProduct) found = { ...found, items: [], selected: -1 };
    // 1.5.3: nothing generic to read, but the site's rule names the item (a Brizo combo): the rule's values make it.
    if (!found.items.length && !notProduct && siteRule && !siteRule.requireModel) {
      const ruled = siteItem();
      if (ruled) found = { ...found, items: [ruled], selected: 0, follows: true };
    }
    // if (!found.items.length && !notProduct) found = await readFromServer();
    // 1.5.3 (sweep 11/5): not on a configurator (Fleurco): with no model chosen yet there is nothing more in its HTML,
    // and fetching its 485 KB page kept "Updating..." up for 5 to 8 seconds.
    if (!found.items.length && !notProduct && !(siteRule && siteRule.requireModel)) found = await readFromServer();
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
    // 1.5.2: on a page with no model yet (Fleurco mid-configurator), the site rule's own name, finish and collection
    // beat the tab title ("Vespero Pivot, Fluted (6mm)", not "Vespero Pivot| High-Quality Shower Doors | Fleurco").
    if (manual) {
      const blank = X.blankItem(live.meta, live.page, document.title, location.href);
      const v = siteValues();
      // items = [{ ...blank, name: v.name || blank.name, color: v.color || "", collection: v.collection || "" }];
      // A configurator's own name (Fleurco mid-choices) still describes the product; another rule's name on a page with
      // no product (Richelieu's home page heading) does not.
      items = [{ ...blank, name: v.name || blank.name, color: v.color || "", collection: v.collection || "", ruleNamed: !!(v.name && siteRule.requireModel) }];
    } else {
      items = found.items;
    }
    selected = manual ? 0 : found.selected;
    // 1.5.3: what the site's rule adds to the breadcrumbs for the Type guess (Elkay's "Room" row, Bain's technology).
    if (siteRule && siteRule.category) category = [X.text(siteRule.category()), category].filter(Boolean).join(" / ");
    gone = !manual && X.discontinued(live.page);
    // 1.5.3: the page needs a choice before it names one item (Elkay's base model with finish tiles, Icera before a
    // color, Top Knobs before a size and finish): no model or price yet, and the panel says what to pick.
    pickNeeded = !manual && !!(siteRule && siteRule.pickFirst && siteRule.pickFirst());
    if (pickNeeded) items = items.map(it => ({ ...it, model: "", price: null }));
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
    // f.description.value = X.collDesc(it.collection, it.name || "");
    // 1.5.3 (sweep 11/5): without the model number and a trailing finish (they have their own fields), and empty on a
    // page with nothing to read, where the heading is a category or a slogan ("TURN ROUTINE INTO RITUAL").
    f.description.value = manual && !it.ruleNamed ? "" : X.collDesc(it.collection, X.descName(it.name || "", it.model, it.color));
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
      // 1.5.3 (sweep 11/5): the line the page's breadcrumbs name, by the line's first word (Strategic Brands:
      // "Home > Laurey > Melrose" is LAUREY, "Home > MNG > Hammer" is MNG Hardware). Otherwise the customer picks.
      const crumbs = new Set(X.words(category));
      const named = siteLines.filter(l => crumbs.has(X.words(l.name)[0]));
      if (named.length === 1) f.line.value = named[0].id;
    }
    f.lineWrap.hidden = siteLines.length <= 1;
  }
  function currentLine() {
    return siteLines.length === 1 ? siteLines[0] : siteLines.find(l => l.id === f.line.value) || null;
  }
  // function fillTypes() {
  //   const line = currentLine();
  //   const options = line ? (line.types || []).filter(t => !t.requiresAttachment) : [];
  //   f.type.innerHTML = "";
  //   f.type.appendChild(new Option("Choose a type", "")); // required since 1.5.2
  //   for (const t of options) f.type.appendChild(new Option(t.name, t.id));
  //   const it = items[selected] || {};
  //   const guess = X.suggestType({ name: it.name || f.description.value, pageUrl: location.href, category }, options);
  //   f.type.value = guess ? guess.id : "";
  //   f.typeWrap.hidden = options.length === 0;
  // }
  // 1.5.3 (sweep 11/5): order-form Types are offered too, marked as such (Bain Ultra's tubs are AIR TUB / SOAKER, and
  // without them the required Type forced MISCELLANEOUS); the Product Selector sends those as "Per Attached Order
  // Form". No guess on a page with nothing to read (a category page's heading is not a product).
  function fillTypes() {
    const line = currentLine();
    const options = line ? (line.types || []) : [];
    f.type.innerHTML = "";
    f.type.appendChild(new Option("Choose a type", "")); // required since 1.5.2
    for (const t of options) {
      const o = new Option(t.requiresAttachment ? `${t.name} (order form)` : t.name, t.id);
      o.dataset.name = t.name;
      o.dataset.orderForm = t.requiresAttachment ? "1" : "";
      f.type.appendChild(o);
    }
    const it = items[selected] || {};
    const guess = manual && !it.ruleNamed ? null
      : X.suggestType({ name: it.name || f.description.value, pageUrl: location.href, category }, options, { orderForms: true });
    f.type.value = guess ? guess.id : "";
    f.typeWrap.hidden = options.length === 0;
    showOrderForm();
  }
  function showOrderForm() {
    const o = f.type.selectedOptions[0];
    f.orderFormHint.hidden = !(o && o.dataset.orderForm);
  }

  // keep: the panel is already open and the page changed under it (another finish); keep the quantity and line.
  function openPanel(keep = false) {
    if (!items.length) return;
    f.variant.innerHTML = "";
    // 1.5.3: a variant without a color is named by what sets it apart from the others (Bain Ultra's variants are
    // "AMMA 6030 - TMU, BISCUIT, ..., RIGHT_DRAIN, ALCOVE"), not by its bare SKU.
    let common = 0;
    if (items.length > 1) {
      const names = items.map(it => String(it.name || ""));
      while (common < names[0].length && names.every(n => n[common] === names[0][common])) common++;
      while (common > 0 && !/[\s,-]/.test(names[0][common - 1])) common--;
    }
    items.forEach((it, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      // o.textContent = [it.color, it.model].filter(Boolean).join(" - ") || it.name;
      const label = it.color || (items.length > 1 ? String(it.name || "").slice(common).replace(/_/g, " ").trim() : "");
      o.textContent = [label, it.model].filter(Boolean).join(" - ") || it.name;
      f.variant.appendChild(o);
    });
    // f.variantWrap.style.display = items.length > 1 ? "" : "none";
    f.variantWrap.style.display = items.length > 1 && !followsPage ? "" : "none";
    // f.manualHint.hidden = !manual;
    // f.manualHint.textContent = (siteRule && siteRule.hint) || MANUAL_HINT;
    f.manualHint.hidden = !manual && !pickNeeded;
    f.manualHint.textContent = pickNeeded ? siteRule.pickHint || MANUAL_HINT : (siteRule && siteRule.hint) || MANUAL_HINT;
    f.goneHint.hidden = !gone; // 1.5.3
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

  // 1.5.2 (Gib 11/5): every field is required before adding (John Boos left Color / finish empty). Product line and
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
      // typeName: f.type.value && typeOption ? typeOption.textContent : "",
      typeName: f.type.value && typeOption ? typeOption.dataset.name || typeOption.textContent : "", // without "(order form)"
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
  f.type.addEventListener("change", showOrderForm); // 1.5.3
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
  // 1.5.2 (Gib 11/5, Fleurco's Vespero Pivot): a configurator (requireModel) changes the shown model, finish and total
  // without a new address, so those count too; the open panel greys out and follows each choice.
  // const pageKey = () => {
  //   const v = siteValues();
  //   return `${location.href}|${v.model || ""}|${v.color || ""}|${v.price || ""}`;
  // };
  // 1.5.3 (sweep 11/5): the rule's name too, so a pick that changes only the description follows (TOTO's 14″
  // rough-in keeps the SKU and price; Richelieu's size, Bain's drain kit).
  const pageKey = () => {
    const v = siteValues();
    return `${location.href}|${v.model || ""}|${v.color || ""}|${v.price || ""}|${v.name || ""}`;
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
  // detect();
  // 1.5.3 (sweep 11/5): a finish that is its own page (Brizo, Elkay, Franke and Flusso swatches are links) loaded a
  // new page and closed the panel. When the panel was open as a page of this site went away, the next one reopens it
  // with the same quantity. sessionStorage stays with this tab and this site, so another site or tab is not affected.
  const REOPEN_KEY = "consumers-quickadd-reopen";
  window.addEventListener("pagehide", () => {
    try {
      // if (panel.style.display === "block") sessionStorage.setItem(REOPEN_KEY, JSON.stringify({ at: Date.now(), qty: f.qty.value }));
      // Not after a successful Add: the customer is browsing on, not changing the finish.
      const added = !msg.hidden && msg.classList.contains("ok");
      if (panel.style.display === "block" && !added) sessionStorage.setItem(REOPEN_KEY, JSON.stringify({ at: Date.now(), qty: f.qty.value }));
    } catch {}
  });
  let reopen = null;
  try {
    reopen = JSON.parse(sessionStorage.getItem(REOPEN_KEY) || "null");
    sessionStorage.removeItem(REOPEN_KEY);
  } catch {}
  detect().then(() => {
    if (!reopen || Date.now() - Number(reopen.at) > 20000) return;
    // Let the new page finish drawing its product (and pick its finish) before it is read again.
    setTimeout(async () => {
      if (panel.style.display === "block" || reading) return;
      reading = true;
      try {
        await detect();
      } finally {
        reading = false;
      }
      openPanel();
      const qty = Math.trunc(Number(reopen.qty));
      if (qty >= 1) f.qty.value = String(qty);
    }, 1200);
  });
  refreshCount();
})();
