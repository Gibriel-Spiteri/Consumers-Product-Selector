---
name: api-server typecheck resolves @workspace/db from a stale gitignored dist
description: Why `tsc` typecheck reports "no exported member" for newly added db tables, and the baseline typecheck being dirty
---

# api-server typecheck and @workspace/db declarations

The api-server `typecheck` script is `tsc -p tsconfig.json --noEmit` and uses TS
project references to `lib/db`. `lib/db` is a **composite, emitDeclarationOnly**
project whose `dist/` (declarations) is **gitignored**. The typecheck resolves
`@workspace/db` types from that `dist/`, NOT from `src/`.

**Consequence:** after adding/exporting a new table in `lib/db/src/schema`, the
api-server typecheck fails with `"@workspace/db" has no exported member 'XTable'`
until you rebuild the declarations:

    pnpm exec tsc -b lib/db/tsconfig.json

**Why:** the redirect to the prebuilt dist means new source exports are invisible
to consumers until the composite project is rebuilt. The available-symbols set in
the error message matches the stale dist, which is the tell.

**How to apply:** any time you change `lib/db` schema exports, rebuild the db
declarations before/while running the api-server typecheck. The **runtime** build
(`build.mjs`, esbuild) bundles from source and is unaffected — this is purely a
typecheck concern.

# The api-server typecheck baseline is dirty (pre-existing)

`tsc` typecheck reports pre-existing errors that the runtime build (esbuild)
ignores: `TS7030 "Not all code paths return a value"` on many Express route
handlers/middleware (base tsconfig sets `noImplicitReturns: true`, handlers
`return res.x()` in guards but fall through on success), plus isolated bugs like
`objectStorage.ts` `signed_url` on `unknown`, `analytics.ts` undefined `days`,
and `productImages.ts` `netsuiteId` string|string[] overload mismatches.

**Why it matters:** a green typecheck is NOT the baseline. To prove you introduced
no new type errors, diff the error set against these known-pre-existing ones
(they appear in files you never touched, e.g. `estimates.ts`, `health.ts`),
rather than expecting zero errors.
