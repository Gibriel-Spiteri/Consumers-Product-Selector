---
name: Vendor sites and the Consumers Quote Helper extension
description: Product line cards open the vendor's website; a Chrome/Edge extension sends products picked there to the Special Order page.
---

The product line cards on the Special Order page link to `websiteUrl` (NetSuite `custrecord_pl_prd_website`, the PRD page's vendor link). The **Consumers Quote Helper** extension (`browser-extension/`) adds an "Add to Consumers Quote" button on those vendor sites. The picks show on the Special Order page ("Picked on vendor websites"), and "Use" pre-fills the Add Special Order form.

**Why:** Gib (2026-11-04) wants customers to choose products on the vendor's own website and have them land on the quote list. Vendor sites cannot be embedded (they all forbid framing), so a browser extension carries the picks.

**How to apply:**
- Keep `websiteUrl` on `/api/special-orders/product-lines`. The app sends every line's website to the extension (`vendor-sites` message), and that list decides where the extension runs.
- The page and the extension talk only through `window.postMessage` with `source` "consumers-product-selector" (page) and "consumers-quote-helper" (extension); see `src/lib/vendor-picks.ts`. Do not rename those strings or message types without updating `browser-extension/consumers-quote-helper/app.js`.
- Picks are untrusted input: they only pre-fill the form, and the rep picks the Type and confirms the list price.
- If the app's address changes, the extension's `manifest.json` and `background.js` (`APP_ORIGINS`) must change too.
