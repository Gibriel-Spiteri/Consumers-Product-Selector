---
name: Special-order quote requirements
description: User-specified source and scope of special-order entry choices.
---

The Special Order section is not a quote list; it must be a separate page.

**Why:** The user corrected navigation that opened the Quote List when selecting Special Order.

**How to apply:** Keep special-order entry and its category filters separate from the Quote List. Adding an item can still put it in the quote list.

Special-order Type choices come from the Special Order Types subtab of the product line record and are unique for each product line.

**Why:** The user explicitly identified this as the source; Delta's choices must not be hardcoded or reused for other product lines.

**How to apply:** When adding special-order entry to the quote list, select a product line first and load only its associated Type choices. The requested entry fields are Quantity, Type, Model, Collection / Description, Color, and List Price.

List Price is entered manually.

**Why:** The user clarified, “The list price gets entered.” They did not specify a selling-price formula.

**How to apply:** Accept the entered list price; do not invent a multiplier or treat it as a confirmed selling price.

**Superseded 2026-11-03 (Gib Spiteri, NetSuite developer):** the selling price is NOT left to NetSuite. Every SP item's price levels are 0, so a line pushed without a rate lands at $0.00, and NetSuite only prices special orders in its browser scripts (no server script re-prices them). The app now applies NetSuite's own formula, from `salesorder.js` (field change on `custcol_list_selling_rate`) and the Item Options popup (`itemoptions.js`):

- Rate = List Price x product line `custrecord_pl_costinclfreightmult` x (customer category 1 = Retail: `custrecord_pl_price_mult_retail`, any other category: `custrecord_pl_price_mult_crd`), rounded to the cent. A blank or zero multiplier counts as 1.
- Amount = Rate x Quantity. List Amount = List Price x Quantity.
- Is Drop Ship = item `isdropshipitem` or `custitem_ns_dropship`. Per Order Form = No. Earn rate from the item's earn-rate display fields (Cabinet Direct, location 14, uses the CD ones).
- Do not set the Class option (`custcol_specord_class`); NetSuite leaves it blank.
- Type, Model, Coll/Desc and Color are transaction item options. REST ignores them as plain line fields, so they are written through the line's `options` string after the lines are added, then checked.

**How to apply:** keep `specialOrderRate` and the options write-back in `artifacts/api-server/src/lib/specialOrders.ts` matching NetSuite. If the formula changes in NetSuite, change it here too.

Limit special-order product lines to PRODUCT LINE TYPE = INVENTORY.

**Why:** The user explicitly requested this restriction.

**How to apply:** Apply the restriction to available product-line choices and enforce it when validating an estimate push.
