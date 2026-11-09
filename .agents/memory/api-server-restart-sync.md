---
name: api-server restart can trigger a NetSuite sync
description: Why you must not casually restart the api-server, and how backend changes actually reach runtime
---

# Restarting the api-server can run a live NetSuite sync on boot

The api-server dev workflow is `build && start` (esbuild, **no watch**), so backend
(`artifacts/api-server`) source changes do NOT hot-reload — they only reach runtime
after a rebuild + restart.

On boot the scheduler checks whether a live NetSuite sync should run. A restart
can therefore trigger a full sync, but the persisted schedule and time window
can defer it. Do not assume that a successful restart means a requested sync ran.

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

If the user explicitly requests a sync as well as a restart, confirm its actual
completion. If the scheduler defers it outside its time window, run the existing
manual-sync action without changing the standing schedule.
