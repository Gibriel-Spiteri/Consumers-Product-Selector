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

async function netsuiteRequest<T>(
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

  return response.json() as Promise<T>;
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
  parent?: string | null;
}

export interface NetSuiteItem {
  id: string;
  itemid: string;
  displayname?: string;
  salesprice?: number;
  category?: string | null;
}

export async function fetchNetSuiteCategories(): Promise<NetSuiteCategory[]> {
  const result = await executeSuiteQL<{
    id: string;
    name: string;
    parent: string | null;
  }>("SELECT id, name, parent FROM ItemCategory ORDER BY name");

  return result.items.map((row) => ({
    id: String(row.id),
    name: row.name,
    parent: row.parent ? String(row.parent) : null,
  }));
}

export async function fetchNetSuiteItems(): Promise<NetSuiteItem[]> {
  const result = await executeSuiteQL<{
    id: string;
    itemid: string;
    displayname: string | null;
    salesprice: number | null;
    category: string | null;
  }>(
    "SELECT id, itemid, displayname, salesprice, category FROM Item WHERE isinactive = 'F' ORDER BY itemid LIMIT 5000"
  );

  return result.items.map((row) => ({
    id: String(row.id),
    itemid: row.itemid,
    displayname: row.displayname ?? undefined,
    salesprice: row.salesprice ?? undefined,
    category: row.category ? String(row.category) : null,
  }));
}
