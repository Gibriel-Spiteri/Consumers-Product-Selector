---
name: Analytics scope and attribution
description: Consistent filters and per-person special-order usage expectations
---

Analytics totals and their personal, product and estimate drill-downs must use the same selected date range and Include admins setting, including the same home-page exclusion.

**Why:** The user reported personal usage exceeding the totals with admins included. The personal history previously ignored the selected range; anonymous tab-hide flushes also lost user attribution.

**How to apply:** Compare like-for-like actions and time windows before claiming a discrepancy. Preserve signed-in identity on tab-hide/unload. Never infer an employee for historical anonymous events.

Added-to-list and estimate-send totals need a drill-down to the people performing them. Special-order analytics must identify which vendor sites users open through CPS and where they use QuickAdd.

**Why:** The user requested per-user action drill-downs and special-order site/extension usage.

**How to apply:** Keep actor and vendor breakdowns on the same reporting filters. Distinguish a vendor link opening, a QuickAdd capture action, and a later add or estimate push; do not present one as the other.

Estimate-send telemetry must not turn a completed NetSuite push into a retryable failure.

**Why:** NetSuite appends estimate lines, and its write is not atomic with local analytics storage. Asking staff to repeat a successful push because telemetry failed can duplicate real estimate lines.

**How to apply:** Retry analytics persistence independently with the same action identifier, never retry the NetSuite write to repair analytics, and keep the browser's per-tab session rather than inventing one session per push.
