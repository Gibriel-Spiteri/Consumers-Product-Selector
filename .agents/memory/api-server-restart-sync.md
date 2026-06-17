---
name: api-server restart triggers an immediate NetSuite sync
description: Why you must not casually restart the api-server, and how backend changes actually reach runtime
---

# Restarting the api-server runs a live NetSuite sync on boot

The api-server dev workflow is `build && start` (esbuild, **no watch**), so backend
(`artifacts/api-server`) source changes do NOT hot-reload — they only reach runtime
after a rebuild + restart.

On boot, `app.listen` calls `startScheduledSync()` (lib/scheduler), which invokes
`runSync()` **immediately** (not just on the schedule) → `syncFromNetSuite()` →
`fetchNetSuiteItems()`. So **every restart fires a full live NetSuite sync** (only
skipped if NetSuite isn't configured).

**Why it matters:** this repo's work is sensitive to NetSuite load/concurrency.
Restarting to "see a change" has a real external side effect (a sync). Validate
backend changes with `pnpm --filter @workspace/api-server typecheck` instead of
restarting, and let the change reach runtime via a deliberate deploy/restart at a
safe time (or the next scheduled cycle).

**How to apply:** never restart the api-server just to test; if a backend change
must go live now, get explicit OK first because it triggers a sync. The frontend
(`product-selector`, Vite) DOES hot-reload, so frontend-only changes are safe — but
a frontend change that depends on a new backend field will look broken/empty until
the api-server is restarted.
