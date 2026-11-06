# Consumers QuickAdd (Edge and Chrome extension)

Called Consumers Quote Helper until 1.5.0. The folder, the zip and the Product Selector page address keep the old name (`consumers-quote-helper`, `/quote-helper`), so an update still extracts over the folder the browser already loads.

Lets a customer pick products on a vendor's own website (Delta, Kohler, Brizo, ...) and sends them to the Consumers Product Selector, where the sales rep turns each one into a special order on the quote list.

## How it works

1. **Open a vendor site.** In the Product Selector, go to **Special Order** and pick a category. Then click a product line card ("Shop vendor site"); it opens the vendor's website, as the PRD page links it (`custrecord_pl_prd_website`), in a new tab.
2. **Add a product.** On every page of a vendor site the extension shows an **Add to CPS Quote List** button (1.5.0; was Add to Consumers Quote). The panel header asks the customer to confirm all fields are correct before adding.
   - On a product page it fills in the model, name, color and price, and each color or finish as an option (for example Kohler's 6 Cairn colors). See "What it reads" below.
   - On a page with nothing to read, the panel opens with a blank Model and says so; the customer types the model and color shown on the page. Since 1.5.3 it also leaves Collection / Description and Type blank there (a category page's heading is not a product), except on a configurator (Fleurco, Sofia), whose own name it keeps.
   - A page that needs a choice first (an Elkay base model with finish tiles, Icera before a color, Top Knobs before a size and finish, Sofia before a model number and depth) shows no model or price yet and says what to pick (1.5.3).
   - A finish that is its own page (Brizo, Elkay, Franke, Flusso, Richelieu swatch links) loads a new page; the panel reopens on it with the same quantity (1.5.3).
   - A page that says the item is discontinued gets a note in the panel (1.5.3). Order-form Types (Bain Ultra's AIR TUB, SOAKER, WHIRLPOOL) are offered too, marked "(order form)", with a note that the rep attaches the vendor's order form; the push sends "Per Attached Order Form" for them.
   - The panel has the special-order fields (1.3.0): **Type** (the product line's NetSuite Types, the best fit preselected from the product name and the vendor's breadcrumbs), **Model**, **Color / finish**, **Collection / Description** (one field, as NetSuite's Coll/Desc: "Altado Two Handle Widespread Bathroom Faucet"), **Price on this site** and **Quantity**. A vendor site with several product lines (Foremost) also asks for the **Product line**. The Types come from the Product Selector; since 1.5.0 the extension also carries the PROD list (`seed-sites.js`, from 11/4/2026), so the Type shows before the Product Selector has been opened in that browser.
   - The panel follows the page the same way on every site (1.4.0): picking another finish or color while it is open refreshes the model, finish and price and keeps the quantity. Since 1.4.2 the panel stays open, greyed out with an "Updating..." spinner, from the moment the page changes until the new values are in. Delta (the shown MODEL#) and Kohler (the shown SKU) have their own rules; an Option list appears only when a page does not say which color is chosen.
   - When a page gives no color, a finish at the end of the product name is used ("128mm Austin Pull - Satin Nickel", "...Brushed Satin Nickel"). Strategic Brands' collection comes from its "parts in this collection" link.
   - Collection / Description goes to NetSuite's Coll/Desc as is. It starts as the collection, then the product name, the way reps type it; the collection is left out when the name already has it.
   - The customer picks the option, sets the quantity and clicks **Add to quote**. Every field is required (1.5.2): **Add to quote** outlines the empty ones in red and names them, so a page that gives no color (Icera, since the 1.5.3 color readers) or no price (Elkay, Franke, Richelieu, Strategic Brands) needs the customer, or the sales rep, to type it in.
   - **Kits (1.5.5, Gib 11/6):** a Fleurco build can be several items: "NHZ160-25-40-75 + ATAS2-3260 + DRAINABS-33 + NH-CONVKIT-11-MX Total : $3517" is the door, a base and its drain (from **Add a base**), and a Mix & Match Kit. NetSuite needs each as its own line at its own price, so the panel says "This is 4 items", shows one block per part (Type, Model, Color / finish, Collection / Description, Price) and one **Quantity of each**, and **Add 4 items to quote** puts them on the Quote List as four lines in one go. The prices come from the page (the door's own price, the kit's tile price, each added item's card) and add up to its total; if a part's price is changed so they no longer do, the panel says so. Each part's fields are required like a single item's ("Color / finish (part 3)"). Types: the door as before, a base SHOWER BASE, wall panels SHOWER WALL, a bathtub BATH TUB, a drain or kit MISCELLANEOUS.
   - **Kits on every vendor (1.5.6, sweep 2 of 11/6):** the same parts view for what the sweep found sold as one selection but ordered as several items, each priced from the page:

     | Vendor | Kit | Where each part's model and price come from |
     |---|---|---|
     | Brizo | combos ("--" addresses) and trims shown with their rough valve, handle kit, union or escutcheon | "Product(s) Shown" rows (row class says rough, handles, accessory) |
     | Kohler | bundles (BNDL-K0002 spout + handles, BNDL-K0059 shower head + arm) | the bundle's item list (SKU in the link or picture), prices load a moment after the page |
     | Delta | bundles (FVS6-LI0201: faucet, trim and 4 accessories) | each item's own page in the bundle's finish (the tiles only show ranges) |
     | Grohe | a trim and the rough-in it REQUIRES (29137000 + 35601000) | the REQUIRED box; a choice of several roughs (Essence) is a note instead |
     | TOTO | a toilet and its add-ons (14″ rough-in TSU10W.14R, trip lever, push button) | the page script's add-on list |
     | Bain Ultra | the tub, its drain & overflow kit and each option card (waste kit, AromaCloud, skirt) | the configurator's data; the drain kit is what is left of the total |
     | Fleurco | also bathtubs with drains and covers, base pages with a drain, Fibo walls with install kit and grip, spacers | the picked options' own codes and prices, the page's price list |
     | Sofia | a cabinet or mirror and its accessories (LGT-30 light, MSK side kit by depth, defogger, outlets, shelves) | each accessory's label ("MSK 4-30/MSK 6-30 $111 (-1) \| $138 (-2)") |
     | John Boos | an item and the add-on box (Care & Maintenance Pack MYSCRMAPP, Applicator) | the page's cart form |

     A part the item needs but that is sold separately (Grohe's required rough-in) shows ticked with "Add this part"; untick it when the customer already has one. Parts sold separately are not in the page's total check. Where the needed part is only named on the page (Flusso's "Use with TVH.4201" trims, TOTO's "Requires tub filler base rough-in TBN01105U", Kohler's "Items Required for Install"), the panel says which part to add from its own page.
     Not split, because they are one orderable SKU: Elkay "Sink Kits" (cheaper than their parts), Franke workcenter sinks, TOTO two-piece and WASHLET+ toilets, Icera two-piece toilets and vanity + top (one price for the pair), Flusso shower sets and valve-with-trim SKUs, Strategic Brands value packs, Craft & Main doors.
   - The panel's &#8644; button moves it to the other side of the page when it covers the page's own pickers (Richelieu's finish chips at 1440 px wide); the side is kept for that site.
3. **It lands on the Quote List.** When the Product Selector is open (signed in) in that browser, each pick goes straight onto the Quote List as a special-order line, and leaves the extension.
   - Model, description, color, list price and quantity come from the vendor page, with a **Picked on** link back to it. The Type is guessed from the product name and the vendor's address (KITCHEN FAUCET, TOILET, KNOBS, SHOWER DOOR); on a tie, or for order-form Types, it is left for the rep.
   - A line the vendor page left incomplete shows an amber **Needs Type, Color, List price** (whatever is missing). Clicking it opens the Edit Special Order form; fill in the rest and click **Save Changes**. The Quote List will not push to an estimate until every line is complete.
   - The selling price is calculated as usual (list price x the product line's multipliers). Check the list price: a vendor site can show a sale price.
   - A pick whose vendor site has several product lines (Foremost: craftandmain.com) or none waits on the Special Order page under **Picked on vendor websites**: **Use** fills in the Add Special Order form, the rep picks the product line and Type and clicks **Add to List**; **Remove** drops it.

What the extension holds and where it runs:
- **Storage.** Picks stay in the extension's storage in that browser until the Product Selector takes them. Nothing goes to NetSuite until the rep adds the item and pushes the quote list as usual.
- **Vendor sites.** The extension runs only on the vendor domains of the special-order product lines. The Product Selector sends that list whenever it is open, so a product line added in NetSuite (with a website) is picked up automatically. Until then, the 18 domains from PROD on 2026-11-05 are built in (`SEED_DOMAINS` in `background.js`, Types in `seed-sites.js`). On 11/5 Bain Ultra, Grohe and Sofia Medicine Cabinets became special-order lines and Neptune, Foremost Bath and Avance Cabinetry stopped being ones; the Product Selector picks such changes up on its own, the built-in list is refreshed with each release.
- **Other sites.** On any other site the extension does nothing.

**List price, not sale price (1.5.7, Gib 11/6: "Change the app to use the list price for items, not sales price"):** wherever a page shows a list or regular price next to a sale price, the panel takes the list price; a page with one price keeps it. This reverses the 11/5 Kohler decision. Per vendor:

| Vendor | List price read from |
|---|---|
| Kohler | "List Price $690.75" under "Current Price $518.06" (`.product-detail-page__list-value`); bundle items are scaled by the bundle's own list-to-sale ratio (their own pages fill prices in by script), so they add up to the bundle's list price |
| Delta | the struck-through list price on Outlet / Recertified items (since 1.5.3), now also for bundle items |
| Top Knobs | Magento's regular price (`oldPrice`) when an item is on special |
| John Boos | the variant's `compareAtPrice` when it is on sale, also for the add-on box |
| Grohe, TOTO, Brizo, Flusso, Elkay | already the list price ("List price", "MSRP LIST PRICE", "List price as shown", "List Price", "Show List Price") |
| Icera | WooCommerce prints the regular price first when an item is on sale |
| Fleurco, Bain Ultra, Sofia | one price per item |
| Richelieu, Strategic Brands, Franke, Craft & Main | no public price |

The panel's price field is now labeled **List price**, and the line under it reads "Confirm all Information Above" (Gib 11/6; was "Your Consumers sales rep confirms the list price and finishes this on your quote.").

**Report issue (1.5.7, Gib 11/6):** a **Report issue** link at the left of the panel's buttons opens a short form (what went wrong, an optional name). **Send report** posts it through the extension's background to the Product Selector's own Report Issue endpoint (`POST /api/cases`), which opens a NetSuite case for IT, so it works without signing in. The case carries the vendor page, what the panel read (fields or parts), the QuickAdd version and the browser; no customer details. If it cannot be sent, the panel says to use Report Issue at the bottom of any Product Selector page. Each case also emails Gib, Phil Peluso and Gordon Griswold ("Product Selector issue: <case #> - <issue>") through the NetSuite script `customscript_ps_issue_email_ue` (Case, after create, REST cases in Innovation & Technology; source in Bundle63418 `Projects/ProductSelectorIssueEmail/sdf_prod`); a failed email is logged and never blocks the case.

**Price check:** a vendor site can show a sale price. Delta's Outlet / Recertified items, for example, show $215 instead of the $449 list. The rep always confirms the list price. Since 1.5.3 the panel takes the list price where the page prints it next to a sale price (Delta's struck-through price, Grohe's "List price"; not Kohler, whose shown price Gib kept on 11/5) and no price from a range ("$680.00 - $1,061.00") or a "from" price.

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
| Neptune (not a special-order line since 11/4) | yes, full model number | yes | JSON-LD + page text |
| Richelieu | yes | no (dealer price) | JSON-LD |
| Top Knobs | yes | yes | microdata + Open Graph |
| TOTO | yes (`CST776CEG#01`) | yes | Open Graph + page text |
| Brizo | yes | yes | address + page text |
| Elkay | yes | no ("Show List Price" button) | address |
| John Boos | yes | yes | page text |
| Icera | yes | yes | page text |
| Strategic Brands | yes | no (sign-in) | page text |
| Franke | Article Number (`115.0731.726`) | no | page text |
| Fleurco | yes (`NHS160-25-40R-79`, `VP4836-12-40-79`), once every configurator choice is made, Mix & Match Kit included; an open panel follows each choice (1.5.2) | yes | site rule (the total under the options) |
| Avance | no: door-style pages only | no | customer types it |

**Color / finish** (1.5.3): from the product data where it has one (Delta, Kohler, Flusso, Neptune, Top Knobs), else a site rule in `vendor.js`: TOTO and Craft & Main "Color: Cotton" over the swatches, Brizo "Selected Finish: ...", Richelieu the "Finish:" option, Franke the "Product finish" spec row, Elkay the finish or "Material" spec row (Stainless Steel), John Boos the wood at the start of the name, Strategic Brands the end of the name, Fleurco the chosen hardware finish. Icera shows none. Picking another color on the page refreshes the open panel (TOTO: Ebony gives CST776EF#51 at its own price).

**Flusso** (1.5.3): the collection comes from the details row ("Collection | Serie 250"; a bare "Kitchen" is skipped), and a barcode with a dashed check digit in `mpn` ("716894070509-7") no longer beats the model in `sku` (K.1200CR).

**Flusso finish squares** (1.5.5, Gib 11/6: "Flusso Kitchen Faucets aren't working when we change the finish"): on pages like the Vasco kitchen faucet, a finish square (`li.finish-color-box`) changes the item without loading a page and leaves thin product data behind (name "K.1390MB", no finish, no price), so the panel showed the model alone. The panel now reads the page's own lines, which follow the square: "Model#:" (`.product-model-no-p`), the finish ("Matte Black (FAST SHIP FINISH)" gives Matte Black) and the list price (`#product-price-span`), with the heading as the name. Matte Black reads K.1390MB at $833, Crimson K.1390CR at $1058.

**Fleurco picture** (1.5.5): Fleurco has no `og:image`, and the panel showed a broken picture (the page's own address); it now shows the door's photo.

**Sweep 2 of 11/6/2026 (1.5.6).** Gib asked how the Flusso finish squares fell through the 11/5 sweep: its testers loaded each finish's own address instead of clicking the squares, and only the click changes the page in place. Sweep 2 had four testers click every kind of option control on all 17 vendor sites (Avance left out) with the panel open, about 180 product pages and 450 clicks, and look for kits. Besides the kits above it fixed:
- Delta: clicking the finish already chosen unselects it ("Model#: Master-9190TL-DST", no price); the panel now asks for a finish instead of keeping the old one with another price.
- Brizo: an address with a part of 5 or more letters (694767-BNXBL, 65368LF-PCLHP-ECO) gave an empty panel; Brizo is now read from "Product(s) Shown" on every product page.
- Flusso: a finish square left trims and valves without a Type (the breadcrumbs are now read); a pot filler was a TUB FILLER, a kitchen soap dispenser a BATH ACCESSORY.
- TOTO: Coll/Desc repeated the add-ons of the page's hidden products ("Rough-In 14″" four times).
- Bain Ultra: "Reversible (L/R)" tubs showed the configurator's code and total (Meridian 50 is BMEFRI00N-01, $2,300); a freestanding tub's name said "Freestanding" twice and had no Type.
- Fleurco: a drain left in the code line after a door change (not in the total) is dropped; a bathtub added to a tub door had "Left" as its color.
- Craft & Main: a size, color and glass combination that is not made kept the last SKU; the page's variant list now decides, and the panel asks for another combination.
- John Boos: the Color option (Alabaster, Caviar Black) instead of the wood; Laforza "Frame Only" is the stand, MISCELLANEOUS, not the cherry block.
- Sofia: pages with a Frame dropdown (Georgia, Pharos, Valentina, Olympia) now get the price for the picked frame; "$0" lines are skipped.
- Franke: model codes after a plain space ("Maris Lario Pull-Down Faucet LAR-PD-MBK" read "PD-MBK"); a sink reached from "All products" gets KITCHEN SINK.
- Elkay: "Sink Kit" pages get KITCHEN SINK; a discontinued finish shows the discontinued note.
- Strategic Brands: the product line from the brand in the page's shopping link (LAUREY, MNG); "ORB" is Oil Rubbed Bronze, "Brush Satin Nickel" Brushed Satin Nickel, a bare "Steel" is no finish.
- Types: tub fillers, valve and shower trims, shower bundles, "sink faucet" handles, towel bars with a backplate.
The live check now has a click-path case for each vendor (finish squares, tiles, add-on boxes, configurator options, bundles).

**Sweep of 11/5/2026 (1.5.3):** four testers went through about 230 product pages and 40 other pages on all 17 special-order vendor sites (Avance left out), with about 110 finish, color, size and configurator changes made while the panel was open. What it found is fixed by these site rules in `vendor.js` (each value they read also tells the open panel to follow a change):

| Vendor | Reads |
|---|---|
| Grohe (new) | the shown variant: `[data-product-sku]`, its "List price" (`[data-price-list=<variant>]`; the product data has 75% of list), the Finish swatch label, the collection above the title |
| Kohler | the price Kohler shows and the title, so an option that loads another product (Crue Touchless, a Verdera width) gets that product's own name and price. The price stays the sale price Kohler shows (Gib, 11/5: "Leave the Kohler price"); its "List Price" is not used |
| Delta | the struck-through list price on Outlet / Recertified items |
| Brizo | a combo's parts joined with " + " and its "List price as shown" |
| Icera | the WooCommerce SKU and variation price for the chosen color (two-piece SKUs whole: "C-3690.01, T-3690.01") |
| Bain Ultra (new) | the tub variant named by the pressed drain, colour, deck and technology tiles (BAMBRA0RT-02); the drain kit in Coll/Desc |
| Elkay | the chosen finish tile (not "Material"), the list price behind "Show List Price", the "Room" row for the Type |
| TOTO | the SKU's own price (the page adds checked add-ons); the add-ons (Rough-In, Trip Lever) in Coll/Desc; "Made to Order (MTO)" dropped |
| Franke | the model code that ends the title (MAG11031OW-SHG), as reps enter Franke, not the Article Number |
| Top Knobs | nothing until a size and finish are picked, then the item number, the price box (not the family's lowest og price), the Finish and Collection rows |
| Richelieu | only the product's own number (`#pm2_topInfo`), the Finish option or spec row, the size in Coll/Desc |
| Strategic Brands | the finish part of the name (not a size), the collection from its own link, LAUREY or MNG preselected from the breadcrumbs |
| John Boos | the title (the og:title is an SEO title), the wood from the description when the title has none |
| Craft & Main | the shown variant SKU (the product data keeps the first); no price (hidden on the site) |
| Fleurco | the whole code before "Total" (door + kit / drain), nothing while a shown finish has no choice, the finish or material outside doors, the subtitle (Tub enclosure). Since 1.5.5 a build of several items is split into its parts, see Kits above |
| Flusso | as before, plus no "Universal Fixtures" collection and image addresses without a scheme |
| Sofia (new) | the shop's model number plus depth code (ART 2430 1D-1), the price line for the chosen depth and edge, the edge and interior or frame finish; also on plain http |

The Type rules got hand showers, shower heads and rainheads, bath accessories, lavatories, prep faucets, tub enclosures and tub shower doors, ignore parts named after a fixture (a toilet seat), score only the main part of the name, and break ties toward the main noun that comes last (1.5.2 got 16 of 34 sweep cases wrong or blank, 1.5.3 none). The testers' reports are kept with the sweep (outside the repo).

When a vendor redesigns its site, open one of its product pages and check the panel; the unit tests hold one fixture per page shape.

## Staff download (Product Selector)

Signed-in staff get it from the Product Selector: click your name (top right) and choose **QuickAdd**, or the **Get Consumers QuickAdd** link on the Special Order page.
- The page says whether this browser has the extension and whether it is out of date, has a **Download** button and the install and update steps for Edge and Chrome.
- The API server zips `browser-extension/consumers-quote-helper` on request (`GET /api/quote-helper/download`, signed-in employees only; `GET /api/quote-helper` gives the version). So a merged change to the extension reaches staff with the next Republish of the Repl; bump `version` in `manifest.json` so the page tells older installs to update.

## Install (Load unpacked)

You need the `consumers-quote-helper` folder (from the staff download, from this repo, or unzipped from `consumers-quote-helper-<version>.zip`). Keep it where it will stay: the browser loads the extension from that folder.

**Microsoft Edge**
1. Go to `edge://extensions`.
2. Turn on **Developer mode** (left side).
3. Click **Load unpacked** and choose the `consumers-quote-helper` folder.
4. Optional: click the puzzle icon in the toolbar and pin **Consumers QuickAdd**.

**Google Chrome**
1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `consumers-quote-helper` folder.

When installing, the browser warns that the extension can "read and change data on websites". That permission lets it run on whichever vendor sites the Product Selector lists. In practice it only runs on those vendor domains and the Product Selector.

After the first install, open the Product Selector once (signed in), so the extension gets the current vendor list.

## Rolling out to showroom PCs

<!-- Until 11/5/2026:
- **Recommended:** publish it as an unlisted extension on **Microsoft Edge Add-ons** (Partner Center) and, if needed, the **Chrome Web Store**.
  - The browsers then update it automatically.
  - IT can force-install it with the Edge `ExtensionInstallForcelist` policy, through Intune or Group Policy.
- **Quick option (today):** staff download it from the Product Selector and Load unpacked on each PC, as above. Edge may show a "developer mode extensions" reminder. To update, download again, extract over the folder and click **Reload** on `edge://extensions`.
-->

- **Group Policy (since 1.5.1, no store):** the PCs are on the `WORKGROUP.com` domain, so Edge accepts an extension from our own server when Group Policy installs it. Sales staff do nothing, cannot remove it, and get each new version within hours. See the next section.
- **By hand (testing, or a PC off the domain):** download it from the Product Selector and Load unpacked, as above. Edge may show a "developer mode extensions" reminder. To update, download again, extract over the folder and click **Reload** on `edge://extensions`.
- **Later, if needed:** a hidden listing on Microsoft Edge Add-ons works on PCs off the domain too. A store listing must not have `update_url` in `manifest.json`.

## Install on every PC with Group Policy

The Product Selector serves a signed package and an update file, both public because Edge fetches them without anyone signed in:
- `https://consumers-product-selector.replit.app/api/quickadd/update.xml`
- `https://consumers-product-selector.replit.app/api/quickadd/consumers-quickadd-<version>.crx`

Extension ID: **`fdfhmjjacillkifkpnekcncfinoaoiem`** (fixed by the signing key). The QuickAdd page in the Product Selector shows the same line with a Copy button under **For IT**.

**Domain admin, once** (on the domain controller, Group Policy Management):
1. Edit the GPO that already sets Edge's homepage for the showroom PCs, or create one linked to their OU. To try it first, link a new GPO to a test OU with one PC in it (or use security filtering).
2. Go to **Computer Configuration > Policies > Administrative Templates > Microsoft Edge > Extensions > Control which extensions are installed silently**.
3. Choose **Enabled**, click **Show...**, and add this value (leave the name column as Edge fills it):
   `fdfhmjjacillkifkpnekcncfinoaoiem;https://consumers-product-selector.replit.app/api/quickadd/update.xml`
4. OK, then close the editor.
5. For Chrome PCs, the same value goes in **Google > Google Chrome > Extensions > Configure the list of force-installed apps and extensions**.

**On each PC:** nothing, apart from removing any copy loaded with Load unpacked (`edge://extensions`, **Remove**). Since 1.5.4 a PC with two copies shows only the newer one (each copy marks its button with its version, and the newer copy removes the older button, whichever loaded first); before that the first copy to load won, so an old hand-loaded copy could hide the Group Policy one and let an item through with a field missing (Gib, 11/6, a John Boos cutting board with no color). The Quote List still flags such an item ("Needs Color") and will not push it until the rep fills it in. The policy arrives at the next refresh (about 90 minutes) or right away with `gpupdate /force` in a Command Prompt and an Edge restart. Check `edge://extensions`: Consumers QuickAdd shows as installed by your organization, and `edge://policy` lists `ExtensionInstallForcelist`. Then open the Product Selector once (signed in) in that browser.

**Releasing a new version:**
1. Change the extension and bump `version` in `manifest.json`.
2. `node browser-extension/pack-crx.cjs` signs it with the key in `Documents\ConsumersQuickAdd-signing\consumers-quickadd.pem` and writes `browser-extension/release/` (the `.crx` and `release.json`). The API test fails when `release/` is older than the extension folder.
3. Commit, merge and Republish. Edge checks the update file every few hours and updates every PC.

**The signing key** (`consumers-quickadd.pem`) never goes in the repo (`*.pem` is ignored). Keep a copy somewhere safe: without it the next version needs a new key, which means a new extension ID and a new policy line.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Manifest V3 (Chrome 111+ / Edge 111+) |
| `seed-sites.js` | The special-order product lines and their Types from PROD (11/4/2026), used until the Product Selector sends the current ones (1.5.0) |
| `background.js` | Holds picks, keeps the vendor domain list, runs `vendor.js` only on those domains |
| `extract.js` | Reads a page's product data (JSON-LD, microdata, Open Graph, then the text around the heading); pure, unit tested |
| `vendor.js` | The "Add to CPS Quote List" button and panel on vendor pages (shadow DOM, house colors) |
| `app.js` | Bridge on the Product Selector's pages: passes picks and the vendor list via `window.postMessage` |
| `popup.html` / `popup.js` | Toolbar popup: items waiting and the vendor sites |
| `icons/` | The Product Selector's favicon (the orange shopping bag), sized by `make-icons.py` (Pillow); rerun it when the favicon changes. `make-icons.cjs` drew the 1.0 navy icons and is kept for reference. |
| `../pack-crx.cjs` | Signs the extension into `../release/consumers-quickadd.crx` with Edge's packer, for the Group Policy install (1.5.1) |
| `../release/` | The signed package and `release.json` (id, version, SHA-256) the Product Selector serves at `/api/quickadd/` |

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
- The vendor sites and Types it hands the extension are in `test/vendor-sites.json`, read from PROD NetSuite on 2026-11-05 with the Product Selector's own product-line and Type queries (`artifacts/api-server/src/lib/specialOrders.ts`): special-order (EPS) Inventory lines with an active SP- item, at least one active Type and a website. When lines change in NetSuite, refresh it (the signed-in `/api/special-orders/product-lines` answer has the same data), then `consumers-quote-helper/seed-sites.js` and `SEED_DOMAINS` from it.
- Prices are only checked for being there or not, since vendors change them.
