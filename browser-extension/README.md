# Consumers Quote Helper (Edge and Chrome extension)

Lets a customer pick products on a vendor's own website (Delta, Kohler, Brizo, ...) and sends them to the Consumers Product Selector, where the sales rep turns each one into a special order on the quote list.

## How it works

1. **Open a vendor site.** In the Product Selector, go to **Special Order** and pick a category. Then click a product line card ("Shop vendor site"); it opens the vendor's website, as the PRD page links it (`custrecord_pl_prd_website`), in a new tab.
2. **Add a product.** On a vendor product page the extension shows an **Add to Consumers Quote** button.
   - It reads the page's own product data: model, name, color and price, and each color or finish as an option (for example Kohler's 6 Cairn colors).
   - The customer picks the option, sets the quantity and clicks **Add to quote**.
3. **Finish it in the Product Selector.** The Special Order menu item shows a count, and the **Picked on vendor websites** list sits at the top of the Special Order page.
   - **Use** fills in the Add Special Order form: product line, model, description, color, list price and quantity.
   - The rep picks the **Type**, checks the list price and clicks **Add to List**. The selling price is calculated as usual (list price x the product line's multipliers).
   - **Remove** drops a pick.

What the extension holds and where it runs:
- **Storage.** Picks stay in the extension's storage in that browser until the Product Selector takes them. Nothing goes to NetSuite until the rep adds the item and pushes the quote list as usual.
- **Vendor sites.** The extension runs only on the vendor domains of the special-order product lines. The Product Selector sends that list whenever it is open, so a product line added in NetSuite (with a website) is picked up automatically. Until then, the 16 domains from 2026-11-04 are built in.
- **Other sites.** On any other site the extension does nothing.

**Price check:** a vendor site can show a sale price. Delta's Outlet / Recertified items, for example, show $215 instead of the $449 list. The rep always confirms the list price.

## Install for testing (Load unpacked)

You need the `consumers-quote-helper` folder (in this repo, or unzipped from `consumers-quote-helper-<version>.zip`).

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
- **Quick option:** Load unpacked on each PC, as above. Edge may show a "developer mode extensions" reminder. To update, replace the folder and click **Reload** on `edge://extensions`.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Manifest V3 (Chrome 111+ / Edge 111+) |
| `background.js` | Holds picks, keeps the vendor domain list, runs `vendor.js` only on those domains |
| `extract.js` | Reads schema.org JSON-LD (then Open Graph) product data from a page; pure, unit tested |
| `vendor.js` | The "Add to Consumers Quote" button and panel on vendor pages (shadow DOM, house colors) |
| `app.js` | Bridge on the Product Selector's pages: passes picks and the vendor list via `window.postMessage` |
| `popup.html` / `popup.js` | Toolbar popup: items waiting and the vendor sites |
| `icons/` | Drawn by `make-icons.cjs` |

The Product Selector side is in `artifacts/product-selector/src/lib/vendor-picks.ts` (message protocol, validation), `context/vendor-picks-context.tsx`, `components/vendor-picks-panel.tsx` and `pages/special-order.tsx`.

The extension runs on these origins: `consumers-product-selector.replit.app`, `consumersstore.com` and the Repl's dev URL. If the app moves, update `manifest.json` (`content_scripts.matches`) and `APP_ORIGINS` in `background.js`, then bump `version`.

## Tests

```bash
node --test browser-extension/extract.test.cjs
```

The app side runs from `artifacts/api-server`:

```bash
node --import tsx --test ../product-selector/src/lib/vendor-picks.test.ts
```
