// Consumers QuickAdd (Consumers Quote Helper until 1.5.0), on vendor websites (only the product lines' domains): shows an "Add to CPS Quote List"
// button on product pages. The panel lives in a shadow root so the vendor's styles and ours never mix.
(() => {
  "use strict";
  if (window.__consumersQuoteHelper) return;
  window.__consumersQuoteHelper = true;
  // 1.5.1: another copy of the extension (one loaded by hand next to the Group Policy one) already put its button on
  // this page; one button is enough. Each copy runs in its own isolated world, so only the shared DOM shows it.
  // if (document.querySelector("[data-consumers-quote-helper]")) return;
  // 1.5.4 (Gib 11/6: an old copy let an item through with a field missing): the newest copy wins. Each button carries
  // its copy's version; a copy before 1.5.4 carries none. A newer copy takes an older one's place on the page, so a
  // PC that still has a hand-loaded copy next to the Group Policy one shows the current panel.
  const MY_VERSION = (() => { try { return chrome.runtime.getManifest().version; } catch { return "0"; } })();
  const newer = (a, b) => { // a newer than b ("1.5.10" > "1.5.9")
    const pa = String(a || "0").split(".").map(Number), pb = String(b || "0").split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    return false;
  };
  const others = () => [...document.querySelectorAll("[data-consumers-quote-helper]")];
  if (others().some(h => !newer(MY_VERSION, h.getAttribute("data-consumers-quote-helper")))) return; // as new or newer is there
  for (const h of others()) h.remove(); // older copies' buttons
  const X = globalThis.ConsumersExtract;

  const host = document.createElement("div");
  // host.setAttribute("data-consumers-quote-helper", "");
  host.setAttribute("data-consumers-quote-helper", MY_VERSION);
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
      .head-btns { display: flex; gap: 6px; align-items: center; } /* 1.5.6 */
      .side { background: transparent; border: 0; color: #dbe4ff; font-size: 18px; cursor: pointer; line-height: 1; padding: 0 2px; }
      .panel.left, .fab.left { left: 20px; right: auto; }
      /* 1.5.7: Report issue, at the left of the buttons, and its form above them. */
      .actions .report { margin-right: auto; border-color: transparent; background: transparent; color: #1f4fd1; padding-left: 4px; padding-right: 4px; }
      .actions .report:hover { text-decoration: underline; }
      .report-box { display: grid; gap: 8px; padding: 0 16px 12px; }
      .report-box b { font-size: 14px; font-weight: 650; }
      textarea { width: 100%; min-width: 0; font-size: 14px; padding: 9px 10px; border: 1px solid #c3c9d6; border-radius: 8px; background: #fff; color: #1d2433;
        font-family: inherit; text-transform: none; letter-spacing: 0; font-weight: 400; resize: vertical; }
      .r-actions { display: flex; gap: 8px; justify-content: flex-end; }
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
      /* 1.5.5: a kit's parts, one block each. */
      .single, .parts { display: grid; gap: 10px; }
      .part { display: grid; gap: 8px; border: 1px solid #e3e6ec; border-radius: 10px; padding: 10px; background: #fafbfd; }
      .part .ptitle { display: flex; gap: 10px; align-items: center; font-size: 13px; font-weight: 650; color: #1d2433; }
      .part .ptitle img { width: 36px; height: 36px; object-fit: contain; border: 1px solid #e3e6ec; border-radius: 6px; background: #fff; }
      .hint.kit { background: #eef3ff; color: #1d3a8a; border-radius: 8px; padding: 8px 10px; }
      /* 1.5.6: a part sold separately can be unticked. */
      .part .pon-wrap { display: flex; gap: 6px; align-items: center; text-transform: none; letter-spacing: 0; font-size: 13px; font-weight: 600; color: #1d2433; }
      .part .pon-wrap input { width: auto; }
      .part.off { opacity: .55; }
    </style>
    <!-- 1.5.0 (Gib 11/5): "Add to CPS Quote List", and the subtext asks to check the fields. Was:
    <button class="fab" type="button" part="fab"><span>Add to Consumers Quote</span><span class="dot" hidden></span></button>
    <div class="panel" role="dialog" aria-label="Add to Consumers Quote">
      <div class="head"><div><b>Add to Consumers Quote</b><small>Your sales rep finishes it in the Product Selector</small></div>... -->
    <button class="fab" type="button" part="fab"><span>Add to CPS Quote List</span><span class="dot" hidden></span></button>
    <div class="panel" role="dialog" aria-label="Add to CPS Quote List">
      <!-- 1.5.6 (sweep 2): a button moves the panel to the other side when it covers the page's own pickers (Richelieu's
      finish chips at 1440 px). Was: ...</small></div><button class="x" type="button" aria-label="Close">&times;</button></div> -->
      <div class="head"><div><b>Add to CPS Quote List</b><small>Confirm all fields are correct before adding</small></div><div class="head-btns"><button class="side" type="button" aria-label="Move this panel to the other side of the page" title="Move to the other side">&#8644;</button><button class="x" type="button" aria-label="Close">&times;</button></div></div>
      <div class="body">
        <div class="prod"><img alt=""><div class="name"></div></div>
        <label class="variant-wrap">Option<select class="variant"></select></label>
        <label class="line-wrap" hidden>Product line<select class="line"></select></label>
        <!-- 1.5.5: the one item's fields; a kit shows one block per part instead (.parts). -->
        <div class="single">
        <label class="type-wrap" hidden>Type<select class="type"></select></label>
        <div class="row">
          <label>Model<input class="model" maxlength="300"></label>
          <label>Color / finish<input class="color" maxlength="300"></label>
        </div>
        <!-- 2026-11-05 (Gib): one field, as NetSuite's Coll/Desc. Was two:
        <label>Collection<input class="collection" maxlength="300"></label>
        <label>Description<input class="description" maxlength="300"></label> -->
        <label>Collection / Description<input class="description" maxlength="300"></label>
        </div>
        <div class="hint kit kit-hint" hidden></div>
        <div class="parts" hidden></div>
        <div class="hint warn kit-total-hint" hidden></div>
        <div class="row">
          <!-- 1.5.7 (Gib 11/6: the list price, not the sale price): was "Price on this site". -->
          <label class="price-wrap">List price<input class="price" type="number" min="0" step="0.01" inputmode="decimal"></label>
          <label><span class="qty-label">Quantity</span><input class="qty" type="number" min="1" max="1000000" step="1" value="1" inputmode="numeric"></label>
        </div>
        <div class="hint manual-hint" hidden>We could not read this item from the page. Type the model number and color shown on it.</div>
        <div class="hint warn gone-hint" hidden>This page says the item is discontinued. Check with your sales rep before adding it.</div>
        <div class="hint order-form-hint" hidden>This Type is ordered on the vendor's order form: your sales rep attaches it to your quote.</div>
        <!-- 1.5.7 (Gib 11/6, "Change to: Confirm all Information Above"). Was:
        <div class="hint">Your Consumers sales rep confirms the list price and finishes this on your quote.</div> -->
        <div class="hint confirm-note">Confirm all Information Above</div>
        <div class="msg" hidden></div>
      </div>
        <!-- 1.5.7 (Gib 11/6, "add a report issue button to the extension"): sent to the Product Selector's Report Issue. -->
        <div class="report-box" hidden>
          <b>Report an issue</b>
          <label>What went wrong?<textarea class="r-text" rows="3" maxlength="4000" placeholder="For example: the color is wrong, or the price is missing"></textarea></label>
          <label>Your name (optional)<input class="r-name" maxlength="100"></label>
          <div class="hint">Goes to Consumers IT as a case, with this page's address, what this panel read, the QuickAdd version and your browser. No customer details are sent.</div>
          <div class="r-actions"><button class="btn r-cancel" type="button">Cancel</button><button class="btn primary r-send" type="button">Send report</button></div>
          <div class="msg r-msg" hidden></div>
        </div>
      <!-- <div class="actions"><button class="btn cancel" type="button">Close</button><button class="btn primary add" type="button">Add to quote</button></div> -->
      <div class="actions"><button class="btn link report" type="button">Report issue</button><button class="btn cancel" type="button">Close</button><button class="btn primary add" type="button">Add to quote</button></div>
      <div class="busy" role="status" hidden><div class="spin"></div><span>Updating...</span></div>
    </div>`;
  const $ = sel => root.querySelector(sel);
  const fab = $(".fab"), panel = $(".panel"), dot = $(".dot"), msg = $(".msg");
  const f = { img: $(".prod img"), name: $(".prod .name"), variantWrap: $(".variant-wrap"), variant: $(".variant"),
    model: $(".model"), color: $(".color"), price: $(".price"), qty: $(".qty"), add: $(".add"),
    manualHint: $(".manual-hint"), goneHint: $(".gone-hint"), orderFormHint: $(".order-form-hint"), // 1.5.3
    lineWrap: $(".line-wrap"), line: $(".line"), typeWrap: $(".type-wrap"), type: $(".type"),
    description: $(".description"), // was also collection: $(".collection") (until 1.4.1)
    single: $(".single"), parts: $(".parts"), kitHint: $(".kit-hint"), kitTotalHint: $(".kit-total-hint"), // 1.5.5
    priceWrap: $(".price-wrap"), qtyLabel: $(".qty-label") };
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
  let parts = null; // 1.5.5: the page's item is a kit (Fleurco door + base + drain + Mix & Match Kit): one line per part
  let siteNote = ""; // 1.5.6: a note from the site's rule (a part sold separately that is not on this page)
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
    // if (drain) want.push(drain.toLowerCase().replace(/\s+/g, "_"));
    // 1.5.6 (sweep 2, 11/6): the tile "Reversible (L/R)" is REVERSIBLE_LEFT_OR_RIGHT in the variant names (Meridian 50,
    // Origami 6636 showed the configurator's code and total instead of the tub's own).
    if (drain) want.push(/^reversible\b/i.test(drain) ? "reversible_left_or_right" : drain.toLowerCase().replace(/\s+/g, "_"));
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
    // const sub = clean((document.querySelector("h1 + *") || {}).textContent);
    // 1.5.6 (sweep 2): without the words the heading already ends with ("AMMA OVAL 7242 Freestanding" + "Freestanding 72"").
    let sub = clean((document.querySelector("h1 + *") || {}).textContent);
    const headWords = clean(textOf("h1")).toLowerCase().split(/\s+/);
    while (sub && headWords.includes(sub.split(/\s+/)[0].toLowerCase())) sub = sub.split(/\s+/).slice(1).join(" ");
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
  // 1.5.6 (sweep 2): pages with a Frame dropdown print each price twice, "... FRAMELESS POL $1515" and "... NARROW
  // FRAMED POL $2514" (Georgia, Pharos, Valentina, Olympia); Olympia's triple door prints "NARROW FRAMED ... $0".
  const sofiaFrameOf = s => (/narrow\s+framed/i.test(s) ? "narrow" : /frameless/i.test(s) ? "frameless" : "");
  const sofiaPrices = () => (document.body ? document.body.innerText : "").split("\n").map(clean)
    .filter(l => /\$\s?\d/.test(l) && /DEPTH|POL|BEV/i.test(l) && !/\S\s{2,}\$/.test(l))
    .map(l => ({ depth: (/\((-\d)\)/.exec(l) || [])[1] || "", edge: sofiaEdgeOf(l), depthText: (/^(\d[\d\s\/]*DEPTH)/i.exec(l) || [])[1] || "",
      frame: sofiaFrameOf(l), price: ((/\$\s?([\d,]+(?:\.\d{2})?)/.exec(l) || [])[1] || "").replace(/,/g, "") }))
    .filter(p => Number(p.price) > 0);
  // Sofia's accessories (sweep 2: "LGT-30 $375", "MSK 4-30/MSK 6-30 $111 (-1) | $138 (-2)", "SU4-SIZE / SU6-SIZE"): each
  // ticked one is its own item, the code and price by the picked depth, SIZE the cabinet's width (ART 1530 -> 15).
  const SOFIA_TYPES = [[/^LGT/i, "LIGHT"], [/^(MSK|SR\s*KIT)/i, "SURFACE MOUNT SIDE KIT"]];
  const SOFIA_FINISH = { BN: "Brushed Nickel", CH: "Chrome", PN: "Polished Nickel", MB: "Matte Black" };
  function sofiaParts(main) {
    const depth = sofiaDepthCode();
    const di = depth === "-2" ? 1 : 0;
    const width = (/\b(\d{2})\d{2}\b/.exec(sofiaPick("model_number")) || [])[1] || "";
    const extras = [];
    for (const i of document.querySelectorAll('div.checkbox-container > input[type="checkbox"]:checked')) {
      const box = i.parentElement;
      const lab = clean((box.querySelector("label") || {}).textContent);
      const codes = lab.split("$")[0].split("/").map(clean).filter(Boolean);
      // "SU4-SIZE OF CABINET / SU6-SIZE OF CABINET": the code alone (SU6-30).
      const code = (codes[Math.min(di, codes.length - 1)] || clean(i.value).replace(/^,\s*/, "")).replace(/SIZE/i, width || "SIZE").replace(/\s+OF\s+.*$/i, "");
      const prices = [...lab.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)\s*(?:\((-\d)\))?/g)];
      const hit = prices.find(m => m[2] && m[2] === depth) || prices[Math.min(di, prices.length - 1)] || prices[0];
      const fin = SOFIA_FINISH[(/-([A-Z]{2})$/.exec(code) || [])[1]];
      extras.push({ label: "Accessory", model: code, price: hit ? amountNum(hit[1]) || null : null,
        name: clean(clean((box.querySelector("p small, small") || {}).textContent).replace(/\s*as an optional accessory.*$/i, "").replace(/[()]/g, ""))
          .toLowerCase().replace(/^\w/, c => c.toUpperCase()),
        color: fin || "N/A", collection: "", imageUrl: "", typeName: (SOFIA_TYPES.find(([re]) => re.test(code)) || [])[1] || "MISCELLANEOUS" });
    }
    // The Elios glass shelf (select[name=shelf] "SU4-24", printed "SU4-24: $103").
    const shelf = sofiaPick("shelf");
    if (shelf) {
      const line = (document.body ? document.body.innerText : "").split("\n").map(clean).find(l => l.toUpperCase().startsWith(`${shelf.toUpperCase()}:`));
      extras.push({ label: "Glass shelf", model: shelf, price: amountNum(amountOf(line || "")) || null, name: "Extra glass shelf",
        color: "N/A", collection: "", imageUrl: "", typeName: "" });
    }
    if (!extras.length) return null;
    return [{ label: /mirror/i.test(main.name || "") ? "Mirror" : "Cabinet", model: main.model || "", price: main.price, color: main.color || "",
      name: String(main.name || "").replace(/,?\s*with\s+[^,]*(?:,\s*[^,]*)*$/i, ""), collection: main.collection || "", typeName: "", imageUrl: main.imageUrl || "" }, ...extras];
  }
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

  // 1.5.5: Flusso's own product lines, shown or in the section only wide windows show.
  const flussoText = sel => textOf(sel) || clean((document.querySelector(sel) || {}).textContent);
  const anyText = flussoText; // 1.5.7: the same for any site (Kohler's list price line)

  // 1.5.6 (sweep 2, 11/6) helpers for parts sold separately.
  // A JSON object a page script assigns ("var product_extras = {...};"): the content script cannot read the page's
  // variables, but it can read the script's text.
  const scriptJson = (name, root = document) => {
    const re = new RegExp(`\\b${name}\\s*=\\s*\\{`);
    for (const s of root.querySelectorAll("script:not([src])")) {
      const t = s.textContent || "";
      const at = t.search(re);
      if (at < 0) continue;
      const start = t.indexOf("{", at);
      let depth = 0, inStr = false, esc = false;
      for (let i = start; i < t.length; i++) {
        const ch = t[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === "\\") esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}" && --depth === 0) {
          try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; }
        }
      }
    }
    return null;
  };
  // Another page of the same site, read once (a trim's rough valve page, or this page's own HTML after the site changed
  // the item in place).
  const pageDocs = new Map();
  const fetchDoc = url => {
    if (!pageDocs.has(url)) {
      if (pageDocs.size > 20) pageDocs.clear();
      pageDocs.set(url, fetch(url, { credentials: "include" }).then(r => (r.ok ? r.text() : "")).then(h => (h ? new DOMParser().parseFromString(h, "text/html") : null)).catch(() => null));
    }
    return pageDocs.get(url);
  };
  const docText = (doc, sel) => clean((doc && doc.querySelector(sel) || {}).textContent);

  // TOTO (sweep 2): the add-ons checked under a toilet (14″ rough-in, trip lever, push button: "[+$122.00]") are their
  // own SKUs (TSU10W.14R, THU485#PN, THU842#PN-A) in the page's "var product_extras", keyed by the radio's name and value;
  // "MSRP LIST PRICE" is the toilet's price plus theirs. A WASHLET+ page keeps the first product's product_extras after its
  // Washlet Options tiles switch the product, so a missing one is read from the page's own HTML.
  const totoName = (skip = new Set()) => {
    const opts = [...document.querySelectorAll("legend")]
      .filter(l => l.getClientRects().length && !skip.has(l.closest("fieldset"))).map(l => clean(l.textContent))
      .filter(s => /:\s*\S/.test(s) && !/^colou?r\s*:/i.test(s) && !/coupon|quantity|contact|feedback/i.test(s))
      .map(s => s.replace(/\s*Options?\s*:/i, ":").replace(/\s*Color\/Finish\s*:/i, ":"))
      .map(s => { const [k, ...v] = s.split(":"); const val = clean(v.join(":")); return val.toLowerCase().includes(clean(k).toLowerCase()) ? val : `${clean(k)} ${val}`; });
    return [textOf("h1"), ...new Set(opts)].filter(Boolean).join(", ");
  };
  async function totoParts(main) {
    const picked = [];
    for (const r of document.querySelectorAll('fieldset.extras input[type="radio"]:checked')) {
      const box = r.closest("fieldset");
      if (box && !box.getClientRects().length) continue; // another product's hidden block
      const lab = r.closest("label") || (r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`));
      const m = lab && /\[\+\s*\$([\d,.]+)\]/.exec(lab.textContent);
      if (!m || !amountNum(m[1])) continue; // part of the toilet's own SKU
      picked.push({ r, box, price: amountNum(m[1]), text: clean(lab.textContent.replace(m[0], "")) });
    }
    if (!picked.length) return null;
    const has = x => x && picked.every(p => x[p.r.name] && x[p.r.name][p.r.value]);
    let extras = scriptJson("product_extras");
    if (!has(extras)) {
      const d = await fetchDoc(location.href);
      const again = d && scriptJson("product_extras", d);
      if (has(again)) extras = again;
    }
    const out = [{ label: /toilet/i.test(main.name || "") ? "Toilet" : "Item", model: main.model || "", price: main.price,
      name: totoName(new Set(picked.map(p => p.box))), color: main.color || "", collection: main.collection || "", typeName: "", imageUrl: main.imageUrl || "" }];
    for (const p of picked) {
      const e = has(extras) ? extras[p.r.name][p.r.value] : null;
      const kind = clean(p.r.name.replace(/\s*Colou?r\s*\/\s*Finish/i, "").replace(/\s*Options?$/i, "")); // Rough-In, Trip Lever
      const finish = /colou?r|finish/i.test(p.r.name);
      const value = clean(e ? e.name : p.text);
      out.push({ label: kind, model: e ? clean(e.sku) : "", price: (e && amountNum(e.price)) || p.price, typeName: "",
        name: finish ? kind : `${kind} ${value}`, color: finish ? value : "N/A", collection: "", imageUrl: "" });
    }
    const total = amountNum(amountOf(textOf(".sku-row .price .amount") || textOf(".sku-row .price")));
    return out.map(p => ({ ...p, pageTotal: total }));
  }
  // A required rough-in TOTO names but does not link ("Requires tub filler base rough-in TBN01105U").
  const totoNote = () => {
    const m = /requires?\s+(?:the\s+)?([a-z][a-z\s-]{0,40}?rough-?in)\s+([A-Z]{2,}[A-Z0-9#.-]*\d[A-Z0-9#.-]*)/i.exec(clean(document.body ? document.body.innerText : ""));
    return m ? `This also needs the ${m[1].toLowerCase()} ${m[2]}, sold separately: add it from its own page.` : "";
  };

  // Flusso (sweep 2): a trim sold without its valve ("Trim For 3/4" Thermostatic Valve, Use With TVH.4201", "Valve Not
  // Included - Trim Only") goes on with the valve as a part sold separately, read from the valve's own page when this
  // page links it (TVH.4201 $393). Otherwise the panel says which valve it needs.
  const flussoValve = () => {
    const h1 = flussoText("h1");
    if (/valve with trim/i.test(h1)) return null;
    const body = clean(document.body ? document.body.innerText : "").slice(0, 20000);
    if (!/\btrim\b/i.test(h1) && !/trim only|valve not included/i.test(body)) return null;
    const code = (/\b(?:use with|paired with(?: the)?)\s+([A-Z]{2,}[A-Z0-9.]*\d[A-Z0-9.]*)/i.exec(h1) ||
      /\b(?:use with|paired with(?: the)?)\s+([A-Z]{2,}[A-Z0-9.]*\d[A-Z0-9.]*)\s+valve/i.exec(body) || [])[1];
    if (!code) return null;
    const key = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const link = [...document.querySelectorAll('a[href*="/products/"]')].find(a => {
      const seg = (/\/products\/([^/?#]+)/i.exec(a.href) || [])[1] || "";
      return seg.replace(/[^A-Z0-9-]/gi, "").toUpperCase().split("-")[0] === key;
    });
    return { code, link: link ? link.href : "" };
  };
  async function flussoParts(main) {
    const v = flussoValve();
    if (!v || !v.link) return null;
    const d = await fetchDoc(v.link);
    const price = amountNum(docText(d, "#product-price-span"));
    if (!d || !price) return null;
    const finish = docText(d, "#product-finish-detail-span").replace(/\s*\((?:fast ship|special)[^)]*\)\s*$/i, "");
    return [{ label: "Trim", model: main.model || "", price: main.price, name: main.name || "", color: main.color || "", collection: main.collection || "", typeName: "", imageUrl: main.imageUrl || "" },
      { label: "Rough valve", model: docText(d, ".product-model-no-p") || v.code, price, name: docText(d, "h1"), color: finish || "N/A",
        collection: "", typeName: "ROUGH", imageUrl: "", optional: true, outsideTotal: true,
        note: `Sold separately: this trim needs the ${v.code} valve. Untick it if the customer already has one.` }];
  }
  // Brizo (sweep 2): "Product(s) Shown" lists each part of what the page shows, with its own price, adding up to "List
  // price as shown": a combo (faucet + handle kit + rough, 65368LF-PCLHP-ECO--HL5368-PCCL), or a trim with the rough valve
  // picked in its tiles (T66T030-PC $952 + R35000-WS $499). The row's class says what it is.
  const brizoRows = () => [...document.querySelectorAll(".prd-as-shown .row")].filter(r => !r.classList.contains("listPrice")).map(r => {
    const model = clean((r.querySelector(".col-sm span") || {}).textContent);
    // Without a leading "Brizo Baliza:" (T60405-PC's row repeats the brand and collection).
    const name = clean(clean((r.querySelector(".col-sm") || {}).textContent).replace(model, "")).replace(/^Brizo\s+/i, "").replace(/^[A-Z][\w®™]*(?:\s[\w®™]+)?:\s+/, "");
    return { cls: r.className, model, name, price: amountNum(amountOf((r.querySelector(".prd-as-shown-price") || {}).textContent)) };
  }).filter(r => r.model);
  const BRIZO_ROLES = [
    [/Rough_Valve_PAS|Body_Assembly_PAS|Riser_Union_PAS/, "Rough", "SHOWER SYSTEM - VALVE ROUGH"],
    [/Handle_or_Accent_PAS/, "Handles", "=main"], // the faucet's or trim's own Type
    [/Featured_Accessories_PAS/, "Accessory", "=accessory"],
  ];
  function brizoParts(main) {
    const rows = brizoRows();
    if (rows.length < 2) return null;
    const color = X.text(SITE_RULES["brizo.com"].color()).replace(/[®™]/g, "");
    const total = amountNum(amountOf(textOf(".prd-as-shown .row.listPrice .prd-as-shown-price")));
    // An item shown with a rough valve is the valve's trim (T60405-PC "TempAssure Thermostatic Tub/Shower" names no Type).
    const withRough = rows.some(r => /Rough_Valve_PAS/.test(r.cls));
    const named = /\b(trim|faucet|filler|head|shower\s*arm|handshower|hand shower|spray)\b/i.test(rows[0].name);
    return rows.map((r, i) => {
      const role = i === 0 ? null : BRIZO_ROLES.find(([re]) => re.test(r.cls));
      const rough = !!role && role[1] === "Rough";
      return { label: i === 0 ? (/\btrim\b/i.test(r.name) || (withRough && !named) ? "Trim" : /faucet/i.test(r.name) ? "Faucet" : "Item") : role ? role[1] : "Part",
        model: r.model, price: r.price || null, name: r.name, color: rough ? "N/A" : color, collection: i === 0 ? main.collection || "" : "",
        typeName: role ? role[2] : i === 0 && withRough && !named ? "SHOWER SYSTEM - VALVE TRIM" : "", imageUrl: i === 0 ? main.imageUrl || "" : "", pageTotal: total };
    });
  }

  // Kohler bundles (sweep 2): each item's SKU is in its link (?skuId=27009-BL) or, in the newer layout, its picture's alt
  // text (26290-CP); its finish under "Color/Finish:"; its price in the non-mobile price group.
  function kohlerParts(main) {
    const boxes = [...document.querySelectorAll("[class*=BundleChildItems_ChildItems], .child-items")];
    if (boxes.length < 2) return null;
    // const total = amountNum(amountOf(textOf(".product-detail-page__price-value")) || amountOf(textOf(".subtotal span")));
    // 1.5.7 (Gib 11/6: list price, not sale price): the items show only their sale price and their own pages fill
    // prices in by script, so each is scaled by the bundle's own list-to-sale ratio ($1,257.75 / $943.31); the items
    // then add up to the bundle's list price.
    const current = amountNum(amountOf(textOf(".product-detail-page__price-value")) || amountOf(textOf(".subtotal span")));
    const list = amountNum(amountOf(anyText(".product-detail-page__list-value")));
    const ratio = list && current && list > current ? list / current : 1;
    const total = list || current;
    const parts = boxes.map(b => {
      const a = b.querySelector("a.list-title") || b.querySelector("a[href*='skuId']");
      let model = "";
      try { model = a ? new URL(a.href).searchParams.get("skuId") || "" : ""; } catch {}
      if (!model) model = clean((b.querySelector("img") || {}).alt);
      const name = clean((b.querySelector("a.list-title, .title, h3, h4") || {}).textContent).replace(/[®™]/g, "");
      const price = [...b.querySelectorAll(".price")].find(p => !p.closest(".mobile"));
      const sale = amountNum(amountOf(price && price.textContent));
      return { label: "Item", model, name, color: clean((b.querySelector(".attributes-details, .details") || {}).textContent),
        price: sale ? Math.round(sale * ratio * 100) / 100 : null, collection: "", typeName: "", pageTotal: total,
        imageUrl: (() => { const i = b.querySelector("img"); try { return i && i.src && new URL(i.src).protocol === "https:" ? i.src : ""; } catch { return ""; } })() };
    }).filter(p => p.model);
    return parts.length > 1 ? parts.map((p, i) => ({ ...p, label: `Item ${i + 1}` })) : null;
  }

  // Delta bundles (sweep 2): "This bundle includes" tiles (data-pid "Master-76224") link each item in every finish
  // (76224.html Chrome, 76224-BL.html, 3562LF-BLMPU.html); the tiles show only price ranges, so each item's price is read
  // from its own page in the bundle's finish (Chrome: 6 items $600.60, Matte Black $818.75, the bundle's prices).
  // A finish change rebuilds the tiles as a carousel (clones) and their finish buttons load late, so each item's own
  // page says which of its SKUs is the bundle's finish: its swatch titled "Finish: Matte Black" carries
  // data-wtb-url="/where-to-buy?pid=76236-BL".
  async function deltaParts(main) {
    const tiles = [...document.querySelectorAll(".this-bundle-includes .product-tile")];
    if (tiles.length < 2) return null;
    const firstLink = new Map(); // data-pid -> the item's own page (the tile's name link)
    for (const tl of tiles) {
      const pid = tl.getAttribute("data-pid") || "";
      const a = [...tl.querySelectorAll("a[href]")].find(x => /\/product\/[^/]+\.html/i.test(x.href) && !/\/master-/i.test(x.href));
      if (pid && a && !firstLink.has(pid)) firstLink.set(pid, a.href);
    }
    if (firstLink.size < 2) return null;
    const finish = String(main.color || "").toLowerCase();
    const urls = await Promise.all([...firstLink.values()].map(async href => {
      const d = await fetchDoc(href);
      const sw = d && [...d.querySelectorAll("button.product-attribute__swatch")]
        .find(b => String(b.getAttribute("aria-label") || b.title || "").replace(/^\s*finish:\s*/i, "").replace(/,\s*selected\s*$/i, "").trim().toLowerCase() === finish);
      const pid = sw && (/[?&]pid=([^&]+)/.exec(sw.getAttribute("data-wtb-url") || "") || [])[1];
      if (!sw || !pid) return d && finish && !sw ? "" : href; // a finish the item does not come in: no split
      return href.replace(/\/[^/]+\.html/i, `/${decodeURIComponent(pid)}.html`);
    }));
    if (urls.some(u => !u)) return null;
    const docs = await Promise.all(urls.map(fetchDoc));
    const file = href => ((/\/product\/([^/?#]+)\.html/i.exec(href || "") || [])[1] || "");
    const total = amountNum(SITE_RULES["deltafaucet.com"].price());
    const parts = docs.map((d, i) => {
      // const priceEl = d && d.querySelector('[itemprop="price"]');
      // 1.5.7: an Outlet item's struck-through list price over its sale price, as the Delta rule does.
      const priceEl = (d && d.querySelector(".pdp-prod-price-block .old-price")) || (d && d.querySelector('[itemprop="price"]'));
      return { label: `Item ${i + 1}`, model: docText(d, ".model-name").replace(/^\s*model\s*#?\s*:?\s*/i, "") || file(urls[i]),
        name: docText(d, "h1").replace(/[®™]/g, ""), color: main.color || "", collection: docText(d, ".collection-name"),
        price: amountNum(priceEl && (priceEl.getAttribute("content") || priceEl.textContent)) || null, imageUrl: "", pageTotal: total,
        typeName: /\btrim\b/i.test(docText(d, "h1")) && /\b(tub|shower)\b/i.test(docText(d, "h1")) ? "TUB / SHOWER FAUCET" : "" }; // Monitor trim
    });
    return parts.every(p => p.model) ? parts : null;
  }

  // Grohe (sweep 2): "REQUIRED" opens #modal_required_products_<variant>, listing what the item needs and is sold
  // separately: "Universal Rough-In Box No Finish Model: 35601000 $194.00" (some finishes also need Service Stops
  // 1405300M $65). One to three such items go on as parts sold separately; a choice of more (Essence: 7 roughs) is a note.
  const groheRequired = () => {
    const btn = [...document.querySelectorAll('[data-modal-target^="modal_required_products_"]')].find(b => b.getClientRects().length);
    const id = (btn && btn.getAttribute("data-modal-target")) || `modal_required_products_${new URLSearchParams(location.search).get("variant") || ""}`;
    const modal = document.getElementById(id);
    if (!modal) return [];
    const out = [];
    for (const a of modal.querySelectorAll('a[href*="/products/"]')) {
      let block = a;
      for (let k = 0; k < 5 && block && !/Model:\s*\S+[\s\S]*\$\s?\d/.test(block.textContent || ""); k++) block = block.parentElement;
      if (!block) continue;
      const text = clean(block.textContent);
      const model = (/Model:\s*(\S+)/.exec(text) || [])[1] || "";
      if (!model || out.some(x => x.model === model) || (/Model:/g.test(text) && (text.match(/Model:/g) || []).length > 1)) continue;
      const linkText = clean([...block.querySelectorAll('a[href*="/products/"]')].map(x => x.textContent).find(t => clean(t)) || "");
      const name = linkText.replace(/\s*Model:.*$/i, "").replace(/\s+(?:No Finish|GROHE\s.*)$/i, "");
      const finish = clean(text.slice(name ? text.indexOf(name) + name.length : 0, text.indexOf("Model:")));
      out.push({ model, name, finish, price: amountNum(amountOf(text.slice(text.indexOf("Model:")))) });
    }
    return out;
  };
  function groheParts(main) {
    const req = groheRequired();
    if (!req.length || req.length > 3) return null;
    return [{ label: "Trim", model: main.model || "", price: main.price, name: main.name || "", color: main.color || "", collection: main.collection || "", typeName: "", imageUrl: main.imageUrl || "" },
      ...req.map(r => ({ label: /rough/i.test(r.name) ? "Rough-in" : r.name || "Required item", model: r.model, price: r.price || null, name: r.name,
        color: /^no finish$/i.test(r.finish) || !r.finish ? "N/A" : r.finish.replace(/^GROHE\s+/i, ""), collection: "", imageUrl: "",
        typeName: /rough/i.test(r.name) ? "ROUGH" : "", optional: true, outsideTotal: true,
        note: "Required to install this and sold separately. Untick it if the customer already has one." }))];
  }
  const groheNote = () => {
    const req = groheRequired();
    return req.length > 3 ? `This needs one of ${req.length} items sold separately (REQUIRED on the page, e.g. ${req[0].model}): add the one needed from its own page.` : "";
  };

  // John Boos (sweep 2): the page's own cart form (input[name=cartFormInput], JSON) lists what "Add to cart" would add:
  // the item's variant (sku, price, selectedOptions "Color", title "Frame Only") and the add-on box's product.
  const boosCart = () => {
    for (const i of document.querySelectorAll("input[name=cartFormInput]")) {
      try {
        const lines = ((JSON.parse(i.value).inputs || {}).lines || []).filter(l => l && l.selectedVariant);
        if (lines.length) return lines;
      } catch {}
    }
    return [];
  };
  const boosOpt = (line, re) => ((line && line.selectedVariant && line.selectedVariant.selectedOptions) || []).find(o => re.test(o.name || "")) || null;
  const boosFrameOnly = () => /frame only/i.test(((boosCart()[0] || {}).selectedVariant || {}).title || "");
  const boosListPrice = v => { const p = amountNum((v.price || {}).amount), c = amountNum((v.compareAtPrice || {}).amount); return c > p ? c : p; }; // 1.5.7
  const htmlText = s => { const d = document.createElement("textarea"); d.innerHTML = String(s || ""); return clean(d.value); };
  function boosParts(main) {
    const lines = boosCart();
    if (lines.length < 2) return null;
    const total = amountNum(amountOf(clean(([...document.querySelectorAll("button")].find(b => /add to cart/i.test(b.textContent || "")) || {}).textContent)));
    return [{ label: "Item", model: main.model || "", price: main.price, name: main.name || "", color: main.color || "", collection: main.collection || "", typeName: "", imageUrl: main.imageUrl || "", pageTotal: total },
      ...lines.slice(1).map(l => ({ label: "Add-on", model: clean(l.selectedVariant.sku), price: boosListPrice(l.selectedVariant) || null, // 1.5.7: list price
        name: [htmlText((l.selectedVariant.product || {}).title), htmlText(l.selectedVariant.title)].filter(s => s && !/^default title$/i.test(s)).join(", "),
        color: "N/A", collection: "", typeName: "MISCELLANEOUS", imageUrl: "", pageTotal: total }))];
  }

  // Bain Ultra (sweep 2): the configurator's total is the tub, its drain & overflow kit and the option cards added
  // ("bu-configurator__option-card--selected", data-option-sku BDRCB). Each has its own SKU and price in the page's
  // configurator data (/apps/configurator/bootstrap: optionAxes[].variations[] optionSku, price, variationAttributes).
  // The drain kit is what is left of the total, matched to the drain SKU at that price that fits the picked finish.
  const bainBoot = new Map();
  const bainBootstrap = () => {
    const h = (/\/products\/([^/?#]+)/.exec(location.pathname) || [])[1];
    if (!h) return Promise.resolve(null);
    if (!bainBoot.has(h)) bainBoot.set(h, fetch(`/apps/configurator/bootstrap?productHandle=${encodeURIComponent(h)}`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : null)).catch(() => null));
    return bainBoot.get(h);
  };
  const titleCase = s => String(s || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  async function bainParts(main) {
    const v = bainVariant();
    if (!v || !v.sku) return null;
    const total = amountNum(amountOf(textOf(".bu-configurator__summary-cta-price")));
    const boot = await bainBootstrap();
    const p = boot && boot.product;
    if (!p || !total) return null;
    const all = new Map();
    for (const a of p.optionAxes || []) for (const x of a.variations || []) all.set(String(x.optionSku).toUpperCase(), { ...x, feature: a.feature });
    const cards = [...document.querySelectorAll("article.bu-configurator__option-card--selected[data-option-sku]")].map(c => {
      const sku = c.getAttribute("data-option-sku");
      const x = all.get(String(sku).toUpperCase());
      return { sku, title: clean((c.querySelector(".bu-configurator__option-card-title") || {}).textContent) || titleCase(x && x.name),
        price: (x && amountNum(x.price)) || amountNum(amountOf((c.querySelector(".bu-configurator__option-button-price") || {}).textContent)) };
    }).filter(c => c.price > 0); // a $0 option comes with the tub (the oval's grab bar BGBG10-02)
    const tubPrice = amountNum(v.price);
    const drainPrice = Math.round((total - tubPrice - cards.reduce((s, c) => s + c.price, 0)) * 100) / 100;
    let drain = null;
    if (drainPrice > 0) {
      const row = (p.configurationMatrix || []).find(m => String(m.variationSku).toUpperCase() === v.sku.toUpperCase());
      const avail = new Set(((row && row.availableOptionSkus) || []).map(s => String(s).toUpperCase()));
      const c = bainChoices();
      const pick = re => (c[Object.keys(c).find(k => re.test(k))] || "").toLowerCase();
      const fin = pick(/drain finish|drain colou?r/), mat = pick(/drain material/);
      const cands = [...all.values()].filter(x => /DRAIN/.test(x.feature) && (!avail.size || avail.has(String(x.optionSku).toUpperCase())) &&
        Math.abs(amountNum(x.price) - drainPrice) < 0.01);
      const fits = cands.filter(x => {
        const at = x.variationAttributes || {};
        const look = [at.finish, at.color].filter(Boolean).join(" ").toLowerCase().replace(/_/g, " ");
        return (!fin || !look || fin.split(/\s+/).some(w => look.includes(w))) && (!mat || !at.material || mat.includes(String(at.material).toLowerCase()));
      });
      drain = (fits.length ? fits : cands)[0] || { optionSku: "", name: "Drain and overflow kit", variationAttributes: {} };
    }
    if (!drain && !cards.length) return null;
    const at = (drain && drain.variationAttributes) || {};
    return [{ label: "Tub", model: v.sku, price: tubPrice, name: String(main.name || "").replace(/,\s*drain kit .*$/i, ""), color: main.color || "",
      collection: main.collection || "", typeName: "", imageUrl: main.imageUrl || "", pageTotal: total },
      ...(drain ? [{ label: "Drain & overflow kit", model: drain.optionSku || "", price: drainPrice, name: titleCase(drain.name),
        color: titleCase(at.finish || at.color) || "N/A", collection: "", typeName: "MISCELLANEOUS", imageUrl: "", pageTotal: total }] : []),
      ...cards.map(cd => ({ label: "Option", model: cd.sku, price: cd.price || null, name: cd.title, color: "N/A", collection: "", imageUrl: "", pageTotal: total,
        typeName: /skirt/i.test(cd.title) || /^BS(MUL|J1)/i.test(cd.sku) ? "SKIRT" : "MISCELLANEOUS" }))];
  }

  // Craft & Main (sweep 2): the page script's "var meta" lists the real variants ("48 × 74-Inch / Brushed Nickel / Clear",
  // sku MRHG4874-CL-BN). undefined: no list or nothing chosen; null: the chosen combination is not made.
  let cmVariants = null;
  const cmVariant = () => {
    if (!cmVariants) {
      const meta = scriptJson("meta");
      cmVariants = (meta && meta.product && Array.isArray(meta.product.variants)) ? meta.product.variants : [];
    }
    if (!cmVariants.length) return undefined;
    const chosen = [...document.querySelectorAll("legend")].filter(l => l.getClientRects().length)
      .map(l => (/^[^:]+:\s*(.+)$/.exec(clean(l.textContent)) || [])[1]).filter(Boolean).map(s => clean(s).toLowerCase());
    if (!chosen.length) return undefined;
    return cmVariants.find(v => { const opts = String(v.public_title || "").toLowerCase().split(" / ").map(clean); return chosen.every(c => opts.includes(c)); }) || null;
  };

  const flussoNote = () => {
    const v = flussoValve();
    return v && !v.link ? `This trim needs the ${v.code} valve, sold separately: add it from its own page.` : "";
  };

  // 1.5.5 (Gib 11/6: "some selections are actually multiple parts in a kit ... break down and price the kit into its
  // individual parts"): a Fleurco build can be several items, "NHZ160-25-40-75 + ATAS2-3260 + DRAINABS-33 +
  // NH-CONVKIT-11-MX Total : $3517": the door, a base and its drain picked with "Add a base", and a Mix & Match Kit.
  // NetSuite needs each as its own line at its own price. The page keeps the door's price in #hidPrice (a spacer's in
  // #hidSpacerPrice), the kit's in #hidHardwareKitPrice and on its tile ("114 $"), and shows each added item as a card:
  // "ATAS2-3648 <i>$1315</i> ... Tavia 2.0 Low Profile Base - Solid surface base, with center drain & square drain cover,
  // Slate, 36 x 48". The parts add up to the total. Fewer than two codes: not a kit.
  const hidVal = id => clean((document.getElementById(id) || {}).value);
  const amountNum = s => { const n = Number(String(s || "").replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 ? n : 0; };
  const fleurcoCodes = () => clean(textOf(".product-total")).split(/\s*Total\s*:/i)[0].split("+").map(clean).filter(Boolean);
  const bgImage = el => {
    const m = el && /url\((['"]?)(.*?)\1\)/.exec(el.style.backgroundImage || "");
    try { return m ? new URL(m[2], location.href).href : ""; } catch { return ""; }
  };
  // A card's color: what follows the item's own name ("..., Slate, 36 x 48" after the base's name), else a finish at the
  // end ("ABS No-Calk 2" Drain, Matte Black"). Parts with digits are sizes, not colors.
  const cardColor = (desc, main) => {
    const rest = main && desc.startsWith(main) && desc.length > main.length ? desc.slice(main.length) : "";
    if (rest) return rest.split(",").map(clean).find(s => s && !/\d/.test(s)) || "";
    const segs = desc.split(",").map(clean).filter(Boolean);
    const last = segs.length > 1 ? segs[segs.length - 1] : "";
    return last && !/\d/.test(last) && (X.guessFinish(last) || last.split(/\s+/).length <= 3) ? last : "";
  };
  const withoutColor = (desc, color) => (color ? desc.split(",").map(clean).filter(s => s && s !== color).join(", ") : desc);
  const CARD_ROLES = [ // card id or box -> what it is and its Type
    [/^(base|secondbase)$/i, "Base", "SHOWER BASE"], [/^bathtub$/i, "Bathtub", "BATH TUB"], [/^fibowall$/i, "Wall panels", "SHOWER WALL"],
    [/^accessory$/i, "Drain", ""], [/^baseaccessory$/i, "Base accessory", ""], [/^installkit/i, "Installation kit", ""],
    [/^accent/i, "Accent", ""], [/^grip/i, "Grip", ""],
  ];
  // 1.5.6: what the page's own item is, by its address (sweep 2: bathtubs, bases and Fibo walls were "Shower door").
  const fleurcoKind = () => {
    const p = location.pathname.toLowerCase();
    if (/\/bathtubs?\//.test(p)) return { label: "Bathtub", type: "BATH TUB", category: "Bath Tub" };
    if (/\/bases\/fibo/.test(p)) return { label: "Wall panels", type: "SHOWER WALL", category: "Shower Wall" };
    if (/\/bases?\//.test(p)) return { label: "Base", type: "SHOWER BASE", category: "Shower Base" };
    return { label: /tub/i.test(clean(textOf(".product-page .subtitle"))) ? "Tub door" : "Shower door", type: "", category: "" };
  };
  function fleurcoParts() {
    const codes = fleurcoCodes();
    if (codes.length < 2) return null;
    const rule = SITE_RULES["fleurco.com"];
    const title = fleurcoTitle();
    const meta = p => (document.querySelector(`meta[property="${p}"]`) || {}).content || "";
    const image = src => { if (!src) return ""; try { const u = new URL(src, location.href); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
    const parts = [];
    const spacerCode = clean(textOf("#product-sku-spacer")).replace(/^\+\s*/, "");
    const door = clean(textOf(".product-total .product-sku")) || codes[0];
    // parts.push({ label: "Shower door", model: door, typeName: "",
    // 1.5.6 (sweep 2): the page's own item is a door, a bathtub, a base or Fibo wall panels (by its address).
    const kind = fleurcoKind();
    parts.push({ label: kind.label, model: door, typeName: kind.type,
      price: amountNum(hidVal("hidPrice")) + (spacerCode ? 0 : amountNum(hidVal("hidSpacerPrice"))),
      name: X.text(rule.name()), color: X.text(rule.color()), collection: title,
      imageUrl: image(hidVal("hidImage") || meta("og:image")) });
    // if (spacerCode) parts.push({ label: "Spacer", model: spacerCode, price: amountNum(hidVal("hidSpacerPrice")), name: `${title} spacer`.trim(), color: "", collection: "", typeName: "MISCELLANEOUS", imageUrl: "" });
    // 1.5.6: the spacer comes in the door's hardware finish (ELE-SPACER-3/8-33).
    if (spacerCode) parts.push({ label: "Spacer", model: spacerCode, price: amountNum(hidVal("hidSpacerPrice")), name: `${title} spacer`.trim(), color: checkedLabel("rdoHardwareFinish"), collection: "", typeName: "MISCELLANEOUS", imageUrl: "" });
    // The Mix & Match (or hardware) kit, from its code beside the total and its tile ("NH-CONVKIT-11-MX (Chrome)").
    const kitCode = clean(textOf("#product-code-hardware-kit")).replace(/^\+\s*/, "");
    if (kitCode) {
      const tile = [...document.querySelectorAll('input[name="rdoHardwareKit"]')].find(r => r.value === kitCode);
      const lab = tile && tile.closest("label");
      const kitTitle = clean(lab && lab.querySelector("span") ? lab.querySelector("span").textContent : hidVal("hidHardwareKitTitleEn"));
      const mixMatch = [...document.querySelectorAll("label.mixMatchKit")].some(l => l.getClientRects().length);
      const kind = mixMatch ? "Mix & Match Kit" : "Hardware Kit";
      const priceTag = document.getElementById(`hardwareKitCost-${kitCode}`);
      parts.push({ label: kind, model: kitCode, typeName: "MISCELLANEOUS",
        price: amountNum(hidVal("hidHardwareKitPrice")) || amountNum(priceTag && priceTag.textContent),
        name: `${title} ${kind}`.trim(), color: clean((/\(([^)]+)\)\s*$/.exec(kitTitle) || [])[1]), collection: "",
        imageUrl: image((tile && tile.getAttribute("data-image")) || hidVal("hidHardwareKitImage")) });
    }
    // The cards of what "Add a base" (or "Add a Fibowall") added: code, price and description.
    const seen = new Set(parts.map(p => p.model.toUpperCase()));
    for (const i of document.querySelectorAll(".divbasechosen i, .divbathtubchosen i, .divfibowallchosen i")) {
      if (!/^\$\s?\d/.test(clean(i.textContent))) continue;
      const head = i.parentElement, card = head && head.parentElement;
      if (!card) continue;
      const model = clean(head.textContent.replace(i.textContent, ""));
      if (!model || seen.has(model.toUpperCase())) continue;
      seen.add(model.toUpperCase());
      const descEl = [...card.children].reverse().find(c => c.tagName === "DIV" && c !== head);
      const desc = clean(descEl && descEl.textContent);
      const isBase = !card.id && [hidVal("hidBaseSku"), hidVal("hidBaseSkuAll")].some(s => s && s.toUpperCase() === model.toUpperCase());
      const id = card.id || (isBase ? "base" : card.closest(".divfibowallchosen") ? "fibowall" : "");
      const role = CARD_ROLES.find(([re]) => re.test(id));
      const main = isBase ? hidVal("hidBaseEn") : id === "accessory" ? hidVal("hidAccessoryEn") : "";
      // const color = cardColor(desc, main);
      // parts.push({ label: role ? role[1] : "Add-on", model, typeName: role ? role[2] : "", price: amountNum(i.textContent),
      //   name: withoutColor(desc, color), color, collection: "", imageUrl: bgImage(card.querySelector("label div")) });
      // 1.5.6 (sweep 2): a bathtub's drain side ("Left") is no color, and its "*NEW*" tag no description.
      let color = cardColor(desc, main);
      let name = withoutColor(desc, color).replace(/\*[^*]*\*\s*/g, "");
      if (/^(left|right)$/i.test(color)) { name = `${name}, ${color.toLowerCase()} drain`; color = ""; }
      parts.push({ label: role ? role[1] : "Add-on", model, typeName: role ? role[2] : "", price: amountNum(i.textContent),
        name, color, collection: "", imageUrl: bgImage(card.querySelector("label div")) });
    }
    // const unknown = codes.filter(c => !parts.some(p => p.model.toUpperCase() === c.toUpperCase()));
    // 1.5.6 (sweep 2): a code beside the total that a picked option names: a bathtub's drains and drain cover
    // (select#drpDrain0 option "CAST IRON Model - 593$" data-sku="DRAINRC-T-CI" data-priceusd="593"; rdoDrainCover).
    const total = amountNum(amountOf(textOf("#product-total-amount")) || amountOf(textOf(".product-total")));
    const picked = [...document.querySelectorAll("select")].map(s => s.selectedOptions[0]).filter(Boolean)
      .concat([...document.querySelectorAll("input:checked")]).filter(e => e.getAttribute("data-sku"));
    for (const code of codes.filter(c => !parts.some(p => p.model.toUpperCase() === c.toUpperCase()))) {
      const el = picked.find(e => String(e.getAttribute("data-sku")).toUpperCase() === code.toUpperCase());
      if (!el) continue;
      const group = el.tagName === "OPTION" ? el.parentElement : el;
      const box = group.closest(".product-option") || group.parentElement;
      const heading = clean(((box && box.querySelector("label:not(.imagelbl), b, strong, span")) || {}).textContent).replace(/\(optional\)|[®™:]/gi, "").trim();
      const own = clean(el.tagName === "OPTION" ? el.textContent : (el.closest("label") || {}).textContent).replace(/\s*-?\s*\d[\d,.]*\s*\$\s*$/, "").replace(/\s*Model\s*$/i, "");
      const radio = el.tagName !== "OPTION";
      parts.push({ label: /cover/i.test(heading + el.name) ? "Drain cover" : /drain/i.test(heading + code) ? "Drain" : "Add-on", model: code, typeName: "",
        price: amountNum(el.getAttribute("data-priceusd")) || null, name: radio ? `${heading || "Drain cover"}`.trim() : `${heading}, ${own}`.replace(/^,\s*/, ""),
        color: radio ? own : "N/A", collection: "", imageUrl: "" });
    }
    // Prices the page's script lists by code (price["FBA-L-INSTALLKIT-18-W"] = 732;): Fibo walls' install kit and grip.
    const priceList = {};
    for (const s of document.querySelectorAll("script:not([src])")) {
      for (const m of String(s.textContent || "").matchAll(/\bprice\[\s*["']([^"']+)["']\s*\]\s*=\s*([\d.]+)\s*;/g)) priceList[m[1].toUpperCase()] = Number(m[2]);
    }
    // A drain removed by a later door change stays in the code line (#hidAccessorySku is not cleared) but not in the
    // total or the cards: skip it.
    const stale = !hidVal("hidAccessoryKey") && !document.getElementById("accessory") ? hidVal("hidAccessorySku").toUpperCase() : "";
    // A code beside the total that no card or field explains still goes on the quote: priced from the page's price list,
    // else from the total when it is the only one, else left for the customer or the sales rep.
    const unknown = codes.filter(c => !parts.some(p => p.model.toUpperCase() === c.toUpperCase()) && c.toUpperCase() !== stale);
    const known = parts.reduce((s, p) => s + (p.outsideTotal ? 0 : p.price || 0), 0);
    const listed = unknown.filter(c => priceList[c.toUpperCase()] > 0);
    const rest = unknown.filter(c => !(priceList[c.toUpperCase()] > 0));
    const fiboKit = c => (/INSTALLKIT/i.test(c) ? "Installation kit" : /GRIP/i.test(c) ? "Grip" : /^DRAIN/i.test(c) ? "Drain" : "Item");
    for (const code of listed) {
      // parts.push({ label: fiboKit(code), model: code, typeName: "", name: `${title} ${fiboKit(code).toLowerCase()}`.trim(), color: "", collection: "", imageUrl: "", price: priceList[code.toUpperCase()] });
      // A base page's drain (DRAINABS-33) is named by its drain tiles; Fibo's install kit comes in the trim's color, and
      // Fleurco's own total leaves it out (walls $3702 + grip $75 = "$3777"), so it is checked apart from the total.
      const k = fiboKit(code);
      const drain = k === "Drain";
      parts.push({ label: k, model: code, typeName: "MISCELLANEOUS", collection: "", imageUrl: "", price: priceList[code.toUpperCase()],
        name: drain ? ["Drain", checkedLabel("rdoDrain")].filter(Boolean).join(", ") : `${title} ${k.toLowerCase()}`.trim(),
        color: drain ? checkedLabel("rdoDrainFinish") || "N/A" : k === "Installation kit" ? checkedLabel("rdoTrim") || "N/A" : "N/A",
        outsideTotal: k === "Installation kit" });
    }
    // Known parts already make the total: an unexplained code is no extra item (dropped).
    if (!(rest.length && total > 0 && Math.abs(known - total) < 0.5)) {
      for (const code of rest) {
        // A base page's drain (DRAINABS-33) is named by its picked drain and finish tiles.
        const drain = /^DRAIN/i.test(code);
        parts.push({ label: drain ? "Drain" : "Item", model: code, typeName: "", collection: "", imageUrl: "",
          name: drain ? ["Drain", checkedLabel("rdoDrain")].filter(Boolean).join(", ") : "", color: drain ? checkedLabel("rdoDrainFinish") : "",
          price: rest.length === 1 && total > known ? Math.round((total - known) * 100) / 100 : 0 });
      }
    }
    return parts.length > 1 ? parts.map(p => ({ ...p, price: p.price || null, pageTotal: total })) : null;
  }

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
      // color: () => checkedLabel("rdoHardwareFinish") || checkedLabel("rdoFinish") || checkedLabel("rdoMaterial"),
      // 1.5.6 (sweep 2): bases and Fibo walls name theirs in the texture tiles ("Slate Matte White").
      color: () => checkedLabel("rdoHardwareFinish") || checkedLabel("rdoFinish") || checkedLabel("rdoMaterial") || checkedLabel("rdoTexture"),
      category: () => fleurcoKind().category, // 1.5.6: a bathtub, base or wall page's own Type
      // name: () => [textOf(".product-page .title"), checkedLabel("rdoGlassType")].filter(Boolean).join(", "),
      // collection: () => textOf(".product-page .title"),
      // name: () => [fleurcoTitle(), checkedLabel("rdoGlassType")].filter(Boolean).join(", "),
      // 1.5.3: with the subtitle's first part ("Tub enclosure", "Flat edge"), which also tells a tub door from a door.
      name: () => [fleurcoTitle(), clean(textOf(".product-page .subtitle")).split("|")[0].split(",")[0].trim(),
        checkedLabel("rdoGlassType")].filter(Boolean).join(", "),
      collection: () => fleurcoTitle(),
      parts: () => fleurcoParts(), // 1.5.5: a door with a base, drain or Mix & Match Kit is one line per part
      image: () => hidVal("hidImage"), // 1.5.5: the door's photo (the page has no og:image)
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
      // 1.5.6 (sweep 2, 11/6): clicking the finish already chosen unselects it; the page then shows "Model#:
      // Master-9190TL-DST" and no price, and the panel kept the old finish with another price.
      // Only the "Master-" model: an Outlet / Recertified page (9159-CZ-DST-R) has one untitled swatch, never "selected".
      pickFirst: () => /^master-/i.test(textOf(".model-name").replace(/^\s*model\s*#?\s*:?\s*/i, "")),
      pickHint: "Pick the finish on the page first: each finish has its own model number and price.",
      parts: main => deltaParts(main), // 1.5.6: a bundle (FVS6-LI0201) is one line per item
    },
    // Kohler (2026-11-05): the color swatches change "?skuId=28000-CM6" (no "K-") and the shown SKU
    // (.product-detail-page__sku-id "K-28000-CM6"); the product data lists every color. The shown SKU picks the
    // color, so the panel follows the page as on Delta instead of offering a dropdown.
    "kohler.com": {
      model: () => textOf(".product-detail-page__sku-id"),
      color: () => {
        const r = document.querySelector(".product-detail-page__color-swatch input:checked");
        // return r ? r.getAttribute("aria-label") || "" : "";
        if (r) return r.getAttribute("aria-label") || "";
        const b = document.querySelector("#finish-type-list [role=radio][aria-checked=true]"); // 1.5.6: the newer bundle layout
        return b ? clean(b.getAttribute("aria-label") || b.textContent) : "";
      },
      // 1.5.3 (sweep 11/5): options that load another product (Crue to Touchless, Verdera width) change the h1 and the
      // price shown, while the product data still describes the first product. The price stays the one Kohler shows
      // ("Current Price $431.25"), as Gib decided on 11/5 ("Leave the Kohler price"); the "List Price $575.00" printed
      // beside it is not used:
      // price: () => amountOf(textOf(".product-detail-page__list-price--associate")),
      // price: () => amountOf(textOf(".product-detail-page__price-value")),
      // price: () => amountOf(textOf(".product-detail-page__price-value")) || amountOf(textOf(".subtotal span")), // 1.5.6: a bundle's "Subtotal"
      // 1.5.7 (Gib 11/6, "Change the app to use the list price for items, not sales price"; reverses "Leave the Kohler
      // price" of 11/5): the "List Price $946.90" under the sale price ("Current Price $710.17", Spacity K-28020-TBH-0).
      price: () => amountOf(anyText(".product-detail-page__list-value")) || amountOf(textOf(".product-detail-page__price-value")) || amountOf(textOf(".subtotal span")),
      name: () => textOf("h1"),
      // 1.5.6 (sweep 2, 11/6): a bundle (BNDL-K0002: spout + handles) lists its items with their own SKU, finish and
      // price, adding up to its price; each goes on as its own line. The newer bundle layout (BNDL-K0059) picks the finish
      // in #finish-type-list and shows a "Subtotal". The items' prices load a moment after the page, so they are also
      // watched (partsKey).
      parts: main => kohlerParts(main),
      partsKey: () => [...document.querySelectorAll("[class*=BundleChildItems_ChildItems], .child-items")].map(b => clean(b.textContent)).join("|"),
      note: () => (/Items Required for Install/i.test(document.body ? document.body.innerText : "")
        ? "This needs a valve or other item sold separately: see \"Items Required for Install\" on the page and add it from its own page." : ""),
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
      // name: () => {
      //   const opts = [...document.querySelectorAll("legend")].map(l => clean(l.textContent))
      //     .filter(s => /:\s*\S/.test(s) && !/^colou?r\s*:/i.test(s) && !/coupon|quantity|contact|feedback/i.test(s))
      //     .map(s => s.replace(/\s*Option\s*:/i, ":").replace(/\s*Color\/Finish\s*:/i, ":").replace(/:\s*/, " "));
      //   return [textOf("h1"), ...opts].filter(Boolean).join(", ");
      // },
      // 1.5.6 (sweep 2, 11/6): only the shown product's legends (a WASHLET+ page keeps hidden blocks for its other
      // products, so "Rough-In 14″, Trip Lever Matte Black" came out four times), each once, and "Auto Flush: With Auto
      // Flush" as "With Auto Flush", "Push Button Options: Polished Nickel" as "Push Button Polished Nickel".
      name: () => totoName(),
      parts: main => totoParts(main), // 1.5.6: add-ons with their own SKUs are their own lines
      note: () => totoNote(), // 1.5.6: a required rough-in sold separately
    },
    // Craft & Main (Shopify): "Color: White Oak" over the options.
    "craftandmain.com": {
      color: () => labeled("legend", /^colou?r\s*:\s*(.+)$/i),
      // 1.5.3 (sweep 11/5): the product data keeps the first variant; the shown SKU follows the size, color and glass
      // picked (CVNA0474-CL-BN to CVNA0674-CL-SV), as reps enter it (LGDR4876-CL-SV). The price is hidden on the site.
      // model: () => { const e = [...document.querySelectorAll(".product-sku")].find(x => x.getClientRects().length); return e ? clean(e.textContent) : ""; },
      // 1.5.6 (sweep 2, 11/6): a size, color and glass combination that is not made keeps the last SKU on the page
      // (Marina 60x74 Brushed Nickel + Grid glass still shows the Clear SKU MRHG6074-CL-BN): the page's own variant list
      // decides, and with no such variant there is no model.
      model: () => {
        const v = cmVariant();
        if (v) return clean(v.sku);
        if (v === null) return "";
        const e = [...document.querySelectorAll(".product-sku")].find(x => x.getClientRects().length);
        return e ? clean(e.textContent) : "";
      },
      pickFirst: () => cmVariant() === null,
      pickHint: "That size, color and glass together are not made: pick another combination on the page.",
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
      // model: () => (/--/.test(location.pathname) ? [...document.querySelectorAll(".prd-as-shown .row .col-sm span")]
      //   .map(e => clean(e.textContent)).filter(s => /\d/.test(s)).join(" + ") : ""),
      // price: () => (/--/.test(location.pathname) ? amountOf(textOf(".prd-as-shown .row.listPrice .prd-as-shown-price")) : ""),
      // 1.5.6 (sweep 2, 11/6): on every product page, not only a "--" combo: an address with a part of 5 or more letters
      // (694767-BNXBL, 65368LF-PCLHP-ECO) gave no model at all. One row is the item itself; several are a kit (parts below),
      // and the joined codes and the "List price as shown" let the open panel follow a rough or handle tile.
      model: () => brizoRows().map(r => r.model).filter(s => /\d/.test(s)).join(" + "),
      price: () => amountOf(textOf(".prd-as-shown .row.listPrice .prd-as-shown-price")),
      name: () => { const rows = brizoRows(); return rows.length ? rows[0].name : ""; },
      parts: main => brizoParts(main), // 1.5.6: a combo, or a trim with its rough valve, is one line per part
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
      // model: () => (/[-,]\s*([A-Z0-9]*\d[A-Z0-9-]*|[A-Z0-9]{2,}(?:-[A-Z0-9]+)+)\.?$/.exec(textOf("h1")) || [])[1] || "",
      // 1.5.6 (sweep 2, 11/6): also a code after a plain space ("Maris Workcenter Sink MAG11031OW-MBK-WKC" read
      // "MBK-WKC", "Maris Lario Pull-Down Faucet LAR-PD-MBK" read "PD-MBK"): the whole last word.
      model: () => (/(?:^|[\s,])([A-Z0-9]*\d[A-Z0-9-]*|[A-Z0-9]{2,}(?:-[A-Z0-9]+)+)\.?$/.exec(textOf("h1")) || [])[1] || "",
      // A sink reached from "All products" has no "kitchen-sinks" in its address; the tab title says "...Kitchen Sink".
      category: () => (/\bkitchen\b/i.test(document.title) ? "Kitchen" : ""),
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
      // 1.5.6 (sweep 2): a discontinued finish (ELG1616MB0C) says so below the heading and shows no price.
      gone: () => !document.querySelector("h3.product-price") && /\bdiscontinued\b/i.test(clean(document.body ? document.body.innerText : "").slice(0, 8000)),
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
      // color: () => {
      //   const m = WOODS.exec(textOf("h1")) || WOODS.exec((document.querySelector('meta[name="description"]') || {}).content || "");
      //   return m ? m[1].replace(/\b\w/g, ch => ch.toUpperCase()) : "";
      // },
      // 1.5.6 (sweep 2, 11/6): a Color option (Classic Country "Alabaster", WAL-PCA "Caviar Black") before the wood; none
      // for "Frame Only" (Laforza's stand, which is not the cherry block).
      color: () => {
        const c = boosOpt(boosCart()[0], /colou?r|finish/i);
        if (c) return c.value;
        if (boosFrameOnly()) return "";
        const m = WOODS.exec(textOf("h1")) || WOODS.exec((document.querySelector('meta[name="description"]') || {}).content || "");
        return m ? m[1].replace(/\b\w/g, ch => ch.toUpperCase()) : "";
      },
      // name: () => textOf("h1"), // the og:title is an SEO title ("John Boos R-Series ... End Grain" for an edge-grain board)
      name: () => (boosFrameOnly() ? `${textOf("h1")}, frame only` : textOf("h1")),
      typeName: () => (boosFrameOnly() ? "MISCELLANEOUS" : ""), // 1.5.6: the stand alone is no butcher block
      // 1.5.7 (Gib 11/6: list price, not sale price): a sale keeps the regular price in the variant's compareAtPrice.
      price: () => { const v = (boosCart()[0] || {}).selectedVariant; return v ? String(boosListPrice(v) || "") : ""; },
      // 1.5.6: the add-on box ("Care & Maintenance Pack" MYSCRMAPP $49.95, "Applicator" APPLICRND1 $24.95) puts a second
      // line in the page's cart; each line is its own item.
      parts: main => boosParts(main),
      partsKey: () => boosCart().map(l => (l.selectedVariant || {}).sku).join(","),
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
      parts: main => groheParts(main), // 1.5.6: a trim and the rough-in it REQUIRES
      note: () => groheNote(),
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
      parts: main => bainParts(main), // 1.5.6: the tub, its drain & overflow kit and each option card
      partsKey: () => [textOf(".bu-configurator__summary-cta-price"), ...[...document.querySelectorAll("article.bu-configurator__option-card--selected")].map(c => c.getAttribute("data-option-sku"))].join(","),
      // 1.5.6: the technology tile for the Type (a freestanding tub's name has no Type word before its first comma).
      category: () => { const c = bainChoices(); const tech = c[Object.keys(c).find(k => /technology/.test(k))] || ""; return /^soaker/i.test(tech) ? "Soaker" : /^thermomasseur/i.test(tech) ? "Air Tub" : ""; },
    },
    // Top Knobs (Magento): before a size and finish are picked, the item number is the product's name and the og price
    // is the family's lowest. After the picks: "Item Number TK1013PN", the price box, the "Finish" spec row.
    "topknobs.com": {
      model: () => { const s = textOf(".product-info-main [itemprop=sku]"); return /\d/.test(s) ? s : ""; },
      price: () => {
        // 1.5.7 (Gib 11/6: list price, not sale price): an item on special shows its regular price as "oldPrice".
        const old = document.querySelector('.product-info-main .price-box [data-price-type="oldPrice"][data-price-amount]');
        if (old && Number(old.getAttribute("data-price-amount")) > 0) return old.getAttribute("data-price-amount");
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
      // 1.5.5 (Gib 11/6, "Flusso Kitchen Faucets aren't working when we change the finish"): a finish square
      // (li.finish-color-box model-no="K.1390MB") changes the address, the "Model#:" line, the finish line ("Matte Black
      // (FAST SHIP FINISH)") and the list price in place, and swaps the product data for a thin copy (name "K.1390MB", no
      // finish, no price). Those page lines follow the square; the heading names the item. The model line sits in a
      // section shown only on wide windows, so a hidden one counts too.
      model: () => flussoText(".product-model-no-p"),
      color: () => flussoText("#product-finish-detail-span").replace(/\s*\((?:fast ship|special)[^)]*\)\s*$/i, ""),
      price: () => flussoText("#product-price-span").replace(/,/g, ""),
      name: () => flussoText("h1"),
      // 1.5.6 (sweep 2, 11/6): the breadcrumbs ("Home - Showering - Shower Faucets - Shower Faucet Trims") for the Type:
      // the thin product data after a finish square has no category, and a trim's name has no Type word.
      category: () => [...document.querySelectorAll("#route-div a")].map(a => clean(a.textContent)).filter(s => s && !/^home$/i.test(s)).join(" / "),
      parts: main => flussoParts(main), // 1.5.6: a trim and its rough valve sold separately
      note: () => flussoNote(),
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
        // const fits = sofiaPrices().filter(p => (!depth || !p.depth || p.depth === depth) && (!edge || !p.edge || p.edge === edge));
        const frame = sofiaFrameOf(sofiaPick("frame")); // 1.5.6: the picked Frame's line
        const fits = sofiaPrices().filter(p => (!depth || !p.depth || p.depth === depth) && (!edge || !p.edge || p.edge === edge) &&
          (!frame || !p.frame || p.frame === frame));
        const prices = [...new Set(fits.map(p => p.price))];
        return prices.length === 1 ? prices[0] : "";
      },
      parts: main => sofiaParts(main), // 1.5.6: ticked accessories and the Elios shelf are their own lines
      partsKey: () => [sofiaPick("shelf"), ...[...document.querySelectorAll('div.checkbox-container > input[type="checkbox"]:checked')].map(i => i.name)].join(","),
      color: () => [sofiaChecked("eff"), sofiaChecked("ls"), sofiaChecked("interior_design") ? `${sofiaChecked("interior_design")} interior` : ""]
        .filter(Boolean).join(", "),
      name: () => {
        const extras = [...document.querySelectorAll('input[type="checkbox"]:checked')].map(c => clean(c.value).replace(/^,\s*/, "")).filter(Boolean);
        const depth = sofiaPick("depth").replace(/\s*DEPTH$/i, " depth").toLowerCase();
        const led = sofiaPick("lstrips") ? `LED ${sofiaPick("lstrips")}` : "";
        const hinge = sofiaChecked("hinge") ? `${sofiaChecked("hinge").replace(/^H/, "")} hinge` : "";
        // return [textOf(".product_title h2"), depth, led, hinge, extras.length ? `with ${extras.join(", ")}` : ""].filter(Boolean).join(", ");
        const frame = sofiaPick("frame") ? sofiaPick("frame").toLowerCase() : ""; // 1.5.6: "narrow framed" or "frameless"
        return [textOf(".product_title h2"), depth, frame, led, hinge, extras.length ? `with ${extras.join(", ")}` : ""].filter(Boolean).join(", ");
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
      // color: () => finishInName(textOf("h1")),
      // 1.5.6 (sweep 2): packs write "ORB" and "Brush Satin Nickel", leave a trailing hyphen, and name the material
      // ("Steel"), which is no finish.
      color: () => {
        const n = textOf("h1");
        if (/\bORB\b/.test(n)) return "Oil Rubbed Bronze";
        const c = finishInName(n.replace(/\bBrush\s+Satin\b/gi, "Brushed Satin")).replace(/[\s-]+$/, "");
        return /^steel$/i.test(c) ? "" : c;
      },
      // The brand starts the page's Google Shopping link ("Laurey+86514", "MNG+15310"): it picks the product line.
      lineHint: () => { const a = document.querySelector('a[href*="google.com/search?q="]'); try { return a ? new URL(a.href).searchParams.get("q").split(/[\s+]/)[0] : ""; } catch { return ""; } },
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
      // imageUrl: (() => { try { const u = new URL(meta("og:image"), location.href); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } })(),
      // 1.5.5: a page with no og:image (Fleurco) gave the page's own address, a broken picture; the rule's photo first.
      imageUrl: (() => {
        const src = (siteRule.image && X.text(siteRule.image())) || meta("og:image");
        if (!src) return "";
        try { const u = new URL(src, location.href); return u.protocol === "https:" ? u.href : ""; } catch { return ""; }
      })(),
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
    // gone = !manual && X.discontinued(live.page);
    gone = !manual && (X.discontinued(live.page) || (() => { try { return !!(siteRule && siteRule.gone && siteRule.gone()); } catch { return false; } })());
    // 1.5.3: the page needs a choice before it names one item (Elkay's base model with finish tiles, Icera before a
    // color, Top Knobs before a size and finish): no model or price yet, and the panel says what to pick.
    pickNeeded = !manual && !!(siteRule && siteRule.pickFirst && siteRule.pickFirst());
    if (pickNeeded) items = items.map(it => ({ ...it, model: "", price: null }));
    // 1.5.5 (Gib 11/6): a kit (Fleurco's door with a base, a drain or a Mix & Match Kit) goes on as one line per part.
    parts = null;
    if (!manual && !pickNeeded && siteRule && siteRule.parts) {
      try {
        // parts = siteRule.parts();
        // 1.5.6: the shown item goes in (TOTO's toilet), and a rule may fetch a part's own page (Flusso's rough valve).
        parts = await siteRule.parts(items[Math.max(selected, 0)] || {});
      } catch {
        parts = null;
      }
    }
    // 1.5.6: what the page says is needed but sold separately, when it cannot be a part ("needs rough-in TBN01105U").
    siteNote = "";
    if (!manual && siteRule && siteRule.note) {
      try {
        siteNote = X.text(await siteRule.note());
      } catch {}
    }
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
      // const crumbs = new Set(X.words(category));
      // 1.5.6 (sweep 2): and the brand a site rule finds (Strategic Brands' "Packs" pages have no brand in the crumbs).
      let hint = "";
      try { hint = siteRule && siteRule.lineHint ? X.text(siteRule.lineHint()) : ""; } catch {}
      const crumbs = new Set([...X.words(category), ...X.words(hint)]);
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
    // const guess = manual && !it.ruleNamed ? null
    //   : X.suggestType({ name: it.name || f.description.value, pageUrl: location.href, category }, options, { orderForms: true });
    // 1.5.6: a site rule can name the Type outright (John Boos' "Frame Only" stand is MISCELLANEOUS, not BUTCHER BLOCK).
    let forced = "";
    try { forced = !manual && siteRule && siteRule.typeName ? X.text(siteRule.typeName()) : ""; } catch {}
    const named = forced ? options.find(t => String(t.name).toUpperCase() === forced.toUpperCase()) : null;
    const guess = named || (manual && !it.ruleNamed ? null
      : X.suggestType({ name: it.name || f.description.value, pageUrl: location.href, category }, options, { orderForms: true }));
    f.type.value = guess ? guess.id : "";
    f.typeWrap.hidden = options.length === 0;
    showOrderForm();
    fillPartTypes(); // 1.5.5
  }

  // 1.5.5 (Gib 11/6): a kit's parts, one block each with its own Type, model, color, Coll/Desc and price; one quantity
  // for all of them (two doors, two bases). The door's Type is guessed as before; a base is SHOWER BASE, a wall panel
  // SHOWER WALL, and a part with no Type of its own (a drain, a Mix & Match Kit) MISCELLANEOUS.
  const PART_FIELDS = [["ptype", "Type"], ["pmodel", "Model"], ["pcolor", "Color / finish"], ["pdesc", "Collection / Description"], ["pprice", "List price"]]; // 1.5.7: was "Price"
  const money = n => String(Math.round(n * 100) / 100);
  // 1.5.6: a part the page sells separately but the item needs (a trim's rough valve) is optional: ticked to start with,
  // untick it when the customer already has one. Unticked parts are not checked or added.
  const partIncluded = box => { const on = box.querySelector(".pon"); return !on || on.checked; };
  function updateKitButton() {
    if (!parts || f.parts.hidden) return;
    const n = [...f.parts.querySelectorAll(".part")].filter(partIncluded).length;
    f.add.textContent = n === 1 ? "Add 1 item to quote" : `Add ${n} items to quote`;
  }
  function renderParts() {
    const kit = !!(parts && parts.length > 1);
    f.single.hidden = kit;
    f.parts.hidden = !kit;
    f.priceWrap.hidden = kit;
    // f.kitHint.hidden = !kit;
    f.kitHint.hidden = !kit && !siteNote; // 1.5.6: a single item's note ("needs the TBN01105U rough-in, sold separately")
    if (!kit && siteNote) f.kitHint.textContent = siteNote;
    f.kitTotalHint.hidden = true;
    f.qtyLabel.textContent = kit ? "Quantity of each" : "Quantity";
    f.add.textContent = kit ? `Add ${parts.length} items to quote` : "Add to quote";
    f.parts.innerHTML = "";
    if (!kit) return;
    f.variantWrap.style.display = "none";
    // f.kitHint.textContent = `This is ${parts.length} items (${parts.map(p => p.label.toLowerCase()).join(", ")}). ` +
    //   "Each one goes on your quote list as its own line, at its own price.";
    const extra = parts.filter(p => p.optional).length;
    f.kitHint.textContent = `This is ${parts.length} items (${parts.map(p => p.label.toLowerCase() + (p.optional ? ", sold separately" : "")).join("; ")}). ` +
      "Each one goes on your quote list as its own line, at its own price." +
      (extra ? " Untick a part sold separately if the customer already has it." : "") + (siteNote ? ` ${siteNote}` : "");
    parts.forEach((p, i) => {
      const box = document.createElement("div");
      box.className = "part";
      box.innerHTML = `<div class="ptitle"><img alt="" hidden><span></span></div>
        <label class="pon-wrap" hidden><input type="checkbox" class="pon" checked> Add this part</label>
        <div class="hint pnote" hidden></div>
        <label class="ptype-wrap">Type<select class="ptype"></select></label>
        <div class="row"><label>Model<input class="pmodel" maxlength="300"></label><label>Color / finish<input class="pcolor" maxlength="300"></label></div>
        <label>Collection / Description<input class="pdesc" maxlength="300"></label>
        <label>List price<input class="pprice" type="number" min="0" step="0.01" inputmode="decimal"></label>`;
      const q = s => box.querySelector(s);
      q(".ptitle span").textContent = `Part ${i + 1} of ${parts.length}: ${p.label}`;
      if (p.imageUrl) {
        q(".ptitle img").src = p.imageUrl;
        q(".ptitle img").hidden = false;
      }
      q(".pmodel").value = p.model || "";
      q(".pcolor").value = p.color || "";
      q(".pdesc").value = X.collDesc(p.collection || "", X.descName(p.name || "", p.model, p.color));
      q(".pprice").value = p.price != null ? String(p.price) : "";
      if (p.optional) {
        q(".pon-wrap").hidden = false;
        q(".pon").addEventListener("change", () => {
          const on = q(".pon").checked;
          box.classList.toggle("off", !on);
          for (const el of box.querySelectorAll("input:not(.pon), select")) {
            el.disabled = !on;
            el.classList.remove("missing");
          }
          updateKitButton();
          checkKitTotal();
        });
      }
      if (p.note) {
        q(".pnote").textContent = p.note;
        q(".pnote").hidden = false;
      }
      for (const el of box.querySelectorAll("input:not(.pon), select")) {
        for (const ev of ["input", "change"]) {
          el.addEventListener(ev, () => {
            el.classList.remove("missing");
            if (el.classList.contains("pprice")) checkKitTotal();
          });
        }
      }
      f.parts.appendChild(box);
    });
    fillPartTypes();
    updateKitButton();
    checkKitTotal();
  }
  function fillPartTypes() {
    if (!parts || f.parts.hidden) return;
    const line = currentLine();
    const options = line ? (line.types || []) : [];
    const byName = n => (n ? options.find(t => String(t.name).toUpperCase() === n.toUpperCase()) : null);
    f.parts.querySelectorAll(".part").forEach((box, i) => {
      const p = parts[i] || {};
      const sel = box.querySelector(".ptype");
      sel.innerHTML = "";
      sel.appendChild(new Option("Choose a type", ""));
      for (const t of options) {
        const o = new Option(t.requiresAttachment ? `${t.name} (order form)` : t.name, t.id);
        o.dataset.name = t.name;
        sel.appendChild(o);
      }
      // 1.5.6: "=main" is the first part's Type (Brizo's handle kit is ordered as the faucet or trim it goes on);
      // "=accessory" the accessory Type of the first part's room (BATH - ACCESSORY or KITCHEN - ACCESSORY).
      if (i > 0 && (p.typeName === "=main" || p.typeName === "=accessory")) {
        const first = f.parts.querySelector(".part .ptype");
        const firstName = first && first.selectedOptions[0] ? String(first.selectedOptions[0].dataset.name || "") : "";
        const pick = p.typeName === "=main" ? (first ? first.value : "")
          : ((options.find(t => /accessor/i.test(t.name) && (/^kitchen/i.test(firstName) ? /^kitchen/i : /^bath/i).test(t.name)) ||
            options.find(t => /accessor/i.test(t.name)) || byName("MISCELLANEOUS") || {}).id || "");
        sel.value = pick || "";
        box.querySelector(".ptype-wrap").hidden = options.length === 0;
        return;
      }
      // Only the door is guessed with the page's address and breadcrumbs: a drain on a shower door page is no door.
      const guess = byName(p.typeName) ||
        X.suggestType(i === 0 ? { name: p.name || p.label, pageUrl: location.href, category } : { name: `${p.label} ${p.name || ""}` }, options, { orderForms: true }) ||
        byName("MISCELLANEOUS");
      sel.value = guess ? guess.id : "";
      box.querySelector(".ptype-wrap").hidden = options.length === 0;
    });
  }
  // The parts should add up to the page's total; a part priced by hand, or a price the page did not give, can break that.
  function checkKitTotal() {
    if (!parts || f.parts.hidden) return;
    // const total = Number(parts[0].pageTotal) || 0;
    // const sum = [...f.parts.querySelectorAll(".pprice")].reduce((s, el) => s + (Number(el.value) || 0), 0);
    // 1.5.6: a part sold separately is not in the page's total.
    const total = Number((parts.find(p => p.pageTotal) || {}).pageTotal) || 0;
    const sum = [...f.parts.querySelectorAll(".part")].reduce((s, box, i) =>
      s + ((parts[i] || {}).outsideTotal ? 0 : Number(box.querySelector(".pprice").value) || 0), 0);
    const off = total > 0 && Math.abs(sum - total) > 0.5;
    f.kitTotalHint.hidden = !off;
    if (off) f.kitTotalHint.textContent = `These prices add up to $${money(sum)}, but the page's total is $${money(total)}. Check them before adding.`;
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
    renderParts(); // 1.5.5
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
    // ["price", "Price on this site"],
    ["price", "List price"], // 1.5.7
    ["qty", "Quantity"],
  ];
  const KIT_OWN = new Set(["type", "model", "color", "description", "price"]); // 1.5.5: each part has its own
  function missingFields() {
    const out = [];
    const kit = !!(parts && !f.parts.hidden);
    for (const [key, label, shown] of REQUIRED) {
      const el = f[key];
      // if (shown && !shown()) {
      if ((shown && !shown()) || (kit && KIT_OWN.has(key))) {
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
    // 1.5.5: every part's own fields, named with the part ("Color / finish (part 3)").
    if (kit) {
      f.parts.querySelectorAll(".part").forEach((box, i) => {
        if (!partIncluded(box)) return; // 1.5.6: an unticked part sold separately
        for (const [cls, label] of PART_FIELDS) {
          const el = box.querySelector(`.${cls}`);
          if (cls === "ptype" && box.querySelector(".ptype-wrap").hidden) continue;
          const v = String(el.value || "").trim();
          const ok = v !== "" && (cls !== "pprice" || Number(v) > 0);
          el.classList.toggle("missing", !ok);
          if (!ok) out.push({ el, label: `${label} (part ${i + 1})` });
        }
      });
    }
    return out;
  }
  function clearMissing() {
    for (const [key] of REQUIRED) f[key].classList.remove("missing");
    for (const el of f.parts.querySelectorAll(".missing")) el.classList.remove("missing"); // 1.5.5
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
    // 1.5.5 (Gib 11/6): a kit goes on as one line per part, all in one message so none is left out.
    if (parts && !f.parts.hidden) {
      const kitLine = currentLine();
      // const picks = [...f.parts.querySelectorAll(".part")].map((box, i) => {
      const picks = [...f.parts.querySelectorAll(".part")].map((box, i) => [box, i]).filter(([box]) => partIncluded(box)).map(([box, i]) => {
        const p = parts[i] || {};
        const sel = box.querySelector(".ptype"), o = sel.selectedOptions[0];
        const desc = box.querySelector(".pdesc").value;
        return {
          name: p.name || desc || "", model: box.querySelector(".pmodel").value, color: box.querySelector(".pcolor").value,
          price: box.querySelector(".pprice").value, currency: "USD", imageUrl: p.imageUrl || "", quantity: f.qty.value,
          productLineId: kitLine ? kitLine.id : "", typeId: sel.value, typeName: sel.value && o ? o.dataset.name || o.textContent : "",
          collection: "", description: desc, category,
        };
      });
      f.add.disabled = true;
      let kitRes = null;
      try {
        kitRes = await chrome.runtime.sendMessage({ type: "add-picks", picks });
      } catch {}
      msg.hidden = false;
      if (kitRes && kitRes.ok) {
        msg.className = "msg ok";
        // msg.textContent = `Added ${picks.length} items to the CPS Quote List, one line per part. ${kitRes.count} item${kitRes.count === 1 ? "" : "s"} waiting for your sales rep.`;
        msg.textContent = `Added ${picks.length} item${picks.length === 1 ? "" : "s"} to the CPS Quote List, one line per part. ${kitRes.count} item${kitRes.count === 1 ? "" : "s"} waiting for your sales rep.`;
        refreshCount();
      } else {
        msg.className = "msg err";
        msg.textContent = "Could not add these items. Please ask your sales rep.";
        f.add.disabled = false;
      }
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
  // 1.5.6: the panel's side of the page, kept for this site in this browser.
  const SIDE_KEY = "consumers-quickadd-side";
  const applySide = left => { panel.classList.toggle("left", left); fab.classList.toggle("left", left); };
  try { applySide(localStorage.getItem(SIDE_KEY) === "left"); } catch {}
  $(".side").addEventListener("click", () => {
    const left = !panel.classList.contains("left");
    applySide(left);
    try { localStorage.setItem(SIDE_KEY, left ? "left" : "right"); } catch {}
  });

  // 1.5.7 (Gib 11/6): Report issue. What the customer types, plus what this panel read, goes to the Product Selector's
  // Report Issue (a NetSuite case for IT) through the background script; no sign-in needed, no customer details sent.
  const rBox = $(".report-box"), rText = $(".r-text"), rName = $(".r-name"), rMsg = $(".r-msg"), rSend = $(".r-send");
  const browserName = () => {
    const ua = navigator.userAgent;
    const m = /Edg\/(\d+)/.exec(ua) || /Chrome\/(\d+)/.exec(ua);
    return m ? `${/Edg\//.test(ua) ? "Edge" : "Chrome"} ${m[1]}${navigator.platform ? ` on ${navigator.platform}` : ""}` : ua.slice(0, 160);
  };
  const optText = sel => (sel && sel.value && sel.selectedOptions[0] ? String(sel.selectedOptions[0].dataset.name || sel.selectedOptions[0].textContent) : "");
  $(".report").addEventListener("click", () => {
    rBox.hidden = !rBox.hidden;
    if (rBox.hidden) return;
    rMsg.hidden = true;
    rSend.disabled = false;
    rText.focus();
    rBox.scrollIntoView({ block: "nearest" });
  });
  $(".r-cancel").addEventListener("click", () => { rBox.hidden = true; });
  rSend.addEventListener("click", async () => {
    const what = rText.value.trim();
    rMsg.hidden = false;
    if (!what) {
      rMsg.className = "msg r-msg err";
      rMsg.textContent = "Please say what went wrong.";
      rText.focus();
      return;
    }
    rSend.disabled = true;
    rMsg.className = "msg r-msg";
    rMsg.textContent = "Sending...";
    const kit = !!(parts && !f.parts.hidden);
    const lineName = f.lineWrap.hidden ? (currentLine() || {}).name || "" : optText(f.line);
    const report = {
      text: what, reporter: rName.value.trim(), browser: browserName(), message: msg.hidden ? "" : msg.textContent,
      fields: kit ? { quantity: f.qty.value, line: lineName }
        : { type: optText(f.type), model: f.model.value, color: f.color.value, description: f.description.value, price: f.price.value, quantity: f.qty.value, line: lineName },
      parts: kit ? [...f.parts.querySelectorAll(".part")].map(b => ({ model: b.querySelector(".pmodel").value, type: optText(b.querySelector(".ptype")),
        color: b.querySelector(".pcolor").value, description: b.querySelector(".pdesc").value, price: b.querySelector(".pprice").value })) : [],
    };
    let res = null;
    try {
      res = await chrome.runtime.sendMessage({ type: "report-issue", report });
    } catch {}
    if (res && res.ok) {
      rMsg.className = "msg r-msg ok";
      rMsg.textContent = `Sent to Consumers IT${res.caseNumber ? ` as case #${res.caseNumber}` : ""}. Thank you.`;
      rText.value = "";
    } else {
      rMsg.className = "msg r-msg err";
      rMsg.textContent = `Could not send the report${res && res.error ? ` (${res.error})` : ""}. Try again, or open the Product Selector and use Report Issue at the bottom of any page.`;
      rSend.disabled = false;
    }
  });
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
  // const pageKey = () => {
  //   const v = siteValues();
  //   return `${location.href}|${v.model || ""}|${v.color || ""}|${v.price || ""}|${v.name || ""}`;
  // };
  // 1.5.6: and what the rule watches for a kit's parts (Kohler bundle items whose prices load after the page).
  const pageKey = () => {
    const v = siteValues();
    let pk = "";
    try { pk = siteRule && siteRule.partsKey ? String(siteRule.partsKey()) : ""; } catch {}
    return `${location.href}|${v.model || ""}|${v.color || ""}|${v.price || ""}|${v.name || ""}|${pk}`;
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
    // 1.5.4: an older copy that drew its button after this one (copies before 1.5.1 never checked) is removed; a newer
    // copy's button, or the same version drawn first, means this one steps aside.
    for (const h of others()) {
      if (h === host) continue;
      const theirs = h.getAttribute("data-consumers-quote-helper");
      if (newer(MY_VERSION, theirs)) h.remove();
      else if (newer(theirs, MY_VERSION) || (h.compareDocumentPosition(host) & Node.DOCUMENT_POSITION_FOLLOWING)) host.remove();
    }
    if (!host.isConnected) return;
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
