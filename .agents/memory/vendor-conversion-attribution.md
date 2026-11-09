---
name: Vendor conversion attribution
description: Conservative linkage and reporting-window semantics for the special-order funnel
---

Count a vendor conversion only through explicit visit and pick identifiers for the same signed-in user and vendor. Do not join by names, most-recent vendor opening, session alone, or URL/time similarity. Treat changed product-line provenance and ambiguous duplicate identifiers as unlinked.

**Why:** Vendor openings and captures are independent actions; claiming conversions from proximity would misrepresent which visits produced estimates.

**How to apply:** All stages must be recorded within the selected reporting window, using the same admin exclusions. This is an in-window funnel, not lifetime cohort attribution: cross-boundary stages remain unlinked. An extension-opened vendor tab provides the visit link; direct visits and separate tabs intentionally do not. Keep action counts separate from distinct converting visits and disclose older telemetry's missing provenance.
