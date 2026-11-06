// Richelieu prices for QuickAdd (11/6/2026). Richelieu shows prices only to a signed-in account, and Consumers has
// one shared account. Gib (11/6): "We have a service agreement with Richelieu for automated sign in", so the
// Product Selector signs in here, on the server, with that account and reads the price of the product page a rep has
// open; QuickAdd asks for it. The account's email and password are Replit Secrets (RICHELIEU_EMAIL,
// RICHELIEU_PASSWORD) that Gib enters himself; they are never logged or sent anywhere but Richelieu's own sign-in
// form. The session cookies live in this process only and never go to a browser.
//
// Care for the shared account: one sign-in at a time; a failed sign-in waits 30 minutes before trying again (repeated
// wrong passwords could lock the account everyone uses); a CAPTCHA or a verification code stops it for 6 hours and is
// reported (a person has to look); requests to Richelieu are paced one per second (its robots.txt crawl delay); prices
// are cached for 6 hours per page.
import https from "node:https";
import { logger } from "./logger";

export const RICHELIEU_HOST = "www.richelieu.com";
const ORIGIN = `https://${RICHELIEU_HOST}`;
const USER_AGENT = "ConsumersProductSelector/1.0 (+https://consumersstore.com)";
export const RICHELIEU_SECRET_NAMES = ["RICHELIEU_EMAIL", "RICHELIEU_PASSWORD"] as const;

const CACHE_MS = 6 * 3600_000;
const CACHE_MAX = 500;
const FAILED_SIGN_IN_WAIT_MS = 30 * 60_000;
const HUMAN_CHECK_WAIT_MS = 6 * 3600_000;
const PACE_MS = 1000;

export interface RawResponse { status: number; location: string | null; setCookies: string[]; body: string }
export type Transport = (method: "GET" | "POST", path: string, headers: Record<string, string>, body?: string) => Promise<RawResponse>;

// Richelieu's response headers are larger than Node's fetch accepts (its cookies), so plain https with a larger limit.
export const httpsTransport: Transport = (method, path, headers, body) => new Promise((resolve, reject) => {
  const req = https.request({
    host: RICHELIEU_HOST, path, method, maxHeaderSize: 131072, timeout: 20000,
    headers: {
      "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9",
      ...headers, ...(body != null ? { "Content-Length": String(Buffer.byteLength(body)) } : {}),
    },
  }, res => {
    const chunks: Buffer[] = [];
    let size = 0;
    res.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 5_000_000) { req.destroy(new Error("Richelieu page too large")); return; }
      chunks.push(c);
    });
    res.on("end", () => resolve({
      status: res.statusCode ?? 0,
      location: typeof res.headers.location === "string" ? res.headers.location : null,
      setCookies: res.headers["set-cookie"] ?? [],
      body: Buffer.concat(chunks).toString("utf8"),
    }));
    res.on("error", reject);
  });
  req.on("timeout", () => req.destroy(new Error("Richelieu did not answer in time")));
  req.on("error", reject);
  if (body != null) req.write(body);
  req.end();
});

// The page path to read, from the address of the Richelieu page the rep has open. Only Richelieu's own product pages.
export function richelieuPagePath(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== "https:" || u.hostname !== RICHELIEU_HOST) return null;
    if (!/^\/(us|ca)\/(en|fr)\/[^?#]+$/i.test(u.pathname) || u.pathname.length > 500) return null;
    return u.pathname; // the SKU is in the path (".../sku-08392"); query strings are tracking
  } catch {
    return null;
  }
}

export function richelieuSkuFromPath(path: string): string | null {
  const m = /\/sku-([A-Za-z0-9.-]{2,40})(?:\/|$)/.exec(path);
  return m ? m[1] : null;
}

const decode = (s: string) => s.replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#36;|&dollar;/g, "$")
  .replace(/&#039;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const textOf = (html: string) => decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// A signed-out product page has the "Sign in to view prices" button (class pms-ViewPrice_Button), in either language.
export const isSignedOutPage = (html: string) => /class="pms-ViewPrice_Button"|Sign in to view prices/i.test(html);

const LIST_LABEL = /\b(list|retail|msrp|suggested|catalog(?:ue)?|regular)\b|prix (?:de )?liste|prix de d[ée]tail|prix courant/i;
const NOT_LIST_LABEL = /\b(your|net|cost|dealer|special|sale|promo|discount|rebate|save)\b|votre prix|co[uû]tant|rabais|[ée]conomi/i;

export interface RichelieuPagePrices {
  signedOut: boolean;
  sku: string | null;
  // Every amount shown in the product's price box, with the words before it (for setting up; never sent to QuickAdd).
  prices: { label: string; amount: number; after: string }[];
  // The page's own analytics price (0 when signed out).
  analyticsPrice: number | null;
  // The amount labeled as a list / retail price, if the page shows one. The only price QuickAdd gets.
  listPrice: number | null;
  boxText: string;
}

export function parseRichelieuPage(html: string, sku: string | null = null): RichelieuPagePrices {
  const signedOut = isSignedOutPage(html);
  const at = html.indexOf('class="pms-ImagePriceBox"');
  // The box's text, one piece per element, up to its ADD TO CART button.
  let nodes = at >= 0
    ? html.slice(at, at + 12000).replace(/^[^>]*>/, "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .split(/<[^>]+>/).map(s => decode(s).replace(/\s+/g, " ").trim()).filter(Boolean)
    : [];
  const end = nodes.findIndex(n => /^(ADD TO CART|AJOUTER AU PANIER)$/i.test(n));
  if (end >= 0) nodes = nodes.slice(0, end);
  const box = nodes.join(" | ").slice(0, 1500);
  const prices: RichelieuPagePrices["prices"] = [];
  const money = /(?:US\s*)?\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,4})?|\d+(?:\.\d{1,4})?)|(\d{1,3}(?:[  ]\d{3})*,\d{2,4}|\d+,\d{2,4})\s*\$/g;
  const unitLike = (s: string | undefined) => !!s && /^(\/|per\b|par\b|each\b|ea\b|ch\.|un\.)/i.test(s);
  const hasMoney = (s: string) => new RegExp(money.source).test(s);
  nodes.forEach((node, i) => {
    let last = 0;
    for (let m; (m = money.exec(node)); ) {
      const amount = m[1] ? Number(m[1].replace(/,/g, "")) : Number(m[2].replace(/[  ]/g, "").replace(",", "."));
      // The words before the amount in its own element, else the element before it (a label span).
      let label = node.slice(last, m.index).replace(/[|:•\-–\s]+$/, "").trim();
      if (!label && i > 0 && !hasMoney(nodes[i - 1]) && !unitLike(nodes[i - 1])) label = nodes[i - 1].replace(/[:\s]+$/, "");
      let after = node.slice(money.lastIndex).trim();
      if (!after && unitLike(nodes[i + 1])) after = nodes[i + 1];
      if (Number.isFinite(amount) && amount > 0) prices.push({ label: label.slice(-60), amount, after: after.slice(0, 24) });
      last = money.lastIndex;
    }
    money.lastIndex = 0;
  });
  const ga = /gaEvent\('view_item',\s*JSON\.parse\(`[^`]*?"price":\s*([\d.]+)/.exec(html);
  const analyticsPrice = ga ? Number(ga[1]) : null;
  const list = prices.find(p => LIST_LABEL.test(p.label) && !NOT_LIST_LABEL.test(p.label));
  return { signedOut, sku, prices, analyticsPrice, listPrice: list ? list.amount : null, boxText: box };
}

export class RichelieuBlockedError extends Error {
  constructor(message: string, readonly until: number) { super(message); }
}
export class RichelieuNotConfiguredError extends Error {}

type Clock = () => number;
type Sleep = (ms: number) => Promise<void>;

export class RichelieuClient {
  private jar = new Map<string, string>();
  private signedInAt = 0;
  private signingIn: Promise<void> | null = null;
  private blockedUntil = 0;
  private blockedReason = "";
  private lastError = "";
  private lastSignInError = "";
  private paceChain: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;
  private cache = new Map<string, { at: number; page: RichelieuPagePrices }>();

  constructor(
    private readonly transport: Transport = httpsTransport,
    private readonly env: () => { email?: string; password?: string } = () => ({ email: process.env.RICHELIEU_EMAIL, password: process.env.RICHELIEU_PASSWORD }),
    private readonly now: Clock = Date.now,
    private readonly sleep: Sleep = ms => new Promise(r => setTimeout(r, ms)),
  ) {}

  configured(): boolean {
    const { email, password } = this.env();
    return !!(email && email.trim() && password);
  }

  status() {
    return {
      configured: this.configured(),
      signedIn: this.signedInAt > 0,
      signedInAt: this.signedInAt ? new Date(this.signedInAt).toISOString() : null,
      blocked: this.blockedUntil > this.now() ? { reason: this.blockedReason, until: new Date(this.blockedUntil).toISOString() } : null,
      lastError: this.lastError || null,
      lastSignInError: this.lastSignInError || null,
      cachedPages: this.cache.size,
    };
  }

  private cookieHeader(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private keepCookies(setCookies: string[]) {
    for (const c of setCookies) {
      const [pair, ...attrs] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim(), value = pair.slice(eq + 1).trim();
      const expired = attrs.some(a => /^\s*max-age=0\s*$/i.test(a))
        || attrs.some(a => { const m = /^\s*expires=(.+)$/i.exec(a); return !!m && Date.parse(m[1]) < this.now(); })
        || value === "" || value === "deleted";
      if (expired) this.jar.delete(name); else this.jar.set(name, value);
    }
  }

  // One request to Richelieu, paced, with this session's cookies; follows Richelieu-only redirects.
  private async send(method: "GET" | "POST", path: string, body?: string, extra: Record<string, string> = {}): Promise<RawResponse & { path: string }> {
    let current = path, m: "GET" | "POST" = method, b = body;
    for (let hop = 0; hop < 6; hop++) {
      const turn = this.paceChain.then(async () => {
        const wait = this.lastRequestAt + PACE_MS - this.now();
        if (wait > 0) await this.sleep(wait);
        this.lastRequestAt = this.now();
      });
      this.paceChain = turn.catch(() => {});
      await turn;
      const headers: Record<string, string> = { ...extra };
      const cookie = this.cookieHeader();
      if (cookie) headers.Cookie = cookie;
      if (m === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
      const res = await this.transport(m, current, headers, b);
      this.keepCookies(res.setCookies);
      if (res.status >= 300 && res.status < 400 && res.location) {
        const next = new URL(res.location, `${ORIGIN}${current}`);
        if (next.hostname !== RICHELIEU_HOST) return { ...res, path: current };
        current = next.pathname + next.search;
        m = "GET"; b = undefined;
        continue;
      }
      return { ...res, path: current };
    }
    throw new Error("Richelieu redirected too many times");
  }

  private block(reason: string, waitMs: number) {
    this.blockedUntil = this.now() + waitMs;
    this.blockedReason = reason;
    this.signedInAt = 0;
    this.jar.clear();
  }

  private assertNotBlocked() {
    if (this.blockedUntil > this.now()) throw new RichelieuBlockedError(this.blockedReason, this.blockedUntil);
  }

  // Signs in with the shared account: Richelieu's own form (POST /us/en/user/login: checkLogin, redirect, email,
  // password). Then checks with the page asked for. Never logs the email, the password or the cookies.
  private async signIn(probePath: string): Promise<void> {
    if (this.signingIn) return this.signingIn;
    this.signingIn = (async () => {
      this.assertNotBlocked();
      const { email, password } = this.env();
      if (!email || !password) throw new RichelieuNotConfiguredError("Richelieu pricing is not set up yet.");
      this.jar.clear();
      this.signedInAt = 0;
      await this.send("GET", "/us/en/");
      const form = new URLSearchParams({
        checkLogin: "1",
        redirect: encodeURIComponent(`${ORIGIN}${probePath}`), // as the page's own hidden field holds it
        email: email.trim(),
        password,
      }).toString();
      const res = await this.send("POST", "/us/en/user/login", form, { Origin: ORIGIN, Referer: `${ORIGIN}/us/en/` });
      const human = humanCheck(res.body);
      if (human) {
        this.block(human, HUMAN_CHECK_WAIT_MS);
        logger.error({ reason: human }, "Richelieu sign-in asked for a person; stopped for 6 hours");
        throw new RichelieuBlockedError(human, this.blockedUntil);
      }
      const page = res.path === probePath ? res : await this.send("GET", probePath);
      if (isSignedOutPage(page.body)) {
        this.lastSignInError = signInMessage(res.body);
        this.block("Richelieu did not accept the sign-in (check RICHELIEU_EMAIL and RICHELIEU_PASSWORD)", FAILED_SIGN_IN_WAIT_MS);
        logger.error({ status: res.status, message: this.lastSignInError }, "Richelieu sign-in failed; next try in 30 minutes");
        throw new RichelieuBlockedError(this.blockedReason, this.blockedUntil);
      }
      this.signedInAt = this.now();
      this.lastSignInError = "";
      logger.info("Richelieu sign-in ok");
    })().finally(() => { this.signingIn = null; });
    return this.signingIn;
  }

  // The prices on one product page (cached 6 hours). Signs in when there is no session or when Richelieu has ended it.
  async page(path: string, { fresh = false } = {}): Promise<RichelieuPagePrices & { cached: boolean; checkedAt: string }> {
    if (!this.configured()) throw new RichelieuNotConfiguredError("Richelieu pricing is not set up yet.");
    const hit = this.cache.get(path);
    if (!fresh && hit && this.now() - hit.at < CACHE_MS) return { ...hit.page, cached: true, checkedAt: new Date(hit.at).toISOString() };
    this.assertNotBlocked();
    try {
      if (!this.signedInAt) await this.signIn(path);
      let res = await this.send("GET", path);
      if (isSignedOutPage(res.body)) {
        // Richelieu ended the session: sign in again, once.
        this.signedInAt = 0;
        await this.signIn(path);
        res = await this.send("GET", path);
      }
      if (res.status === 404) throw new Error("Richelieu has no page at this address");
      if (res.status >= 400) throw new Error(`Richelieu answered ${res.status}`);
      const page = parseRichelieuPage(res.body, richelieuSkuFromPath(path));
      if (page.signedOut) throw new Error("Richelieu still shows the page signed out");
      const at = this.now();
      this.cache.set(path, { at, page });
      if (this.cache.size > CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
      this.lastError = "";
      return { ...page, cached: false, checkedAt: new Date(at).toISOString() };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }
}

// A CAPTCHA or a verification code at sign-in: a person has to deal with it, so the server stops.
// Every Richelieu page's own script mentions "div.g-recaptcha" (a form check), so only a CAPTCHA widget or its script
// counts, not the word.
export function humanCheck(html: string): string {
  if (/<div[^>]+class="[^"]*\b(?:g-recaptcha|h-captcha|cf-turnstile)\b|data-sitekey=|<script[^>]+src="[^"]*(?:recaptcha\/api|hcaptcha\.com|challenges\.cloudflare\.com\/turnstile)/i.test(html)) {
    return "Richelieu asked for a CAPTCHA at sign-in";
  }
  if (/verification code|code de v[ée]rification|two-factor|\b2fa\b|one-time (?:pass)?code|authenticator app/i.test(html)) return "Richelieu asked for a verification code at sign-in";
  return "";
}

// The words of Richelieu's sign-in error, if the page shows one, without any email address in them.
export function signInMessage(html: string): string {
  const re = /<[^>]+class="[^"]*(?:error|alert|erreur|invalid)[^"]*"[^>]*>([\s\S]{0,600}?)<\/(?:div|p|span|li)>/gi;
  for (let m; (m = re.exec(html)); ) {
    const t = textOf(m[1]).replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]").slice(0, 200);
    if (t) return t;
  }
  return "";
}

export const richelieu = new RichelieuClient();
