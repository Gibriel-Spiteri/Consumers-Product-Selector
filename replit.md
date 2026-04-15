# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Features

### Consumers Product Selector (`artifacts/product-selector`)

A React + Vite web application served at `/` that implements a 3-level category mega-menu product selector.

- **Level 1** — top navigation bar tabs sourced from NetSuite `SiteCategory` (Bath, Bedroom, Clearance, Dining & Kitchen, Displays, Home, Kitchen, Living Room, Mattresses, Office, Plumbing)
- **Level 2** — column headers in the mega-menu dropdown (e.g., Accessories, Countertops, Medicine Cabinets)
- **Level 3+** — clickable links within each column that navigate to the product list page
- **Product List** — table with Name, SKU, Price columns at `/products/:categoryId`; endpoint fetches products from all descendant categories
- **Search** — searches products by name or SKU at `/search/:query`
- **NetSuite Banner** — yellow warning banner shown when NetSuite is not connected (using mock data)
- **Sync Button** — triggers POST `/api/netsuite/sync` to pull live data from NetSuite

### NetSuite M2M Integration (backend)

Machine-to-Machine OAuth 2.0 connection to NetSuite using JWT client assertions (PS256). This matches the approach used in the Pro-Appointment-Scheduler reference project.

**Authentication flow:**
1. A PS256-signed JWT is created using the RSA private key at `artifacts/api-server/certs/private_key.pem`
2. The JWT is sent to the NetSuite token endpoint as a `client_assertion` (grant type: `client_credentials`)
3. The returned bearer token is cached and reused until it expires

**Required environment secrets:**
- `NETSUITE_ACCOUNT_ID` — NetSuite account ID (e.g. `1234567` or `1234567_SB1` for sandbox)
- `NETSUITE_CLIENT_ID` — OAuth 2.0 Client ID from the NetSuite integration record
- `NETSUITE_OIDC_CLIENT_ID` — (optional) OIDC Client ID; takes precedence over `NETSUITE_CLIENT_ID` if set
- `NETSUITE_CERTIFICATE_ID` — Certificate ID shown in NetSuite's OAuth 2.0 Client Credentials setup

**Required file:**
- `artifacts/api-server/certs/private_key.pem` — RSA private key (excluded from git via `.gitignore`)

**Generating a key pair:**
```bash
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -pubout -out public_key.pem
# Upload public_key.pem to NetSuite → Setup → Integration → OAuth 2.0 Client Credentials
```

Without the private key file or credentials, the `/api/netsuite/status` endpoint reports missing configuration and the app uses built-in sample data.

**Sync flow:** POST `/api/netsuite/sync` →
1. Fetches CPS Site Category records (`customrecord_cps_site_category`) via SuiteQL
2. Fetches active PPR items from `customrecord_ppritem` / `customrecord_ppr`
3. Fetches active stock InventoryItem + KitItem records with `isonline = 'T'` via SuiteQL (~550 items), including `custitem_cps_category` (single list/record field read directly in SuiteQL)
4. Filters items to only those that qualify: has category assignment OR Express Bath flag OR active PPR
5. Upserts qualified items into local PostgreSQL cache → removes stale records

**Item inclusion criteria (all require `isonline = 'T'`, plus one of three paths):**
- `custitem_cps_category` single list/record field points to a `customrecord_cps_site_category` record (read directly in SuiteQL)
- `custitem_expressbath = 'T'` on the item record
- Item ID appears in an active PPR (`customrecord_ppritem` linked to active `customrecord_ppr`)

**Diagnostic endpoint:** `GET /api/netsuite/diag/:itemid` — checks item's NetSuite status, category assignment, and PPR associations to debug inclusion issues.

**Product naming:** The `salesdescription` field is stored separately from `name`. The `name` column holds the canonical NetSuite name (`fullname || itemid`), while `salesdescription` stores the NetSuite sales description. API responses use `salesdescription || name` as the display name, preferring the friendlier sales description when available.

**Scheduled sync:** On server startup, a background scheduler (`src/lib/scheduler.ts`) runs an initial sync and then repeats every 6 hours using recursive `setTimeout`. It includes an overlap guard (skips if a previous sync is still running) and graceful shutdown hooks (SIGTERM/SIGINT).

**Product images:** Two image URLs are synced per product:
- `imageUrl` — from `custitem_itemthumbnailurl` (thumbnail, used in grid/list views; 731 of 732 products have this)
- `fullImageUrl` — from `custitem_itemimageurl` (full-size, used in product modal gallery; 65 products have this)
- `additionalImages` — probed at runtime from the product detail endpoint by appending `-2`, `-3`, etc. suffixes to the base `imageUrl` and checking for HTTP 200 responses (results are cached in memory)
The frontend uses real NetSuite image URLs from consumersintranets.com — no placeholder/filler images. The product detail modal shows all discovered images in a gallery with thumbnail strip and fullscreen lightbox.

**Category tree filtering:** The API builds the full category tree from all synced SiteCategory records, then prunes it to only show online categories while keeping offline intermediate parents as structural connectors. No categories are hidden by name. Empty root-level categories (no children or products) are also removed. Categories are sorted alphabetically at each level.

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### Employee Authentication

Login system using NetSuite employee records:

- **Login endpoint**: `POST /api/auth/login` — validates email + password against NetSuite Employee records via SuiteQL
- **Verify endpoint**: `POST /api/auth/verify` — checks if a stored session is still valid (employee still has access)
- **Auth context**: `artifacts/product-selector/src/context/auth-context.tsx` — React context with localStorage session persistence
- **Login page**: `artifacts/product-selector/src/pages/login.tsx` — email + password form
- **Access control**: Checks `giveaccess = 'T'` (system access) and `custentity_webstore_access = 'T'` (product selector access)
- **Password field**: `custentity_webstorepassword` on Employee record
- **Session**: Stored in localStorage, verified against NetSuite on page load
- **Header**: Shows employee name dropdown; admin users see "Admin" link
- **Admin check**: `custentity_webstore_admin = 'T'` on Employee record
- **Admin page**: `/admin` route with NetSuite sync controls and homepage hero image management

### Express Bath Program

Virtual category page for items flagged with `custitem_expressbath = 'T'` in NetSuite:

- **Schema**: `is_express_bath` boolean column on `products` table (default false)
- **Sync**: Field fetched from both InventoryItem and KitItem SuiteQL queries during sync
- **API endpoint**: `GET /api/products/express-bath` — returns only Express Bath-flagged products
- **Frontend page**: `/express-bath` route with grid/list views, stock filter, Add to List
- **Nav link**: "Express Bath" in blue, right-justified in category nav bar (left of Clearance)

### Quote List Feature

Browser-based quote list with NetSuite estimate push capability:

- **Context/State**: `artifacts/product-selector/src/context/quote-list-context.tsx` — React context + localStorage persistence
- **Quote list page**: `/list` route (`src/pages/quote-list.tsx`) — editable table with quantities, totals, remove, clear
- **Add to list UI**: "Add" button on product grid/list cards (`category-products.tsx`) and "Add to List" with qty picker in product modal footer (`product-modal.tsx`)
- **Header badge**: Clipboard icon in header with item count badge, links to `/list`
- **Estimate search**: SuiteQL search by estimate number or customer name (`/api/estimates/search`)
- **Push to estimate**: Adds quote list items to existing NetSuite estimate via REST Record API PATCH (`/api/estimates/:id/add-items`)
- **Input validation**: netsuiteId must be positive numeric, quantity must be positive integer; SuiteQL wildcards escaped
- **204 handling**: `netsuiteRequest()` handles 204 No Content responses from NetSuite PATCH operations

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
