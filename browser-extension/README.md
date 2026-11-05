# Consumers Quote Helper (Edge and Chrome extension)

Lets a customer pick products on a vendor's own website (Delta, Kohler, Brizo, ...) and sends them to the Consumers Product Selector, where the sales rep turns each one into a special order on the quote list.

## How it works

1. **Open a vendor site.** In the Product Selector, go to **Special Order** and pick a category. Then click a product line card ("Shop vendor site"); it opens the vendor's website, as the PRD page links it (`custrecord_pl_prd_website`), in a new tab.
2. **Add a product.** On every page of a vendor site the extension shows an **Add to Consumers Quote** button.
   - On a product page it fills in the model, name, color and price, and each color or finish as an option (for example Kohler's 6 Cairn colors). See "What it reads" below.
   - On a page with nothing to read, the panel opens with the page's name and a blank Model, and says so; the customer types the model and color shown on the page.
   - The panel has the special-order fields (1.3.0): **Type** (the product line's NetSuite Types, the best fit preselected from the product name and the vendor's breadcrumbs), **Model**, **Color / finish**, **Collection / Description** (one field, as NetSuite's Coll/Desc: "Altado Two Handle Widespread Bathroom Faucet"), **Price on this site** and **Quantity**. A vendor site with several product lines (Foremost) also asks for the **Product line**. The Types come from the Product Selector, so open it once after installing; until then the Type is left to the rep.
   - The panel follows the page the same way on every site (1.4.0): picking another finish or color while it is open refreshes the model, finish and price and keeps the quantity. Delta (the shown MODEL#) and Kohler (the shown SKU) have their own rules; an Option list appears only when a page does not say which color is chosen.
   - When a page gives no color, a finish at the end of the product name is used ("128mm Austin Pull - Satin Nickel", "...Brushed Satin Nickel"). Strategic Brands' collection comes from its "parts in this collection" link.
   - Collection / Description goes to NetSuite's Coll/Desc as is. It starts as the collection, then the product name, the way reps type it; the collection is left out when the name already has it.
   - The customer picks the option, sets the quantity and clicks **Add to quote**.
3. **It lands on the Quote List.** When the Product Selector is open (signed in) in that browser, each pick goes straight onto the Quote List as a special-order line, and leaves the extension.
   - Model, description, color, list price and quantity come from the vendor page, with a **Picked on** link back to it. The Type is guessed from the product name and the vendor's address (KITCHEN FAUCET, TOILET, KNOBS, SHOWER DOOR); on a tie, or for order-form Types, it is left for the rep.
   - A line the vendor page left incomplete shows an amber **Needs Type, Color, List price** (whatever is missing). Clicking it opens the Edit Special Order form; fill in the rest and click **Save Changes**. The Quote List will not push to an estimate until every line is complete.
   - The selling price is calculated as usual (list price x the product line's multipliers). Check the list price: a vendor site can show a sale price.
   - A pick whose vendor site has several product lines (Foremost: craftandmain.com) or none waits on the Special Order page under **Picked on vendor websites**: **Use** fills in the Add Special Order form, the rep picks the product line and Type and clicks **Add to List**; **Remove** drops it.

What the extension holds and where it runs:
- **Storage.** Picks stay in the extension's storage in that browser until the Product Selector takes them. Nothing goes to NetSuite until the rep adds the item and pushes the quote list as usual.
- **Vendor sites.** The extension runs only on the vendor domains of the special-order product lines. The Product Selector sends that list whenever it is open, so a product line added in NetSuite (with a website) is picked up automatically. Until then, the 16 domains from 2026-11-04 are built in.
- **Other sites.** On any other site the extension does nothing.

**Price check:** a vendor site can show a sale price. Delta's Outlet / Recertified items, for example, show $215 instead of the $449 list. The rep always confirms the list price.

## What it reads

The helper reads the page when it loads and again each time the button is clicked (configurators and option pickers change the page without loading a new one). In this order, stopping at the first that gives a product:
0. **A site rule** for sites that need their own (`SITE_RULES` in `vendor.js`): Fleurco's configurator.
1. **schema.org JSON-LD** `Product` / `ProductGroup` (each variant becomes an option). A barcode in `mpn` (Flusso's UPC) is skipped for the model in `sku`.
2. **schema.org microdata** (`itemtype=".../Product"`), only when there is no JSON-LD product.
3. **Open Graph** product tags (`og:type` product, `product:price:amount`).
4. **The page text around its heading** (the first visible `h1`):
   - a model label next to the name: `Model#:`, `Model number`, `SKU:`, `Item Number`, `Part Number`, `Article Number` (the value must contain a digit);
   - else a model at the end of the address (`/product/T66T030-PC`), on a page that shows a price or calls itself a product;
   - the first `$` price within 400 characters after the heading (add-on prices like `+$54.00` are skipped).

Steps 1 to 3 are completed from step 4 when they leave the model or price out (TOTO, Top Knobs, Neptune's full model number).

Checked on 11/4/2026 in Chrome, one product page per product line:

| Vendor | Model | Price | Read from |
|---|---|---|---|
| Craft & Main | yes | yes | JSON-LD |
| Delta | yes | yes | JSON-LD |
| Flusso | yes | yes | JSON-LD (sku, not the UPC in mpn) |
| Kohler | yes, per color | yes | JSON-LD ProductGroup |
| Neptune | yes, full model number | yes | JSON-LD + page text |
| Richelieu | yes | no (dealer price) | JSON-LD |
| Top Knobs | yes | yes | microdata + Open Graph |
| TOTO | yes (`CST776CEG#01`) | yes | Open Graph + page text |
| Brizo | yes | yes | address + page text |
| Elkay | yes | no ("Show List Price" button) | address |
| John Boos | yes | yes | page text |
| Icera | yes | yes | page text |
| Strategic Brands | yes | no (sign-in) | page text |
| Franke | Article Number (`115.0731.726`) | no | page text |
| Fleurco | yes (`NHS160-25-40R-79`), once every configurator choice is made, Mix & Match Kit included | yes | site rule (the total under the options) |
| Avance | no: door-style pages only | no | customer types it |

When a vendor redesigns its site, open one of its product pages and check the panel; the unit tests hold one fixture per page shape.

## Staff download (Product Selector)

Signed-in staff get it from the Product Selector: click your name (top right) and choose **Quote Helper**, or the **Get the Quote Helper** link on the Special Order page.
- The page says whether this browser has the extension and whether it is out of date, has a **Download** button and the install and update steps for Edge and Chrome.
- The API server zips `browser-extension/consumers-quote-helper` on request (`GET /api/quote-helper/download`, signed-in employees only; `GET /api/quote-helper` gives the version). So a merged change to the extension reaches staff with the next Republish of the Repl; bump `version` in `manifest.json` so the page tells older installs to update.

## Install (Load unpacked)

You need the `consumers-quote-helper` folder (from the staff download, from this repo, or unzipped from `consumers-quote-helper-<version>.zip`). Keep it where it will stay: the browser loads the extension from that folder.

**Microsoft Edge**
1. Go to `edge://extensions`.
2. Turn on **Developer mode** (left side).
3. Click **Load unpacked** and choose the `consumers-quote-helper` folder.
4. Optional: click the puzzle icon in the toolbar and pin **Consumers Quote Helper**.

**Google Chrome**
1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `consumers-quote-helper` folder.

When installing, the browser warns that the extension can "read and change data on websites". That permission lets it run on whichever vendor sites the Product Selector lists. In practice it only runs on those vendor domains and the Product Selector.

After the first install, open the Product Selector once (signed in), so the extension gets the current vendor list.

## Rolling out to showroom PCs

- **Recommended:** publish it as an unlisted extension on **Microsoft Edge Add-ons** (Partner Center) and, if needed, the **Chrome Web Store**.
  - The browsers then update it automatically.
  - IT can force-install it with the Edge `ExtensionInstallForcelist` policy, through Intune or Group Policy.
- **Quick option (today):** staff download it from the Product Selector and Load unpacked on each PC, as above. Edge may show a "developer mode extensions" reminder. To update, download again, extract over the folder and click **Reload** on `edge://extensions`.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Manifest V3 (Chrome 111+ / Edge 111+) |
| `background.js` | Holds picks, keeps the vendor domain list, runs `vendor.js` only on those domains |
| `extract.js` | Reads a page's product data (JSON-LD, microdata, Open Graph, then the text around the heading); pure, unit tested |
| `vendor.js` | The "Add to Consumers Quote" button and panel on vendor pages (shadow DOM, house colors) |
| `app.js` | Bridge on the Product Selector's pages: passes picks and the vendor list via `window.postMessage` |
| `popup.html` / `popup.js` | Toolbar popup: items waiting and the vendor sites |
| `icons/` | The Product Selector's favicon (the orange shopping bag), sized by `make-icons.py` (Pillow); rerun it when the favicon changes. `make-icons.cjs` drew the 1.0 navy icons and is kept for reference. |

The Product Selector side is in `artifacts/product-selector/src/lib/vendor-picks.ts` (message protocol, validation), `context/vendor-picks-context.tsx`, `components/vendor-picks-panel.tsx` and `pages/special-order.tsx`.

The extension runs on these origins: `consumers-product-selector.replit.app`, `consumersstore.com` and the Repl's dev URL. If the app moves, update `manifest.json` (`content_scripts.matches`) and `APP_ORIGINS` in `background.js`, then bump `version`.

## Tests

Unit tests of the page reader (one fixture per vendor page shape):

```bash
node --test browser-extension/test/extract.test.cjs
```

The app side runs from `artifacts/api-server`:

```bash
node --import tsx --test ../product-selector/src/lib/vendor-picks.test.ts
```

**Live check on the real vendor sites** (`test/live-vendors.cjs`): it loads this extension in a throwaway Chromium profile and opens one real product page per vendor (all 16). For each page it reads the panel and checks the model, finish, collection, Type and whether a price is shown. It also changes Delta's finish with the panel open and walks Fleurco's configurator. Last, it adds three picks and checks they reach the Product Selector's page with their fields. Nothing is ordered or sent to a vendor or to NetSuite. Run it after changing the extension, and every so often to catch a vendor redesign:

```bash
PLAYWRIGHT=C:/Users/gspiteri1/Desktop/Git/Bundle63418/Projects/SrrUiTests node browser-extension/test/live-vendors.cjs
```

- Add `--headed` to watch it, or name vendors to run only those (`delta fleurco`).
- Screenshots of each panel land in `browser-extension/test/live-shots/`.
- The Types it hands the extension are in `test/vendor-sites.json`, read from PROD NetSuite on 2026-11-04.
- Prices are only checked for being there or not, since vendors change them.
