import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { logger } from "./logger";

const NETSUITE_ACCOUNT_ID = process.env.NETSUITE_ACCOUNT_ID || "";
const CLIENT_ID = process.env.NETSUITE_CLIENT_ID || "";
const OIDC_CLIENT_ID = process.env.NETSUITE_OIDC_CLIENT_ID || "";
const CERTIFICATE_ID =
  process.env.NETSUITE_CERTIFICATE_ID || process.env.CERTIFICATE_ID || "";

const PRIVATE_KEY_PATH = path.resolve("certs/private_key.pem");

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function extractAccountId(): string {
  let raw = NETSUITE_ACCOUNT_ID.trim();
  raw = raw.replace(/^https?:\/\//, "");
  raw = raw.replace(/\.app\.netsuite\.com\/?.*$/, "");
  raw = raw.replace(/\.suitetalk\.api\.netsuite\.com\/?.*$/, "");
  raw = raw.replace(/\/$/, "");
  return raw;
}

export function getBaseUrl(): string {
  const accountId = extractAccountId().toLowerCase().replace(/_/g, "-");
  return `https://${accountId}.suitetalk.api.netsuite.com`;
}

function getTokenEndpoint(): string {
  return `${getBaseUrl()}/services/rest/auth/oauth2/v1/token`;
}

function normalizePem(input: string): string {
  let s = input.trim();
  s = s.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  const headerMatch = s.match(/-----BEGIN ([A-Z0-9 ]+?)-----/);
  const footerMatch = s.match(/-----END ([A-Z0-9 ]+?)-----/);
  if (!headerMatch || !footerMatch) {
    return s;
  }
  const label = headerMatch[1];
  const header = `-----BEGIN ${label}-----`;
  const footer = `-----END ${label}-----`;
  const bodyStart = s.indexOf(header) + header.length;
  const bodyEnd = s.indexOf(footer);
  let body = s.slice(bodyStart, bodyEnd).replace(/[\s]+/g, "");
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `${header}\n${wrapped}\n${footer}\n`;
}

function getPrivateKey(): string {
  const envKey = process.env.NETSUITE_PRIVATE_KEY;
  if (envKey && envKey.trim().length > 0) {
    return normalizePem(envKey);
  }
  const candidates = [
    PRIVATE_KEY_PATH,
    path.resolve("artifacts/api-server/certs/private_key.pem"),
    path.resolve(__dirname, "../../certs/private_key.pem"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  }
  throw new Error(
    "NetSuite private key not found. Set NETSUITE_PRIVATE_KEY env var or place key at certs/private_key.pem"
  );
}

function getEffectiveClientId(): string {
  return OIDC_CLIENT_ID || CLIENT_ID;
}

function createClientAssertion(): string {
  const privateKey = getPrivateKey();
  const tokenEndpoint = getTokenEndpoint();
  const clientId = getEffectiveClientId();

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientId,
    scope: ["rest_webservices", "restlets"],
    aud: tokenEndpoint,
    iat: now,
    exp: now + 3600,
  };

  logger.info(
    { clientId, certificateId: CERTIFICATE_ID },
    "Creating JWT client assertion for M2M token request"
  );

  const token = jwt.sign(payload, privateKey, {
    algorithm: "PS256" as any,
    header: {
      alg: "PS256",
      typ: "JWT",
      kid: CERTIFICATE_ID,
    } as any,
  });

  return token;
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const tokenEndpoint = getTokenEndpoint();
  const clientAssertion = createClientAssertion();

  logger.info({ tokenEndpoint }, "Requesting OAuth2 M2M token from NetSuite");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: clientAssertion,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(
      { status: response.status, body: errorBody },
      "NetSuite M2M token request failed"
    );
    throw new Error(
      `Failed to obtain access token (${response.status}): ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  logger.info("Successfully obtained NetSuite OAuth2 M2M access token");
  return cachedToken.accessToken;
}

export function validateNetSuiteConfig(): { valid: boolean; missing: string[] } {
  const effectiveClientId = getEffectiveClientId();
  const checks: Record<string, string> = {
    NETSUITE_ACCOUNT_ID,
    "NETSUITE_CLIENT_ID or NETSUITE_OIDC_CLIENT_ID": effectiveClientId,
    NETSUITE_CERTIFICATE_ID: CERTIFICATE_ID,
  };

  const missing = Object.entries(checks)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const envKey = process.env.NETSUITE_PRIVATE_KEY;
  const hasEnvKey = !!(envKey && envKey.trim().length > 0);
  const hasFileKey =
    fs.existsSync(PRIVATE_KEY_PATH) ||
    fs.existsSync(path.resolve("artifacts/api-server/certs/private_key.pem")) ||
    fs.existsSync(path.resolve(__dirname, "../../certs/private_key.pem"));
  if (!hasEnvKey && !hasFileKey) {
    missing.push("NETSUITE_PRIVATE_KEY env var or certs/private_key.pem file");
  }

  return { valid: missing.length === 0, missing };
}

export function isNetSuiteConfigured(): boolean {
  return validateNetSuiteConfig().valid;
}

export async function netsuiteRequest<T>(
  urlPath: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const token = await getAccessToken();
  const baseUrl = `${getBaseUrl()}/services/rest/record/v1`;
  const url = `${baseUrl}${urlPath}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      prefer: "transient",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error(
      { status: response.status, url, body: text },
      "NetSuite REST API request failed"
    );

    if (response.status === 401) {
      cachedToken = null;
    }

    throw new Error(`NetSuite API request failed: ${response.status} ${text}`);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

const imageProbeCache = new Map<string, string[]>();
const IMAGE_PROBE_MAX = 10;

export async function probeAdditionalImages(baseImageUrl: string | null): Promise<string[]> {
  if (!baseImageUrl) return [];

  const cacheKey = baseImageUrl;
  if (imageProbeCache.has(cacheKey)) return imageProbeCache.get(cacheKey)!;

  const extMatch = baseImageUrl.match(/^(.+?)(\.[a-zA-Z]+)$/);
  if (!extMatch) return [baseImageUrl];

  const [, fullPath, ext] = extMatch;

  // Detect existing numeric suffix patterns and normalize the "stem" we increment.
  // Supported patterns (in priority order):
  //   foo_1.jpg  -> stem "foo", separator "_", start at next index
  //   foo-1.jpg  -> stem "foo", separator "-", start at next index
  //   foo.jpg    -> stem "foo", default to separator "-", start at 2
  let stem = fullPath;
  let separator = "-";
  let startIndex = 2;

  const suffixMatch = fullPath.match(/^(.*?)([_-])(\d+)$/);
  if (suffixMatch) {
    stem = suffixMatch[1];
    separator = suffixMatch[2];
    startIndex = parseInt(suffixMatch[3], 10) + 1;
  }

  const images: string[] = [baseImageUrl];

  const probePromises: Promise<{ index: number; exists: boolean }>[] = [];
  for (let i = startIndex; i < startIndex + IMAGE_PROBE_MAX; i++) {
    const probeUrl = `${stem}${separator}${i}${ext}`;
    probePromises.push(
      fetch(probeUrl, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(3000) })
        .then(r => ({ index: i, exists: r.ok }))
        .catch(() => ({ index: i, exists: false }))
    );
  }

  const results = await Promise.all(probePromises);
  // Stop at the first gap so we don't include images past a missing index.
  for (const { index, exists } of results.sort((a, b) => a.index - b.index)) {
    if (!exists) break;
    images.push(`${stem}${separator}${index}${ext}`);
  }

  logger.info({ baseImageUrl, totalImages: images.length }, "Probed for additional item images");
  imageProbeCache.set(cacheKey, images);
  return images;
}

const SUITEQL_PAGE_SIZE = 1000;

export async function executeSuiteQL<T = any>(
  baseQuery: string
): Promise<{ items: T[] }> {
  const allItems: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const token = await getAccessToken();
    const url = `${getBaseUrl()}/services/rest/query/v1/suiteql?limit=${SUITEQL_PAGE_SIZE}&offset=${offset}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        prefer: "transient",
      },
      body: JSON.stringify({ q: baseQuery }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error(
        { status: response.status, url, query: baseQuery, body: text },
        "NetSuite SuiteQL request failed"
      );

      if (response.status === 401) {
        cachedToken = null;
      }

      throw new Error(
        `NetSuite SuiteQL request failed: ${response.status} ${text}`
      );
    }

    const page = (await response.json()) as {
      items: T[];
      hasMore?: boolean;
      totalResults?: number;
    };
    allItems.push(...page.items);

    if (page.hasMore === false || page.items.length < SUITEQL_PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += SUITEQL_PAGE_SIZE;
    }

    logger.info({ fetched: allItems.length, offset }, "SuiteQL page fetched");
  }

  return { items: allItems };
}

export interface NetSuiteCategory {
  id: string;
  name: string;
  fullname: string;
  parent?: string | null;
  isOnline: boolean;
}

export interface NetSuiteItem {
  id: string;
  itemid: string;
  fullname?: string;
  salesdescription?: string | null;
  baseprice?: number;
  retailPrice?: number | null;
  imageUrl?: string | null;
  fullImageUrl?: string | null;
  description?: string | null;
  manufacturer?: string | null;
  collection?: string | null;
  quantityAvailable?: number | null;
  noReorder?: boolean;
  isExpressBath?: boolean;
  isSpecialOrderStock?: boolean;
  isOnline?: boolean;
  cpsCategoryId?: string | null;
  atpDate?: string | null;
  itemLeadTime?: number | null;
  quantityOnOrder?: number | null;
  quantityBackordered?: number | null;
  prodLineLeadTime?: number | null;
  prodLineOrderCycle?: number | null;
}

export async function fetchNetSuiteCategories(): Promise<NetSuiteCategory[]> {
  const result = await executeSuiteQL<{
    id: string;
    fullname: string;
    parentcategory: string | null;
  }>(
    `SELECT id,
            name AS fullname,
            custrecord_cps_sub_category_of AS parentcategory
     FROM customrecord_cps_site_category
     WHERE isinactive = 'F'
     ORDER BY name`
  );

  return result.items.map((row) => {
    const parts = row.fullname.split(" : ");
    const shortname = parts[parts.length - 1];
    return {
      id: String(row.id),
      name: shortname,
      fullname: row.fullname,
      parent: row.parentcategory ? String(row.parentcategory) : null,
      isOnline: true,
    };
  });
}

interface SuiteQLItemRow {
  id: string;
  itemid: string;
  fullname: string | null;
  salesdescription: string | null;
  baseprice: string | null;
  retailprice: string | null;
  imageurl: string | null;
  fullimageurl: string | null;
  storedescription: string | null;
  prodline: string | null;
  collection: string | null;
  quantityavailable: string | null;
  isnoreorder: string | null;
  isexpressbath: string | null;
  isspecialorderstock: string | null;
  isonline: string | null;
  cpscategoryid: string | null;
  itemleadtime: string | null;
  quantityonorder: string | null;
  quantitybackordered: string | null;
  prodlineleadtime: string | null;
  prodlineordercycle: string | null;
}

function mapItemRow(row: SuiteQLItemRow): NetSuiteItem {
  return {
    id: String(row.id),
    itemid: row.itemid,
    fullname: row.fullname ?? undefined,
    salesdescription: row.salesdescription ?? null,
    baseprice: row.baseprice != null ? Number(row.baseprice) : undefined,
    retailPrice: row.retailprice != null ? Number(row.retailprice) : null,
    imageUrl: row.imageurl ?? null,
    fullImageUrl: row.fullimageurl ?? null,
    description: row.storedescription ?? null,
    manufacturer: row.prodline ?? null,
    collection: row.collection ?? null,
    quantityAvailable: row.quantityavailable != null ? Number(row.quantityavailable) : null,
    noReorder: row.isnoreorder === "T",
    isExpressBath: row.isexpressbath === "T",
    isSpecialOrderStock: row.isspecialorderstock === "T",
    isOnline: row.isonline === "T",
    cpsCategoryId: row.cpscategoryid ? String(row.cpscategoryid) : null,
    atpDate: null,
    itemLeadTime: row.itemleadtime != null ? Number(row.itemleadtime) : null,
    quantityOnOrder: row.quantityonorder != null ? Number(row.quantityonorder) : null,
    quantityBackordered: row.quantitybackordered != null ? Number(row.quantitybackordered) : null,
    prodLineLeadTime: row.prodlineleadtime != null ? Number(row.prodlineleadtime) : null,
    prodLineOrderCycle: row.prodlineordercycle != null ? Number(row.prodlineordercycle) : null,
  };
}

export interface PprItemData {
  name: string | null;
  priceReductionRetail: number | null;
}

export async function fetchActivePprItems(): Promise<Map<string, PprItemData>> {
  try {
    const result = await executeSuiteQL<{
      custrecord_ppritem_item: string;
      pprname: string | null;
      custrecord_ppr_pricereddisplay_ret: string | null;
    }>(
      `SELECT pi.custrecord_ppritem_item,
              ppr.name AS pprname,
              ppr.custrecord_ppr_pricereddisplay_ret
       FROM customrecord_ppritem pi
       INNER JOIN customrecord_ppr ppr ON ppr.id = pi.custrecord_ppritem_ppr
       WHERE BUILTIN.DF(ppr.custrecord_ppr_status) = 'Active'
         AND pi.isinactive = 'F'`
    );
    const map = new Map<string, PprItemData>();
    for (const r of result.items) {
      const id = String(r.custrecord_ppritem_item);
      const raw = r.custrecord_ppr_pricereddisplay_ret;
      const priceReductionRetail = raw != null ? Math.abs(parseFloat(raw)) : null;
      if (!map.has(id)) {
        map.set(id, { name: r.pprname ?? null, priceReductionRetail });
      }
    }
    logger.info({ count: map.size }, "Fetched active PPR items from NetSuite");
    return map;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch PPR data — skipping PPR flags");
    return new Map();
  }
}

export async function fetchNetSuiteItems(): Promise<NetSuiteItem[]> {
  const inventoryResult = await executeSuiteQL<SuiteQLItemRow>(
    `SELECT
      item.id,
      item.itemid,
      item.fullname,
      item.salesdescription,
      p.unitprice AS baseprice,
      item.custitem_normalretailprice AS retailprice,
      item.custitem_itemthumbnailurl AS imageurl,
      item.custitem_itemimageurl AS fullimageurl,
      item.storedescription,
      BUILTIN.DF(item.custitem_prodline) AS prodline,
      BUILTIN.DF(item.custitem_collection) AS collection,
      item.quantityavailable,
      item.custitem_noreorders AS isnoreorder,
      item.custitem_expressbath AS isexpressbath,
      item.custitem_specord_stock AS isspecialorderstock,
      item.isonline,
      item.custitem_cps_category AS cpscategoryid,
      item.leadtime AS itemleadtime,
      item.quantityonorder,
      item.quantitybackordered,
      pl.custrecord_pl_leadtime AS prodlineleadtime,
      pl.custrecord_pl_ordercycle AS prodlineordercycle
    FROM InventoryItem item
    LEFT JOIN pricing p ON p.item = item.id AND p.pricelevel = 1 AND p.quantity = 1
    LEFT JOIN customrecord_pl pl ON pl.id = item.custitem_prodline
    WHERE item.isinactive = 'F' AND item.isonline = 'T' AND UPPER(BUILTIN.DF(item.custitem_stock_code)) = 'STOCK'
    ORDER BY item.itemid`
  );

  let kitItems: SuiteQLItemRow[] = [];
  try {
    const kitResult = await executeSuiteQL<SuiteQLItemRow>(
      `SELECT
        item.id,
        item.itemid,
        item.fullname,
        item.description AS salesdescription,
        p.unitprice AS baseprice,
        item.custitem_normalretailprice AS retailprice,
        item.custitem_itemthumbnailurl AS imageurl,
        item.custitem_itemimageurl AS fullimageurl,
        item.storedescription,
        BUILTIN.DF(item.custitem_prodline) AS prodline,
        BUILTIN.DF(item.custitem_collection) AS collection,
        NULL AS quantityavailable,
        NULL AS isnoreorder,
        item.custitem_expressbath AS isexpressbath,
        NULL AS isspecialorderstock,
        item.isonline,
        item.custitem_cps_category AS cpscategoryid,
        NULL AS itemleadtime,
        NULL AS quantityonorder,
        NULL AS quantitybackordered,
        pl.custrecord_pl_leadtime AS prodlineleadtime,
        pl.custrecord_pl_ordercycle AS prodlineordercycle
      FROM KitItem item
      LEFT JOIN pricing p ON p.item = item.id AND p.pricelevel = 1 AND p.quantity = 1
      LEFT JOIN customrecord_pl pl ON pl.id = item.custitem_prodline
      WHERE item.isinactive = 'F' AND item.isonline = 'T'
      ORDER BY item.itemid`
    );
    kitItems = kitResult.items;
    logger.info({ count: kitItems.length }, "Fetched kit items from NetSuite");
  } catch (err) {
    logger.warn({ err }, "Failed to fetch kit items, continuing with inventory items only");
  }

  const allItems = [
    ...inventoryResult.items.map(mapItemRow),
    ...kitItems.map(mapItemRow),
  ];

  logger.info({ inventory: inventoryResult.items.length, kits: kitItems.length, total: allItems.length }, "Fetched items from NetSuite");

  return allItems;
}

function parseNsDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const trimmed = String(s).trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return new Date(Date.UTC(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10)));
  }
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Date.UTC(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10)));
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

export async function fetchOpenPoEarliestReceipts(): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (!isNetSuiteConfigured()) return map;

  try {
    const result = await executeSuiteQL<{
      item: string;
      expectedreceiptdate: string | null;
      quantity: string | null;
      quantityshiprecv: string | null;
    }>(
      `SELECT tl.item,
              tl.expectedreceiptdate,
              tl.quantity,
              tl.quantityshiprecv
       FROM TransactionLine tl
       INNER JOIN Transaction t ON t.id = tl.transaction
       WHERE t.type = 'PurchOrd'
         AND t.customform = 154
         AND t.status IN ('B', 'D', 'E', 'F')
         AND tl.item IS NOT NULL
         AND tl.expectedreceiptdate IS NOT NULL
         AND (tl.quantity - NVL(tl.quantityshiprecv, 0)) > 0`
    );

    for (const row of result.items) {
      const itemId = row.item ? String(row.item) : null;
      const date = parseNsDate(row.expectedreceiptdate);
      if (!itemId || !date) continue;
      const existing = map.get(itemId);
      if (!existing || date < existing) {
        map.set(itemId, date);
      }
    }
    logger.info({ count: map.size }, "Fetched open PO earliest receipt dates from NetSuite");
  } catch (err) {
    logger.warn({ err }, "Open PO receipt date query failed; ATP fall-back to lead-time rules");
  }

  return map;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Replicates the NetSuite custitem_checkatp formula in JavaScript.
 *
 * Rules (only applied when item is out of stock; in-stock items get null):
 * 1. quantityonorder > quantitybackordered → earliest open-PO receipt date + 7 days
 * 2. else if item.leadtime is set → today + item.leadtime + prodLine.ordercycle + 7
 * 3. else if prodLine.leadtime is set → today + prodLine.leadtime + prodLine.ordercycle + 7
 * 4. else → null
 */
export function computeAtpDate(
  item: NetSuiteItem,
  poEarliestReceipts: Map<string, Date>,
  today: Date = new Date()
): string | null {
  const qtyAvail = item.quantityAvailable;
  if (qtyAvail == null || qtyAvail > 0) return null;

  const onOrder = item.quantityOnOrder ?? 0;
  const backordered = item.quantityBackordered ?? 0;
  const itemLead = item.itemLeadTime;
  const plLead = item.prodLineLeadTime;
  const plCycle = item.prodLineOrderCycle ?? 0;

  // Anchor "today" to UTC midnight so date-only arithmetic stays
  // stable regardless of the wall-clock time when the sync runs.
  const todayAnchor = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  ));

  if (onOrder > backordered) {
    const earliest = poEarliestReceipts.get(item.id);
    if (earliest) {
      return toIsoDate(addDays(earliest, 7));
    }
  }

  if (itemLead != null) {
    return toIsoDate(addDays(todayAnchor, itemLead + plCycle + 7));
  }

  if (plLead != null) {
    return toIsoDate(addDays(todayAnchor, plLead + plCycle + 7));
  }

  return null;
}

export interface NetSuiteItemAttribute {
  id: string;
  itemNetsuiteId: string;
  attributeName: string;
  attributeValueId: string;
  attributeValue: string;
  sortOrder: number | null;
  isFilter: boolean;
}

export async function fetchItemAttributes(): Promise<NetSuiteItemAttribute[]> {
  const query = `
    SELECT
      iav.id,
      iav.custrecord_itematrbval_item AS itemid,
      iav.custrecord_itematrbval_displayname AS attributename,
      iav.custrecord_itematrbval_val AS valueid,
      BUILTIN.DF(iav.custrecord_itematrbval_val) AS valuename,
      iav.custrecord_itematrbval_sortorder AS sortorder,
      iav.custrecord_itematrbval_filter AS isfilter
    FROM CUSTOMRECORD_ITEMATRBVAL iav
    WHERE iav.isinactive = 'F'
  `;

  const result = await executeSuiteQL<{
    id: string;
    itemid: string;
    attributename: string;
    valueid: string;
    valuename: string;
    sortorder: string | null;
    isfilter: string;
  }>(query);

  return result.items.map((row) => ({
    id: String(row.id),
    itemNetsuiteId: String(row.itemid),
    attributeName: row.attributename ?? "",
    attributeValueId: String(row.valueid),
    attributeValue: row.valuename ?? "",
    sortOrder: row.sortorder != null ? Number(row.sortorder) : null,
    isFilter: row.isfilter === "T",
  }));
}

export interface NetSuiteRelatedItem {
  parentNetsuiteId: string;
  relatedNetsuiteId: string;
  description: string | null;
  basePrice: string | null;
  onlinePrice: string | null;
}

export async function fetchRelatedItems(): Promise<NetSuiteRelatedItem[]> {
  const result = await executeSuiteQL<{
    superitem: string;
    presitemid: string;
    description: string | null;
    baseprice: string | null;
    onlineprice: string | null;
  }>(`
    SELECT
      superitem,
      presitemid,
      description,
      baseprice,
      onlineprice
    FROM InventoryItemPresentationItem
  `);

  return result.items.map((row) => ({
    parentNetsuiteId: String(row.superitem),
    relatedNetsuiteId: String(row.presitemid),
    description: row.description ?? null,
    basePrice: row.baseprice ?? null,
    onlinePrice: row.onlineprice ?? null,
  }));
}

export async function fetchItemBins(): Promise<Map<string, string>> {
  const binMap = new Map<string, string>();
  if (!isNetSuiteConfigured()) return binMap;

  try {
    const result = await executeSuiteQL<{
      itemid: string;
      binname: string | null;
      isdisplay: string | null;
      qty: string | null;
    }>(
      `SELECT iib.item AS itemid,
              b.binnumber AS binname,
              b.custrecord_bin_isdisplay AS isdisplay,
              iib.quantityonhand AS qty
       FROM iteminventorybalance iib
       JOIN bin b ON b.id = iib.binnumber
       WHERE b.isinactive = 'F'`
    );

    type BinChoice = { binname: string; isDisplay: boolean; qty: number };
    const perItem = new Map<string, BinChoice>();

    for (const row of result.items) {
      if (!row.itemid || !row.binname) continue;
      const key = String(row.itemid);
      const isDisplay = row.isdisplay === "T" || row.isdisplay === "true";
      const qty = Number(row.qty ?? 0) || 0;
      const candidate: BinChoice = { binname: row.binname, isDisplay, qty };
      const existing = perItem.get(key);
      if (
        !existing ||
        (candidate.isDisplay && !existing.isDisplay) ||
        (candidate.isDisplay === existing.isDisplay && candidate.qty > existing.qty)
      ) {
        perItem.set(key, candidate);
      }
    }

    for (const [key, choice] of perItem) {
      binMap.set(key, choice.binname);
    }

    logger.info({ count: binMap.size }, "Fetched item bins from NetSuite");
  } catch (err) {
    logger.warn({ err }, "Bin number query failed; bin numbers will be empty");
  }

  return binMap;
}

export async function fetchLiveInventory(
  netsuiteIds: string[]
): Promise<Map<string, number>> {
  const inventoryMap = new Map<string, number>();
  if (netsuiteIds.length === 0 || !isNetSuiteConfigured()) return inventoryMap;

  try {
    const idList = netsuiteIds.map((id) => `'${id}'`).join(",");

    const invResult = await executeSuiteQL<{
      id: string;
      quantityavailable: string | null;
    }>(
      `SELECT id, quantityavailable FROM InventoryItem WHERE id IN (${idList})`
    );

    for (const row of invResult.items) {
      inventoryMap.set(
        String(row.id),
        row.quantityavailable != null ? Number(row.quantityavailable) : 0
      );
    }

    const missingIds = netsuiteIds.filter((id) => !inventoryMap.has(id));
    if (missingIds.length > 0) {
      const kitInventory = await fetchKitInventoryFromSearch(missingIds);
      for (const [id, qty] of kitInventory) {
        inventoryMap.set(id, qty);
      }
    }
  } catch (err) {
    logger.warn({ err }, "Live inventory lookup failed, falling back to cached data");
  }

  return inventoryMap;
}

async function fetchKitInventoryFromSearch(
  netsuiteIds: string[]
): Promise<Map<string, number>> {
  const kitMap = new Map<string, number>();

  try {
    const idList = netsuiteIds.map((id) => `'${id}'`).join(",");

    const memberResult = await executeSuiteQL<{
      kitid: string;
      memberid: string;
      quantity: string;
      memberqtyavailable: string | null;
    }>(
      `SELECT
        km.parentitem AS kitid,
        km.item AS memberid,
        km.quantity,
        inv.quantityavailable AS memberqtyavailable
      FROM KitItemMember km
      JOIN InventoryItem inv ON inv.id = km.item
      WHERE km.parentitem IN (${idList})`
    );

    logger.info({ rows: memberResult.items.length, sample: memberResult.items.slice(0, 5) }, "KitItemMember inventory query result");

    const kitMembers = new Map<string, Array<{ memberQty: number; available: number }>>();
    for (const row of memberResult.items) {
      const kitId = String(row.kitid);
      if (!kitMembers.has(kitId)) {
        kitMembers.set(kitId, []);
      }
      kitMembers.get(kitId)!.push({
        memberQty: Number(row.quantity) || 1,
        available: row.memberqtyavailable != null ? Number(row.memberqtyavailable) : 0,
      });
    }

    for (const [kitId, members] of kitMembers) {
      if (members.length === 0) {
        kitMap.set(kitId, 0);
        continue;
      }
      const kitAvailable = Math.min(
        ...members.map((m) => Math.floor(m.available / m.memberQty))
      );
      kitMap.set(kitId, Math.max(0, kitAvailable));
    }

    for (const id of netsuiteIds) {
      if (!kitMap.has(id)) {
        kitMap.set(id, 0);
      }
    }
  } catch (err) {
    logger.warn({ err }, "Kit inventory lookup failed");
  }

  return kitMap;
}
