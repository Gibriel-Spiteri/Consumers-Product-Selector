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

function getBaseUrl(): string {
  const accountId = extractAccountId().toLowerCase().replace(/_/g, "-");
  return `https://${accountId}.suitetalk.api.netsuite.com`;
}

function getTokenEndpoint(): string {
  return `${getBaseUrl()}/services/rest/auth/oauth2/v1/token`;
}

function getPrivateKey(): string {
  return fs.readFileSync(PRIVATE_KEY_PATH, "utf-8");
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

async function getAccessToken(): Promise<string> {
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

  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    missing.push("Private Key File (certs/private_key.pem)");
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

  const match = baseImageUrl.match(/^(.+?)(\.[a-zA-Z]+)$/);
  if (!match) return [baseImageUrl];

  const [, basePath, ext] = match;
  const images: string[] = [baseImageUrl];

  const probePromises: Promise<{ index: number; exists: boolean }>[] = [];
  for (let i = 2; i <= IMAGE_PROBE_MAX; i++) {
    const probeUrl = `${basePath}-${i}${ext}`;
    probePromises.push(
      fetch(probeUrl, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(3000) })
        .then(r => ({ index: i, exists: r.ok }))
        .catch(() => ({ index: i, exists: false }))
    );
  }

  const results = await Promise.all(probePromises);
  for (const { index, exists } of results.sort((a, b) => a.index - b.index)) {
    if (exists) {
      images.push(`${basePath}-${index}${ext}`);
    }
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
  quantityAvailable?: number | null;
  noReorder?: boolean;
  sitecategoryid?: string | null;
}

export async function fetchNetSuiteCategories(): Promise<NetSuiteCategory[]> {
  const result = await executeSuiteQL<{
    id: string;
    itemid: string;
    fullname: string;
    parentcategory: string | null;
    isonline: string;
  }>(
    "SELECT id, itemid, fullname, parentcategory, isonline FROM SiteCategory WHERE isinactive = 'F' ORDER BY fullname"
  );

  return result.items.map((row) => ({
    id: String(row.id),
    name: row.itemid,
    fullname: row.fullname,
    parent: row.parentcategory ? String(row.parentcategory) : null,
    isOnline: row.isonline === "T",
  }));
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
  quantityavailable: string | null;
  isnoreorder: string | null;
  sitecategoryid: string | null;
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
    quantityAvailable: row.quantityavailable != null ? Number(row.quantityavailable) : null,
    noReorder: row.isnoreorder === "T",
    sitecategoryid: row.sitecategoryid ? String(row.sitecategoryid) : null,
  };
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
      item.quantityavailable,
      item.custitem_noreorders AS isnoreorder,
      COALESCE(isc_def.category, isc_any.category) AS sitecategoryid
    FROM InventoryItem item
    LEFT JOIN pricing p ON p.item = item.id AND p.pricelevel = 1 AND p.quantity = 1
    LEFT JOIN ItemSiteCategory isc_def ON isc_def.item = item.id AND isc_def.isdefault = 'T'
    LEFT JOIN (SELECT item, MIN(category) AS category FROM ItemSiteCategory GROUP BY item) isc_any ON isc_any.item = item.id
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
        NULL AS quantityavailable,
        NULL AS isnoreorder,
        COALESCE(isc_def.category, isc_any.category) AS sitecategoryid
      FROM KitItem item
      LEFT JOIN pricing p ON p.item = item.id AND p.pricelevel = 1 AND p.quantity = 1
      LEFT JOIN ItemSiteCategory isc_def ON isc_def.item = item.id AND isc_def.isdefault = 'T'
      LEFT JOIN (SELECT item, MIN(category) AS category FROM ItemSiteCategory GROUP BY item) isc_any ON isc_any.item = item.id
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
