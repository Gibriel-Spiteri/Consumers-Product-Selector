// Live check of Consumers QuickAdd (Consumers Quote Helper until 1.5.0) on the real vendor websites, with the real extension loaded in a
// throwaway Chromium profile. It opens one product page per vendor, reads the panel, changes the finish where the
// site allows it (Delta) or walks a configurator (Fleurco), adds picks to the extension's own storage, and checks the
// hand-off to the Product Selector's page. Read-only for the vendors and NetSuite: nothing is ordered, sent or saved
// anywhere else.
//
// Run:  node browser-extension/test/live-vendors.cjs [--headed] [vendor ...]
//       vendor = delta, kohler, toto, ... (default: all). Needs Playwright with its Chromium: set PLAYWRIGHT to a
//       folder whose node_modules has it, for example PLAYWRIGHT=C:/Users/gspiteri1/Desktop/Git/Bundle63418/Projects/SrrUiTests
// Exit code 1 when any check fails. Screenshots of each panel go to browser-extension/test/live-shots (gitignored).
//
// Prices and finishes are the vendors' own and change over time, so prices are only checked for being there (or not);
// models, finishes, collections and Types are checked exactly.
const path = require("path");
const fs = require("fs");
const os = require("os");

const PW = process.env.PLAYWRIGHT ? path.join(process.env.PLAYWRIGHT, "node_modules", "playwright") : "playwright";
const { chromium } = require(PW);
const EXT = path.resolve(__dirname, "..", "consumers-quote-helper");
const SHOTS = path.join(__dirname, "live-shots");
const APP = "https://consumers-product-selector.replit.app/";
const SITES = JSON.parse(fs.readFileSync(path.join(__dirname, "vendor-sites.json"), "utf8")).sites;
// A normal desktop Chrome: some vendors (Delta) challenge browsers that say they are automated.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const anyPrice = { price: v => Number(v) > 0 };
const noPrice = { price: v => v === "" };
// 1.5.6: a kit's parts by model (in order), and their prices adding up.
const models = (...want) => ps => ps.length === want.length && want.every((m, i) => (m instanceof RegExp ? m.test(ps[i].model) : ps[i].model === m));
const sumIs = total => ps => Math.abs(ps.reduce((s, p) => s + Number(p.price || 0), 0) - total) < 0.02;
const all = (...fns) => v => fns.every(f => f(v));

// What each vendor's product page should give (checked 2026-11-04).
const VENDORS = [
  { key: "delta", url: "https://www.deltafaucet.com/kitchen/product/9190TL-DST.html", add: true,
    // The header is Consumers Confirm's blue (#1f4fd1 to #183fa8), Jim 11/5.
    expect: { model: "9190TL-DST", color: "Chrome", collDesc: v => v.toLowerCase().includes("broderick"), type: "KITCHEN FAUCET", header: h => /31, 79, 209/.test(h), ...anyPrice },
    // Pick another finish with the panel open: the panel follows it.
    // Clicked from the page: at this window size the open panel sits over Delta's swatches.
    change: async page => page.evaluate(() => document.querySelector('button.product-attribute__swatch[title^="Finish: Polished Nickel"]').click()),
    afterChange: { model: "9190TL-PN-DST", color: "Polished Nickel", ...anyPrice } },
  // Jim (11/5): the panel kept 35442-MPU-DST after Champagne Bronze was picked. The shown MODEL# is read first.
  { key: "delta2", url: "https://www.deltafaucet.com/bathroom/product/35442-MPU-DST.html",
    expect: { model: "35442-MPU-DST", color: "Chrome", collDesc: v => v.toLowerCase().includes("altado"), type: "BATH FAUCET", ...anyPrice },
    change: async page => page.evaluate(() => document.querySelector('button.product-attribute__swatch[title^="Finish: Champagne Bronze"]').click()),
    afterChange: { model: "35442-CZMPU-DST", color: "Champagne Bronze", collDesc: v => v.toLowerCase().includes("altado"), ...anyPrice } },
  // Jim (11/5): Kohler offered a color dropdown while Delta followed the page. Now Kohler follows the page too.
  { key: "kohler", url: "https://www.kohler.com/en/products/kitchen-sinks/shop-kitchen-sinks/cairn-27-1-2-x-18-5-16-x-9-1-2-neoroc-under-mount-single-bowl-kitchen-sink-with-sink-rack-28000",
    expect: { model: /^K-28000-CM\d+$/, collDesc: v => v.toLowerCase().includes("cairn"), type: "KITCHEN SINK", optionsShown: false, ...anyPrice },
    change: async page => page.evaluate(() => document.querySelector('.product-detail-page__color-swatch input[aria-label="Matte White"]').click()),
    afterChange: { model: "K-28000-CM6", color: "Matte White", optionsShown: false, ...anyPrice } },
  // 1.5.3: the color comes from "Color: Cotton"; picking Ebony on the page changes the SKU, finish and price.
  // (Until 1.5.3 the page gave no color: fill: { ".color": "Cotton White" } tested the refusal; Icera does now.)
  { key: "toto", url: "https://www.totousa.com/drake-two-piece-128-gpf-elongated-bowl", add: true,
    expect: { model: /^CST776CEG#\d\d$/, color: "Cotton", collDesc: v => v.toLowerCase().includes("drake"), type: "TOILET", ...anyPrice },
    change: async page => page.evaluate(() => {
      const r = [...document.querySelectorAll('input[name^="color_"]')].find(i => {
        const l = i.closest("label") || (i.id && document.querySelector(`label[for="${CSS.escape(i.id)}"]`));
        return l && l.textContent.trim().startsWith("Ebony");
      });
      if (r) r.click();
    }),
    afterChange: { model: "CST776EF#51", color: "Ebony", ...anyPrice } },
  { key: "brizo", url: "https://www.brizo.com/bath/product/T66T030-PC",
    // expect: { model: "T66T030-PC", color: "Polished Chrome", collDesc: v => v.toLowerCase().includes("virage"), type: "SHOWER SYSTEM - VALVE TRIM", ...anyPrice } },
    // 1.5.6 (sweep 2): the page shows the trim with its rough valve R35000-WS ($952 + $499): two lines.
    expect: { parts: all(models("T66T030-PC", "R35000-WS"), ps => ps[0].color === "Polished Chrome" && ps[0].collDesc.toLowerCase().includes("virage") &&
      ps[0].type === "SHOWER SYSTEM - VALVE TRIM" && ps[1].type === "SHOWER SYSTEM - VALVE ROUGH"), totalWarning: false } },
  { key: "topknobs", url: "https://www.topknobs.com/barrow-knob.html?finish_tk=13603",
    expect: { model: "TK1050BSN", color: "Brushed Satin Nickel", type: "KNOBS", ...anyPrice } },
  { key: "richelieu", url: "https://www.richelieu.com/us/en/category/decorative-hardware/cabinet-hardware-pulls-and-knobs/pulls/contemporary-metal-pull-5632/1166124/sku-BP56325128195",
    expect: { model: "BP56325128195", color: "Brushed Nickel", type: "PULL", ...noPrice } },
  // { key: "elkay", url: "https://www.elkay.com/products/sinks/materials/stainless-steel/ectru24179rt",
  //   expect: { model: "ECTRU24179RT", color: "Stainless Steel", collDesc: v => v.toLowerCase().includes("crosstown"), ...noPrice } },
  // 1.5.3: the list price hidden behind "Show List Price" is read; the room row makes it a KITCHEN SINK.
  { key: "elkay", url: "https://www.elkay.com/products/sinks/materials/stainless-steel/ectru24179rt",
    expect: { model: "ECTRU24179RT", color: "Stainless Steel", collDesc: v => v.toLowerCase().includes("crosstown"), type: "KITCHEN SINK", ...anyPrice } },
  // 1.5.3 sweep: the chosen finish tile, not "Material | Brass".
  { key: "elkay2", url: "https://www.elkay.com/products/faucets/residential-use/ada-compliant/lkav1061ls",
    expect: { model: "LKAV1061LS", color: "Lustrous Steel", type: "KITCHEN FAUCET", ...anyPrice } },
  { key: "flusso", url: "https://www.flussofaucets.com/products/10FGC4003CP-hole-in-glass-center-mount-glass-clamp/",
    expect: { model: "10.FGC.4003CP", color: "Chrome", ...anyPrice } },
  // Gib (11/5, "get Flusso working better"): the collection from the details row, and the model, not the barcode.
  { key: "flusso2", url: "https://www.flussofaucets.com/products/2501000CP-single-hole-bathroom-faucet/",
    expect: { model: "250.1000CP", color: "Chrome", collDesc: "Serie 250 Single Hole Bathroom Faucet", type: "BATH FAUCET", ...anyPrice } },
  { key: "flusso3", url: "https://www.flussofaucets.com/products/K1200CR-caso-semi-professional-dual-spray-stainless-steel-kitchen-faucet-with-pull-out/",
    expect: { model: "K.1200CR", color: "Crimson", collDesc: v => v.startsWith("Caso"), type: "KITCHEN FAUCET", ...anyPrice } },
  // 1.5.5 (Gib 11/6, "Flusso Kitchen Faucets aren't working when we change the finish"): a finish square changes the
  // item in place and leaves thin product data (name "K.1390MB", no finish, no price).
  { key: "flusso4", url: "https://www.flussofaucets.com/products/K1390SS-vasco-dual-spray-stainless-steel-kitchen-faucet-with-pull-out-knurling/",
    expect: { model: "K.1390SS", color: "Stainless Steel", type: "KITCHEN FAUCET", ...anyPrice },
    change: async page => page.evaluate(() => document.querySelector('li.finish-color-box[model-no="K.1390MB"]').click()),
    afterChange: { model: "K.1390MB", color: "Matte Black", collDesc: v => v.startsWith("Vasco"), type: "KITCHEN FAUCET", ...anyPrice } },
  // The Monza tub shield used on 11/4 was gone by 11/5; Neptune's addresses keep this shape.
  // Neptune stopped being a special-order line in NetSuite on 11/4 (EPS unchecked), so the extension no longer runs there.
  // { key: "neptune", url: "https://produitsneptune.com/product/belaya-32-36-x-72-in-6mm-pivot-shower-door-for-alcove-installation/220333/220333-900-084-000",
  //   expect: { model: "220333-900-084-000", type: "", ...anyPrice } }, // no shower-door Type at Neptune: not SHOWER BASE
  // { key: "craftandmain", url: "https://craftandmain.com/products/craft-main%C2%AE-ashlow%E2%84%A2-vanity-with-engineered-stone-top",
  //   expect: { model: "AWWVT2419D", color: "White Oak", lineShown: true, ...anyPrice } },
  // 11/5: Craft & Main's special-order line is now FOREMOST T&S DOORS only (Foremost Bath vanities stopped). The shown SKU
  // follows the color picked; the site hides prices.
  { key: "craftandmain", url: "https://craftandmain.com/collections/all-shower-doors-1/products/craft-main%C2%AE-tides-framed-sliding-tub-shower-door",
    expect: { model: /^TDST\w+-\w+-BN$/, color: "Brushed Nickel", type: "Tub Door", lineShown: false, ...noPrice },
    change: async page => page.evaluate(() => {
      const e = [...document.querySelectorAll("input[type=radio], label, button")].find(x => /^silver$/i.test((x.value || x.textContent || "").trim()) && x.getClientRects().length);
      if (e) e.click();
    }),
    afterChange: { model: /^TDST\w+-\w+-SV$/, color: "Silver", ...noPrice } },
  { key: "johnboos", url: "https://www.johnboos.com/products/cherry-cucina-damico-wine-cart-with-undershelves-and-towel-bar",
    expect: { model: "CHY-CUCD15WC", color: "Cherry", type: "", ...anyPrice } }, // a wine cart: no Type guess from "Boos Blocks"
  // Icera prints no color anywhere, so (1.5.2) Add is refused until the customer types one.
  // { key: "icera", url: "https://icerabath.com/product/antigua-undermount-lavatory/", add: true, fill: { ".color": "White", ".type": "BATH SINK" },
  //   expect: { model: "1022.000.01", color: "", ...anyPrice } },
  // 1.5.3: the lavatory is a BATH SINK, and its color is read; the refusal is tested by emptying the fields (fill).
  { key: "icera", url: "https://icerabath.com/product/antigua-undermount-lavatory/", add: true, fill: { ".color": "White", ".type": "BATH SINK" },
    expect: { model: "1022.000.01", type: "BATH SINK", ...anyPrice } },
  // 1.5.3 sweep: picking another color changes the SKU and price without a new address.
  { key: "icera2", url: "https://icerabath.com/product/c-6690-muse-one-piece-toilet/",
    expect: { model: "C-6690.01", color: "Gloss White", type: "TOILET", ...anyPrice },
    change: async page => page.evaluate(() => {
      const s = document.querySelector('select[name="attribute_pa_colors"]');
      const o = [...s.options].find(x => /black/i.test(x.textContent));
      s.value = o.value;
      s.dispatchEvent(new Event("change", { bubbles: true }));
    }),
    afterChange: { model: "C-6690.55", color: "Matte Black", ...anyPrice } },
  // Jim (11/5): "Not parsing out the finish or collection" on this page.
  { key: "strategic", url: "https://strategicbrandsincorporated.com/80828/128mm-austin-pull-satin-nickel",
    expect: { model: "80828", color: "Satin Nickel", collDesc: v => v.toLowerCase().includes("austin"), lineShown: true, ...noPrice } },
  // { key: "franke", url: "https://www.franke.com/us/en/home-solutions/products/kitchen-faucets/product-detail-page.html/115.0731.726.html",
  //   expect: { model: "115.0731.726", color: "Copper", ...noPrice } },
  // 1.5.3: the model code that ends the heading, as reps enter Franke (not the Article Number).
  { key: "franke", url: "https://www.franke.com/us/en/home-solutions/products/kitchen-faucets/product-detail-page.html/115.0731.726.html",
    expect: { model: "MMX-PD-CPR", color: "Copper", type: "KITCHEN FAUCET", ...noPrice } },
  // ---- 1.5.3 sweep (11/5): one case per new rule ----
  // Grohe: the shown variant's SKU and list price (the product data has 75% of list), and its finish change.
  { key: "grohe", url: "https://www.grohe.us/products/concetto-single-handle-pull-down-kitchen-faucet-dual-spray-1-75-gpm-6-6-l-min?variant=51098917011769",
    expect: { model: "32665003", color: "StarLight Chrome", type: "KITCHEN FAUCET", collDesc: v => v.startsWith("Concetto"), price: v => Number(v) > 500 },
    change: async page => page.evaluate(() => {
      const e = [...document.querySelectorAll("[aria-label],[title],label,button,input")].find(x => /supersteel/i.test(x.getAttribute("aria-label") || x.getAttribute("title") || x.getAttribute("value") || x.textContent || "") && x.getClientRects().length);
      if (e) e.click();
    }),
    afterChange: { model: "32665DC3", color: /SuperSteel/, ...anyPrice } },
  // Kohler: the list price, not the sale price in its product data.
  // 11/5: Gib kept the price Kohler shows (the sale price), so this only checks one is read.
  { key: "kohler2", url: "https://www.kohler.com/en/products/kitchen-faucets/shop-kitchen-faucets/crue-pull-down-kitchen-sink-faucet-w-three-function-sprayhead-22972?skuId=22972-CP",
    expect: { model: "K-22972-CP", type: "KITCHEN FAUCET", ...anyPrice } }, // sale $431.25, list $575 on 11/5
  // Brizo: a combo's parts and its "List price as shown".
  { key: "brizo2", url: "https://www.brizo.com/bath/product/65368LF-PCLHP-ECO--HL5368-PCCL", settle: 8000, // its "as shown" block draws late
    expect: { model: "65368LF-PCLHP-ECO + HL5368-PCCL", color: "Polished Chrome", type: "BATH - LAVATORY FAUCET", price: v => Number(v) > 900 } },
  // Delta Outlet: the struck-through list price.
  { key: "delta3", url: "https://www.deltafaucet.com/kitchen/product/9159-CZ-DST-R.html",
    expect: { model: "9159-CZ-DST-R", color: "Champagne Bronze", price: v => Number(v) > 900 } }, // list $1028, sale $484.06 on 11/5
  // Top Knobs: nothing until a size and finish are picked, then the item, its price and finish.
  { key: "topknobs2", url: "https://www.topknobs.com/collections/riverside-pull.html",
    prepare: async page => page.evaluate(() => {
      const o = [...document.querySelectorAll(".swatch-attribute .swatch-option")].find(x => /5 1\/16/.test(x.getAttribute("data-option-label") || ""));
      if (o) o.click();
    }),
    expect: { model: "", type: "PULLS", ...noPrice },
    change: async page => page.evaluate(() => {
      const o = [...document.querySelectorAll(".swatch-attribute .swatch-option")].find(x => /polished nickel/i.test(x.getAttribute("data-option-label") || ""));
      if (o) o.click();
    }),
    afterChange: { model: "TK1013PN", color: "Polished Nickel", collDesc: v => v.startsWith("Grace Riverside Pull"), ...anyPrice } },
  // Bain Ultra: the pressed tiles name the tub variant; its Types are order-form Types.
  { key: "bain", url: "https://www.bainultra.com/products/amma-6030",
    expect: { model: "BAMBRA0LN-01", color: "Glossy White", type: "SOAKER (order form)", ...anyPrice },
    change: async page => page.evaluate(() => {
      for (const l of ["Right Drain", "Glossy Biscuit", "ThermoMasseur"]) {
        const b = [...document.querySelectorAll("button.bu-configurator__selector-tile")].find(x => x.textContent.replace(/\s+/g, " ").trim().startsWith(l));
        if (b) b.click();
      }
    }),
    afterChange: { model: "BAMBRA0RT-02", color: "Glossy Biscuit", type: "AIR TUB (order form)", ...anyPrice } },
  // Sofia (also on plain http): nothing until a model number and depth are picked, then "ART 2430 1D-1".
  { key: "sofia", url: "http://shop.sofiamedicinecabinets.com/artemis-collection-cabinets.php?h=30&d=d1",
    expect: { model: "", type: "MEDICINE CABINET", manual: true },
    change: async page => page.evaluate(() => {
      const s = document.querySelector('select[name="model_number"]');
      s.value = "ART 2430 1D";
      s.dispatchEvent(new Event("change", { bubbles: true }));
      const d = document.querySelector('select[name="depth"]');
      d.value = d.options[1].value;
      d.dispatchEvent(new Event("change", { bubbles: true }));
      [...document.querySelectorAll('input[name="ls"]')].find(i => /bevel/i.test(i.value)).click();
      [...document.querySelectorAll('input[name="interior_design"]')].find(i => /white/i.test(i.value)).click();
    }),
    afterChange: { model: "ART 2430 1D-1", color: "3/4 Bevel, White interior", manual: false, ...anyPrice } },
  { key: "fleurco", url: "https://fleurco.com/shower-doors/horizon-sliding-inline", add: true,
    // The configurator shows the model only after every choice: 60" front, 79" glass, right door, clear glass,
    // brushed nickel, no Mix & Match Kit.
    prepare: async page => {
      await page.selectOption('select[name="drpFront"], #drpFront', "60");
      await page.waitForTimeout(1500);
      await page.selectOption('select[name="drpHeight"], #drpHeight', "79");
      await page.waitForTimeout(1500);
      for (const [name, value] of [["rdoSide", "R"], ["rdoGlassType", "40"], ["rdoHardwareFinish", "25"]]) {
        await page.evaluate(([n, v]) => { const r = document.querySelector(`input[name="${n}"][value="${v}"]`); if (r) r.click(); }, [name, value]);
        await page.waitForTimeout(1200);
      }
      await page.getByText("no Mix & Match Kit", { exact: true }).click();
      await page.waitForTimeout(1500);
    },
    expect: { model: "NHS160-25-40R-79", color: "Brushed Nickel", type: "SHOWER DOOR", manual: false, ...anyPrice } },
  // Gib (11/5): on the Vespero Pivot, choices made with the panel open did not reach it. The panel opens before the
  // last choice (no model yet), then the finish is picked on the page: the panel must follow.
  { key: "fleurco2", url: "https://fleurco.com/shower-doors/vespero-pivot-2sided",
    prepare: async page => {
      await page.selectOption("#drpFront", "48");
      await page.waitForTimeout(1500);
      await page.evaluate(() => { const r = document.querySelector('input[name="rdoGlassType"][value="40"]'); if (r) r.click(); });
      await page.waitForTimeout(1500);
    },
    expect: { model: "", manual: true },
    change: async page => page.evaluate(() => { const r = document.querySelector('input[name="rdoHardwareFinish"][value="12"]'); if (r) r.click(); }),
    afterChange: { model: "VP4836-12-40-79", color: "Brushed Gold", collDesc: "Vespero Pivot, 2 sided, Clear Glass (6mm)", manual: false, ...anyPrice } }, // 1.5.3: with the subtitle
  // 1.5.5 (Gib 11/6): a door with a Mix & Match Kit, then a base and its drain from "Add a base", is four items: the
  // panel shows one block per part, priced from the page, adding up to the total, and adds them as four picks.
  { key: "fleurco3", url: "https://fleurco.com/shower-doors/horizon-sliding-inline-reversible", add: true,
    prepare: async page => {
      await page.selectOption("#drpFront", "48");
      await page.waitForTimeout(1500);
      await page.selectOption("#drpHeight", "75");
      await page.waitForTimeout(1500);
      for (const [name, value] of [["rdoHardwareFinish", "25"], ["rdoHardwareKit", "NH-CONVKIT-11-MX"]]) {
        await page.evaluate(([n, v]) => { const r = document.querySelector(`input[name="${n}"][value="${v}"]`); if (r) (r.closest("label") || r).click(); }, [name, value]);
        await page.waitForTimeout(1500);
      }
      await page.evaluate(() => basepopup());
      await page.waitForTimeout(1500);
      for (const [name, value] of [["rdoBase", "110"], ["rdoDrainBase", "DRAINABS"]]) {
        await page.evaluate(([n, v]) => { const r = document.querySelector(`input[name="${n}"][value="${v}"]`); if (r) (r.closest("label") || r).click(); }, [name, value]);
        await page.waitForTimeout(1800);
      }
      await page.evaluate(() => addBase());
      await page.waitForTimeout(3000);
    },
    expect: { parts: ps => ps.length === 4 &&
      [["NHZ148-25-40-75", "SHOWER DOOR"], ["NH-CONVKIT-11-MX", "MISCELLANEOUS"], ["ATAS2-3648", "SHOWER BASE"], ["DRAINABS-33", "MISCELLANEOUS"]]
        .every(([m, t], i) => ps[i].model === m && ps[i].type === t && !!ps[i].color && Number(ps[i].price) > 0 && !!ps[i].collDesc),
      totalWarning: false, button: "Add 4 items to quote" } },
  // 1.5.6 (Gib 11/6: "We need to be vigorous in our testing"; sweep 2 found kits on most vendors and changes made on the
  // page that the panel did not follow). Each case clicks what a customer clicks, with the panel open.
  { key: "brizo-kit", url: "https://www.brizo.com/bath/product/T60267-PCLHP--HL6067-PC--R60000-UNWS", settle: 7000,
    expect: { parts: all(models("T60267-PCLHP", "HL6067-PC", "R60000-UNWS"), ps => ps[2].type === "SHOWER SYSTEM - VALVE ROUGH"), totalWarning: false } },
  { key: "brizo-rough", url: "https://www.brizo.com/bath/product/T60405-PC", settle: 7000,
    expect: { parts: models("T60405-PC", /^R60000-/), totalWarning: false },
    change: async page => page.evaluate(() => [...document.querySelectorAll(".part-products[data-target=Rough_Valve_PAS]")].find(p => p.getAttribute("data-modalno") === "R60000-UNBX").click()),
    afterChange: { parts: models("T60405-PC", "R60000-UNBX"), totalWarning: false } },
  { key: "brizo-5ltr", url: "https://www.brizo.com/bath/product/694767-BNXBL", settle: 7000,
    expect: { model: "694767-BNXBL", manual: false, ...anyPrice } }, // was a blank panel (an address part of 5+ letters)
  { key: "kohler-kit", url: "https://www.kohler.com/en/products/showers/shop-shower-heads/statement-bndl-k0059?skuId=BNDL-K0059", settle: 9000,
    expect: { parts: models(/^26290-/, /^26318-/), totalWarning: false },
    change: async page => page.evaluate(() => document.querySelector('#finish-type-list input[aria-label="Vibrant Titanium"]').click()),
    afterChange: { parts: models("26290-TT", "26318-TT"), totalWarning: false } },
  { key: "delta-kit", url: "https://www.deltafaucet.com/bathroom/product/FVS6-LI0201.html", settle: 7000,
    expect: { parts: ps => ps.length === 6, totalWarning: false },
    change: async page => page.evaluate(() => [...document.querySelectorAll("button.product-attribute__swatch")].find(s => /Matte Black/i.test(s.title || "")).click()),
    afterChange: { parts: ps => ps.length === 6 && ps.every(p => /BL/.test(p.model)), totalWarning: false } },
  { key: "delta-reclick", url: "https://www.deltafaucet.com/kitchen/product/9190TL-DST.html", settle: 6000,
    expect: { model: "9190TL-DST", ...anyPrice },
    change: async page => page.evaluate(() => document.querySelector("button.product-attribute__swatch.selected").click()),
    afterChange: { model: "", manual: true } }, // the page shows "Master-9190TL-DST" with no finish picked
  { key: "grohe-rough", url: "https://www.grohe.us/products/dual-function-thermostatic-valve-trim-9?variant=51098896630073", settle: 7000,
    expect: { parts: all(models("29137000", "35601000"), ps => ps[1].type === "ROUGH") } },
  { key: "toto-addon", url: "https://www.totousa.com/nexus-two-piece-toilet-128-gpf-elongated-bowl", settle: 6000,
    expect: { model: /^MS442124CEFG/, ...anyPrice },
    change: async page => page.evaluate(() => [...document.querySelectorAll("fieldset.extras label[for]")].find(l => /14″/.test(l.textContent)).click()),
    afterChange: { parts: models(/^MS442124CEFG/, "TSU10W.14R"), totalWarning: false } },
  { key: "toto-note", url: "https://www.totousa.com/gb-freestanding-tub-filler", settle: 6000, expect: { note: /TBN01105U/ } },
  { key: "flusso-note", url: "https://www.flussofaucets.com/products/2404201TSB-trim-for-34-thermostatic-valve-use-with-tvh4201", settle: 6000,
    expect: { note: /TVH\.4201/, type: "TUB / SHOWER FAUCET" } },
  { key: "bain-kit", url: "https://www.bainultra.com/products/amma-6030", settle: 9000,
    expect: { parts: models(/^BAMBRA0/, /^BOVER/), totalWarning: false },
    change: async page => page.evaluate(() => document.querySelector("article.bu-configurator__option-card[data-option-sku=BDRCB] button").click()),
    afterChange: { parts: ps => ps.length === 3 && ps[2].model === "BDRCB", totalWarning: false } },
  { key: "sofia-kit", url: "http://shop.sofiamedicinecabinets.com/artemis-collection-cabinets.php?h=30&d=d1",
    prepare: async page => {
      await page.selectOption("select[name=model_number]", "ART 1530 1D");
      await page.waitForTimeout(1500);
      await page.selectOption("select[name=depth]", "5 3/16 DEPTH");
      await page.waitForTimeout(1500);
      for (const sel of ["input[name=ls][value='3/4 Bevel']", "input[name=interior_design][value=White]", "input[name='LGT-30']"]) {
        await page.evaluate(s => document.querySelector(s).click(), sel);
        await page.waitForTimeout(1200);
      }
    },
    expect: { parts: all(models("ART 1530 1D-1", "LGT-30"), ps => ps[1].type === "LIGHT") },
    change: async page => page.evaluate(() => document.querySelector("input[name=msk]").click()),
    afterChange: { parts: ps => ps.some(p => p.model === "MSK 4-30" && p.type === "SURFACE MOUNT SIDE KIT") } },
  { key: "boos-addon", url: "https://www.johnboos.com/products/aa-maple-butcher-block-with-16-thick-end-grain-top", settle: 6000,
    expect: { model: "AA01", ...anyPrice },
    change: async page => page.evaluate(() => document.querySelector("#product-add-on-checkbox").click()),
    afterChange: { parts: models("AA01", "MYSCRMAPP"), totalWarning: false } },
  { key: "fleurco-tub", url: "https://fleurco.com/bathtubs/tonnetz-petite", settle: 6000,
    prepare: async page => {
      await page.evaluate(() => jQuery(document.getElementById("drpDrain1")).val("19").change());
      await page.waitForTimeout(1800);
      await page.evaluate(() => { const r = document.querySelector('input[name="rdoDrainCover"][value="TUBDRAINCOVER-33"]'); if (r) (r.closest("label") || r).click(); });
      await page.waitForTimeout(1800);
    },
    expect: { parts: ps => ps.length >= 2 && ps[0].type === "BATH TUB" && ps.every(p => Number(p.price) > 0), totalWarning: false } },
  { key: "cm-notmade", url: "https://craftandmain.com/collections/all-shower-doors-1/products/craft-main%C2%AE-marina%C2%AE-frameless-hinged-shower-door", settle: 6000,
    expect: { model: /^MRHG\d+-CL-BN$/ },
    change: async page => page.evaluate(() => { const r = document.querySelector('input[name="Glass"][value="Grid"]'); (r.closest("label") || r).click(); }),
    afterChange: { model: "", manual: true } }, // Grid glass is made in Matte Black only
  { key: "sb-line", url: "https://strategicbrandsincorporated.com/86514/128mm-kensington-pull-polished-nickel", settle: 6000,
    expect: { line: /laurey/i, color: "Polished Nickel" } },
  { key: "sb-orb", url: "https://strategicbrandsincorporated.com/59907/10-pc-item-54666-1-3-8-hollow-steel-knob-orb-value-pack", settle: 6000,
    expect: { color: "Oil Rubbed Bronze" } },
  { key: "franke-code", url: "https://www.franke.com/us/en/home-solutions/products/kitchen-faucets/product-detail-page.html/115.0740.013.html", settle: 6000,
    expect: { model: /^LAR-PD-[A-Z]+$/, type: "KITCHEN FAUCET" } },
  { key: "elkay-kit", url: "https://www.elkay.com/products/sinks/collections/kits/ectru30179rtc", settle: 6000,
    expect: { model: "ECTRU30179RTC", type: "KITCHEN SINK", ...anyPrice } },
  { key: "avance", url: "https://www.avancecabinetry.com/cabinetry/benton/benton-bourbon",
    expect: { model: "", manual: true, lineShown: false } }, // one Avance line since 11/5 (Avance Cabinetry is no longer special-order)
];

const results = [];
const record = (vendor, ok, what) => {
  results.push({ vendor, ok, what });
  console.log(`${ok ? "PASS" : "FAIL"}  ${vendor.padEnd(12)} ${what}`);
};

function compare(actual, expect) {
  const bad = [];
  for (const [k, want] of Object.entries(expect)) {
    const got = actual[k];
    const ok = typeof want === "function" ? want(got) : want instanceof RegExp ? want.test(String(got)) : got === want;
    if (!ok) bad.push(`${k}: got ${JSON.stringify(got)}, want ${want instanceof RegExp || typeof want === "function" ? String(want) : JSON.stringify(want)}`);
  }
  return bad;
}

async function readPanel(page) {
  const p = page.locator("[data-consumers-quote-helper]").locator(".panel");
  return {
    name: await p.locator(".prod .name").innerText(),
    model: await p.locator(".model").inputValue(),
    color: await p.locator(".color").inputValue(),
    price: await p.locator(".price").inputValue(),
    collDesc: await p.locator(".description").inputValue(), // one Collection / Description field since 1.4.1
    description: await p.locator(".description").inputValue(),
    type: await p.locator(".type").evaluate(s => (s.value && s.selectedOptions[0] ? s.selectedOptions[0].textContent : "")),
    options: await p.locator(".variant option").count(),
    lineShown: await p.locator(".line-wrap").isVisible(),
    manual: await p.locator(".manual-hint").isVisible(),
    optionsShown: await p.locator(".variant-wrap").isVisible(),
    header: await p.locator(".head").evaluate(h => getComputedStyle(h).backgroundImage),
    // 1.5.5: a kit's part blocks, the total check and the Add button's wording.
    parts: await p.locator(".part").evaluateAll(boxes => boxes.map(b => {
      const v = s => b.querySelector(s).value;
      const t = b.querySelector(".ptype");
      return { model: v(".pmodel"), color: v(".pcolor"), collDesc: v(".pdesc"), description: v(".pdesc"), price: v(".pprice"),
        type: t.value && t.selectedOptions[0] ? t.selectedOptions[0].textContent : "" };
    })),
    totalWarning: await p.locator(".kit-total-hint").isVisible(),
    button: (await p.locator(".add").innerText()).trim(),
    // 1.5.6: the kit or "sold separately" note, and the chosen product line.
    note: (await p.locator(".kit-hint").isVisible()) ? (await p.locator(".kit-hint").innerText()).trim() : "",
    line: await p.locator(".line").evaluate(s => (s.value && s.selectedOptions[0] ? s.selectedOptions[0].textContent : "")),
  };
}

(async () => {
  const headed = process.argv.includes("--headed");
  const only = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const vendors = only.length ? VENDORS.filter(v => only.includes(v.key)) : VENDORS;
  fs.mkdirSync(SHOTS, { recursive: true });
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "cqh-live-")), {
    channel: "chromium", headless: !headed, viewport: { width: 1400, height: 900 }, userAgent: UA, locale: "en-US",
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, "--disable-blink-features=AutomationControlled"],
  });
  await ctx.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => undefined }));
  try {
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker", { timeout: 15000 });
    const version = await sw.evaluate(() => chrome.runtime.getManifest().version);
    console.log(`Consumers QuickAdd ${version}, ${vendors.length} vendor page(s)\n`);

    // 1.5.0 (Gib 11/5, "still missing Type"): before any Product Selector tab has sent the vendor sites, the bundled
    // PROD list (seed-sites.js) still gives the panel its Types. Also the 1.5.0 button and header wording.
    {
      const first = await ctx.newPage();
      try {
        await first.goto(VENDORS.find(v => v.key === "delta").url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await first.waitForTimeout(4000);
        const fab = first.locator("[data-consumers-quote-helper]").locator(".fab");
        await fab.waitFor({ state: "visible", timeout: 20000 });
        const fabText = (await fab.innerText()).trim();
        await fab.click();
        const p = first.locator("[data-consumers-quote-helper]").locator(".panel");
        await p.waitFor({ state: "visible", timeout: 10000 });
        await first.waitForTimeout(500);
        const typeShown = await p.locator(".type-wrap").isVisible();
        const type = await p.locator(".type").evaluate(s => (s.value && s.selectedOptions[0] ? s.selectedOptions[0].textContent : ""));
        const head = (await p.locator(".head b").innerText()).trim(), sub = (await p.locator(".head small").innerText()).trim();
        const wording = fabText === "Add to CPS Quote List" && head === "Add to CPS Quote List" && sub === "Confirm all fields are correct before adding";
        record("seed", typeShown && type === "KITCHEN FAUCET", `before the Product Selector is opened: Type ${typeShown ? type || "(none chosen)" : "hidden"}`);
        record("wording", wording, `button "${fabText}", header "${head}" / "${sub}"`);
        await first.screenshot({ path: path.join(SHOTS, "seed-delta.png") });
      } catch (e) {
        record("seed", false, `error: ${String(e.message || e).split("\n")[0]}`);
      } finally {
        await first.close();
      }
    }

    // The Product Selector's page hands the extension the vendor sites and their Types, as the signed-in app does.
    const app = await ctx.newPage();
    await app.goto(APP, { waitUntil: "domcontentloaded", timeout: 60000 });
    await app.waitForTimeout(2000);
    await app.evaluate(sites => window.postMessage({ source: "consumers-product-selector", type: "vendor-sites", sites }, location.origin), SITES);
    await app.waitForTimeout(1500);
    const stored = await sw.evaluate(() => chrome.storage.local.get("siteLines").then(s => Object.keys(s.siteLines || {}).length));
    // record("setup", stored === 16, `vendor sites with Types in the extension: ${stored} domains`);
    // 1.5.3: as many domains as the fixture has (18 on 11/5: Bain Ultra, Grohe and Sofia in, Neptune out).
    const X = require("../consumers-quote-helper/extract.js");
    const wantDomains = new Set(SITES.map(s => X.registrableDomain(new URL(s.websiteUrl).hostname))).size;
    record("setup", stored === wantDomains, `vendor sites with Types in the extension: ${stored} domains (fixture: ${wantDomains})`);

    const page = await ctx.newPage();
    const added = [];
    for (const v of vendors) {
      try {
        // 1.5.3: a panel left open reopens on the next page of the same site (a finish that is its own page); each check
        // starts from a closed panel.
        await page.locator("[data-consumers-quote-helper]").locator(".x").click({ timeout: 2000 }).catch(() => {});
        await page.goto(v.url, { waitUntil: "domcontentloaded", timeout: 60000 });
        // await page.waitForTimeout(4000);
        await page.waitForTimeout(v.settle || 4000);
        const blocked = await page.evaluate(() => /captcha|are you a human|access denied|verify you are/i.test((document.body && document.body.innerText || "").slice(0, 3000)));
        if (blocked) { record(v.key, false, "the site showed a bot check"); continue; }
        if (v.prepare) await v.prepare(page);
        const fab = page.locator("[data-consumers-quote-helper]").locator(".fab");
        const panel = page.locator("[data-consumers-quote-helper]").locator(".panel");
        // await fab.waitFor({ state: "visible", timeout: 20000 });
        // await fab.click();
        if (!(await panel.isVisible().catch(() => false))) {
          await fab.waitFor({ state: "visible", timeout: 20000 });
          await fab.click();
        }
        await panel.waitFor({ state: "visible", timeout: 10000 });
        await page.waitForTimeout(500);
        let got = await readPanel(page);
        let bad = compare(got, v.expect);
        // record(v.key, bad.length === 0, bad.length ? bad.join("; ") : `${got.model} | ${got.color || "-"} | $${got.price || "-"} | ${(got.collDesc || "-").slice(0, 45)} | ${got.type || "-"}`);
        const summary = got.parts.length // 1.5.5: a kit lists its parts
          ? `${got.parts.length} parts: ${got.parts.map(x => `${x.model} ${x.type} ${x.color} $${x.price}`).join(" + ")}`
          : `${got.model} | ${got.color || "-"} | $${got.price || "-"} | ${(got.collDesc || "-").slice(0, 45)} | ${got.type || "-"}`;
        record(v.key, bad.length === 0, bad.length ? bad.join("; ") + (got.parts.length ? ` (${summary})` : "") : summary);
        await page.screenshot({ path: path.join(SHOTS, `${v.key}.png`) });
        if (v.change) {
          await v.change(page);
          // await page.waitForTimeout(3000);
          // 1.4.2 (Gib 11/5): the panel stays open, greyed out with a spinner, while it re-reads the page.
          const busy = panel.locator(".busy");
          const spun = await busy.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
          if (spun) await page.screenshot({ path: path.join(SHOTS, `${v.key}-updating.png`) });
          const settled = await busy.waitFor({ state: "hidden", timeout: 10000 }).then(() => true, () => false);
          record(v.key, spun && settled && await panel.isVisible(), `while it updates: panel open, ${spun ? "spinner shown" : "NO spinner"}, ${settled ? "then cleared" : "still spinning after 10 s"}`);
          await page.waitForTimeout(300);
          got = await readPanel(page);
          bad = compare(got, v.afterChange);
          record(v.key, bad.length === 0 && await panel.isVisible(), `after the change, panel open: ${bad.length ? bad.join("; ") : `${got.model} | ${got.color} | $${got.price}`}`);
          await page.screenshot({ path: path.join(SHOTS, `${v.key}-changed.png`) });
        }
        if (v.add) {
          // 1.5.2 (Gib 11/5): all fields are required. A field the page left empty must be refused and outlined first.
          if (v.fill) {
            // 1.5.3: the panel now fills these itself, so they are emptied first, as a customer could.
            for (const sel of Object.keys(v.fill)) {
              const field = panel.locator(sel);
              if (await field.evaluate(e => e.tagName === "SELECT")) await field.selectOption({ index: 0 });
              else await field.fill("");
            }
            await panel.locator(".add").click();
            await page.waitForTimeout(300);
            const err = await panel.locator(".msg.err").innerText().catch(() => "");
            const flagged = await panel.locator(".missing").count();
            record(v.key, /Please fill in/.test(err) && flagged >= 1, `empty field refused (${flagged} outlined): "${err}"`);
            await page.screenshot({ path: path.join(SHOTS, `${v.key}-refused.png`) });
            // for (const [sel, val] of Object.entries(v.fill)) await panel.locator(sel).fill(val);
            for (const [sel, val] of Object.entries(v.fill)) {
              const field = panel.locator(sel);
              if (await field.evaluate(e => e.tagName === "SELECT")) await field.selectOption({ label: val });
              else await field.fill(val);
            }
          }
          await panel.locator(".add").click();
          await panel.locator(".msg.ok").waitFor({ timeout: 10000 });
          // added.push({ key: v.key, model: got.model, type: got.type, collDesc: got.collDesc });
          if (got.parts.length) for (const x of got.parts) added.push({ key: `${v.key} part`, model: x.model, type: x.type, collDesc: x.collDesc });
          else added.push({ key: v.key, model: got.model, type: got.type, collDesc: got.collDesc });
        }
      } catch (e) {
        record(v.key, false, `error: ${String(e.message || e).split("\n")[0]}`);
        await page.screenshot({ path: path.join(SHOTS, `${v.key}-error.png`) }).catch(() => {});
      }
    }

    // The picks reach the Product Selector's page with the special-order fields.
    if (added.length) {
      await app.bringToFront();
      await app.evaluate(() => {
        window.__fromExt = [];
        window.addEventListener("message", e => { if (e.data && e.data.source === "consumers-quote-helper") window.__fromExt.push(e.data); });
        window.postMessage({ source: "consumers-product-selector", type: "request-picks" }, location.origin);
      });
      await app.waitForTimeout(2000);
      const msgs = await app.evaluate(() => window.__fromExt);
      const picks = (msgs.filter(m => m.type === "vendor-picks").pop() || { picks: [] }).picks;
      for (const a of added) {
        const p = picks.find(x => x.model === a.model);
        const ok = !!p && (!a.type || p.typeName === a.type) && p.description === a.collDesc && !!p.description;
        record("hand-off", ok, `${a.key}: ${p ? `${p.model}, Type ${p.typeName || "-"}, Coll/Desc ${p.description.slice(0, 50)}` : "not delivered"}`);
      }
    }
  } finally {
    await ctx.close();
  }
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exitCode = failed.length ? 1 : 0;
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
