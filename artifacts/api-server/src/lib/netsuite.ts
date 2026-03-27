import { logger } from "./logger";

interface NetSuiteToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: NetSuiteToken | null = null;

function getNetSuiteConfig() {
  return {
    accountId: process.env.NETSUITE_ACCOUNT_ID,
    clientId: process.env.NETSUITE_CLIENT_ID,
    clientSecret: process.env.NETSUITE_CLIENT_SECRET,
  };
}

export function isNetSuiteConfigured(): boolean {
  const { accountId, clientId, clientSecret } = getNetSuiteConfig();
  return Boolean(accountId && clientId && clientSecret);
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) {
    return cachedToken.access_token;
  }

  const { accountId, clientId, clientSecret } = getNetSuiteConfig();
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("NetSuite credentials not configured");
  }

  const tokenUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "NetSuite token request failed");
    throw new Error(`NetSuite token request failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.access_token;
}

async function netsuiteRequest<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const { accountId } = getNetSuiteConfig();
  const token = await getAccessToken();

  const baseUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1`;
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "prefer": "transient",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, url, body: text }, "NetSuite API request failed");
    throw new Error(`NetSuite API request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

const SUITEQL_PAGE_SIZE = 1000;

async function netsuiteSuiteQL<T>(baseQuery: string): Promise<{ items: T[] }> {
  const { accountId } = getNetSuiteConfig();
  const allItems: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const token = await getAccessToken();
    const url = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql?limit=${SUITEQL_PAGE_SIZE}&offset=${offset}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "prefer": "transient",
      },
      body: JSON.stringify({ q: baseQuery }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, url, query: baseQuery, body: text }, "NetSuite SuiteQL request failed");
      throw new Error(`NetSuite SuiteQL request failed: ${response.status} ${text}`);
    }

    const page = await response.json() as { items: T[]; hasMore?: boolean; totalResults?: number };
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
  const result = await netsuiteSuiteQL<{ id: string; name: string; parent: string | null }>(
    "SELECT id, name, parent FROM ItemCategory ORDER BY name"
  );

  return result.items.map((row) => ({
    id: String(row.id),
    name: row.name,
    parent: row.parent ? String(row.parent) : null,
  }));
}

export async function fetchNetSuiteItems(): Promise<NetSuiteItem[]> {
  const result = await netsuiteSuiteQL<{
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
