---
name: Special-order quote requirements
description: User-specified source and scope of special-order entry choices.
---

Special-order Type choices come from the Special Order Types subtab of the product line record and are unique for each product line.

**Why:** The user explicitly identified this as the source; Delta's choices must not be hardcoded or reused for other product lines.

**How to apply:** When adding special-order entry to the quote list, select a product line first and load only its associated Type choices. The requested entry fields are Quantity, Type, Model, Collection / Description, Color, and List Price.

List Price is entered manually.

**Why:** The user clarified, “The list price gets entered.” They did not specify a selling-price formula.

**How to apply:** Accept the entered list price; do not invent a multiplier or treat it as a confirmed selling price.

Limit special-order product lines to PRODUCT LINE TYPE = INVENTORY.

**Why:** The user explicitly requested this restriction.

**How to apply:** Apply the restriction to available product-line choices and enforce it when validating an estimate push.
