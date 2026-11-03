---
name: NetSuite estimate routes require a signed sign-in token
description: /api/estimates/* and /api/special-orders/* check a signed token from /api/auth/login; NetSuite 429s are retried.
---

`POST /api/auth/login` returns `token` (HMAC-signed, 30 days, `lib/session.ts`). The browser keeps it in localStorage `ps_session`. Every generated API hook sends it as `Authorization: Bearer` through `setAuthTokenGetter`, and plain `fetch` calls use `authHeaders()` from `auth-context`. `requireEmployee` guards `/api/estimates/*` and `/api/special-orders/*`. `/api/auth/verify` trusts only the token and returns a fresh one.

**Why:** before 2026-11-03 these routes answered anyone with the public URL. They listed PROD estimates and could add lines to any of them. The old `X-Employee-Id` header and `/auth/verify` body id can be faked by anyone.

**How to apply:** never remove `requireEmployee` from those routes, and never trust an employee id the browser sends. New NetSuite data or write routes get `requireEmployee` too. The signing key is `SESSION_SECRET` if set, otherwise derived from the NetSuite private key; never hardcode one. NetSuite 429 (account-wide concurrency limit) is retried in `fetchNetSuite`; keep every NetSuite call going through it.
