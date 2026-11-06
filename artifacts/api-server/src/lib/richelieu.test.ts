import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RichelieuClient, RichelieuBlockedError, RichelieuNotConfiguredError, humanCheck, parseRichelieuPage,
  richelieuPagePath, richelieuSkuFromPath, signInMessage, type RawResponse, type Transport,
} from "./richelieu";

const PAGE = "/us/en/category/tools-and-shop-supplies/hand-tools/hammers-and-mallets/pry-wrecking-and-aligning-bars/flat-pry-bar/1428668/sku-08392";
// The signed-out price box as Richelieu serves it (11/6), and a signed-in one with labeled prices.
const SIGNED_OUT = `<script>window.gaEvent('view_item',JSON.parse(\`{"item_name":"Flat Pry Bar","price":0}\`));
  function submitFormIsWorking() { if (this.querySelector('div.g-recaptcha')) {} }</script>
  <div class="pms-ImagePriceBox"><div class="name">Flat Pry Bar</div> Product # 08392 <div class="pms-ViewPrice">
  <a onclick="popLogin2(event, 'view-price-button');" href="javascript:void(0)" class="pms-ViewPrice_Button" rel="nofollow">Sign in to view prices</a></div>
  <button>ADD TO CART</button> 40 by case</div>`;
const signedIn = (box: string) => `<script>window.gaEvent('view_item',JSON.parse(\`{"item_name":"Flat Pry Bar","price":7.8}\`));</script>
  <div class="pms-ImagePriceBox"><div class="name">Flat Pry Bar</div> Product # 08392 ${box}<button>ADD TO CART</button> 40 by case</div>`;

test("only Richelieu product pages are read, by path", () => {
  assert.equal(richelieuPagePath(`https://www.richelieu.com${PAGE}?utm_source=x`), PAGE);
  for (const bad of [`http://www.richelieu.com${PAGE}`, `https://richelieu.com.evil.test${PAGE}`, "https://www.richelieu.com/",
    "javascript:alert(1)", "https://www.kohler.com/us/en/x"]) assert.equal(richelieuPagePath(bad), null, bad);
  assert.equal(richelieuSkuFromPath(PAGE), "08392");
});

test("a signed-out page has no prices", () => {
  const p = parseRichelieuPage(SIGNED_OUT, "08392");
  assert.equal(p.signedOut, true);
  assert.deepEqual(p.prices, []);
  assert.equal(p.listPrice, null);
  assert.equal(p.analyticsPrice, 0);
  assert.equal(humanCheck(SIGNED_OUT), ""); // the page's own "div.g-recaptcha" script is not a CAPTCHA
});

test("signed in: the labeled list price is the one QuickAdd gets; our cost never is", () => {
  const p = parseRichelieuPage(signedIn(`<div class="pms-Price"><span>List price</span> <b>$12.50</b> /ea</div>
    <div class="pms-Price"><span>Your price</span> <b>$7.80</b> /ea</div>`), "08392");
  assert.equal(p.signedOut, false);
  assert.deepEqual(p.prices.map(x => [x.label, x.amount]), [["List price", 12.5], ["Your price", 7.8]]);
  assert.equal(p.listPrice, 12.5);
  assert.equal(p.analyticsPrice, 7.8);
  // Only an account price: no list price is guessed.
  assert.equal(parseRichelieuPage(signedIn(`<span>Your price</span> $7.80`)).listPrice, null);
  assert.equal(parseRichelieuPage(signedIn(`<span>Price</span> $7.80`)).listPrice, null);
  // French pages and thousands.
  assert.equal(parseRichelieuPage(signedIn(`<span>Prix de liste</span> 1 012,50 $`)).listPrice, 1012.5);
  assert.equal(parseRichelieuPage(signedIn(`<span>Retail price:</span> $1,012.50`)).listPrice, 1012.5);
});

test("11/6, real account markup: the account price is the 1-unit price break (our cost); no list price on the page", () => {
  const html = `<div class="pms-ImagePriceBox"><div class="name">Modern Metal Pull - 4085</div> Product # <strong>4085750219415</strong>
    <a><img>Order history</a><div class="pms-PriceBlock count2"><ul>
    <li class="pms-PriceBlock_Main" data-min="1" data-max="9"><div class="pms-PriceBlock_Breaks"><div class="pms-PriceBlock_BreaksPrice">$173.49</div></div></li>
    <li class="pms-PriceBlock_Main" data-min="10" data-max="9223372036854775807"><div class="pms-PriceBlock_Breaks"><div class="pms-PriceBlock_BreaksPrice">$165.00</div></div></li>
    </ul></div><div class="pms-AddCartBlocTopPrixEtAutres"><div class="pms-AddCartBlocTop_UnitPrice ">$173.49</div></div><button>ADD TO CART</button></div>`;
  const p = parseRichelieuPage(html, "4085750219415");
  assert.equal(p.signedOut, false);
  assert.equal(p.listPrice, null);
  assert.equal(p.accountPrice, 173.49);
  // Only the cart's unit price.
  assert.equal(parseRichelieuPage(`<div class="pms-AddCartBlocTop_UnitPrice">$1,012.50</div>`).accountPrice, 1012.5);
  // Signed out: none.
  assert.equal(parseRichelieuPage(SIGNED_OUT).accountPrice, null);
});

test("11/6: a corporate login sees our cost with 'Suggested retail' beside it: the suggested retail is the list price", () => {
  const html = `<div class="pms-ImagePriceBox"><div class="name">Transitional Metal Pull - 8695</div> Product # <strong>BP869596195</strong>
    <div>Purchase planner</div><a><img>Order history</a><div class="pms-PriceBlock count1"><ul>
    <li class="pms-PriceBlock_Main" data-min="1" data-max="9223372036854775807"><div class="pms-PriceBlock_Breaks"><div class="pms-PriceBlock_BreaksPrice">$7.49</div></div>
    <div class="pms-SuggestedRetail"><span>Suggested retail</span><span>$18.49</span></div></li></ul></div><button>ADD TO CART</button></div>`;
  const p = parseRichelieuPage(html, "BP869596195");
  assert.equal(p.accountPrice, 7.49); // the corporate login's own price: our cost
  assert.equal(p.listPrice, 18.49); // what SmartAdd gets (listPrice comes first)
  // The shared sales login sees only the list price: $18.49 in the 1-unit break (checked live 11/6).
  const sales = parseRichelieuPage(`<div class="pms-ImagePriceBox">Product # <strong>BP869596195</strong><a>Order history</a>
    <li class="pms-PriceBlock_Main" data-min="1" data-max="9"><div class="pms-PriceBlock_BreaksPrice">$18.49</div></li><button>ADD TO CART</button></div>`);
  assert.equal(sales.listPrice ?? sales.accountPrice, 18.49);
});

test("a CAPTCHA widget or a verification code at sign-in stops it", () => {
  assert.match(humanCheck(`<div class="g-recaptcha" data-sitekey="abc"></div>`), /CAPTCHA/);
  assert.match(humanCheck(`<script src="https://www.google.com/recaptcha/api.js"></script>`), /CAPTCHA/);
  assert.match(humanCheck(`<p>Enter the verification code we sent</p>`), /verification code/);
  assert.equal(signInMessage(`<div class="atc-PopoverError"></div><div class="alert alert-danger">Invalid password for pat@x.com</div>`), "Invalid password for [email]");
});

// A fake Richelieu: cookies, the sign-in form, and product pages signed in or out by session.
function fakeRichelieu(opts: { password?: string; loginBody?: string; expireAfter?: number } = {}) {
  const calls: { method: string; path: string; headers: Record<string, string>; body?: string }[] = [];
  let session = 0, pagesSinceSignIn = 0;
  const signedInSessions = new Set<number>(); // a shared account can have several sessions open
  const transport: Transport = async (method, path, headers, body) => {
    calls.push({ method, path, headers, body });
    const r = (status: number, html: string, extra: Partial<RawResponse> = {}): RawResponse => ({ status, location: null, setCookies: [], body: html, ...extra });
    if (method === "GET" && path === "/us/en/") {
      session++;
      return r(200, "<html>home</html>", { setCookies: [`PHPSESSID=s${session}; path=/; HttpOnly`, "TS011f89c2=f5; path=/"] });
    }
    if (method === "POST" && path === "/us/en/user/login") {
      const form = new URLSearchParams(body);
      if (opts.loginBody) return r(200, opts.loginBody);
      if (form.get("password") === (opts.password ?? "right") && form.get("checkLogin") === "1") {
        signedInSessions.add(Number((/PHPSESSID=s(\d+)/.exec(headers.Cookie ?? "") ?? [])[1]));
        pagesSinceSignIn = 0;
        return r(302, "", { location: decodeURIComponent(form.get("redirect")!) });
      }
      return r(200, `<form action="/us/en/user/login"><div class="alert alert-danger">Invalid email or password</div></form>`);
    }
    if (method === "GET" && path === PAGE) {
      const sid = Number((/PHPSESSID=s(\d+)/.exec(headers.Cookie ?? "") ?? [])[1]);
      const expired = opts.expireAfter != null && pagesSinceSignIn >= opts.expireAfter;
      if (sid && signedInSessions.has(sid) && !expired) {
        pagesSinceSignIn++;
        return r(200, signedIn(`<span>List price</span> $12.50 <span>Your price</span> $7.80`));
      }
      return r(200, SIGNED_OUT);
    }
    return r(404, "not found");
  };
  return { transport, calls };
}

const client = (transport: Transport, creds = { email: "shared@consumers.test", password: "right" }, clock = { t: 1_000_000 }) =>
  new RichelieuClient(transport, () => creds, () => clock.t, async ms => { clock.t += ms; });

test("not set up: no Richelieu request at all", async () => {
  const f = fakeRichelieu();
  const c = client(f.transport, { email: "", password: "" });
  assert.equal(c.configured(), false);
  await assert.rejects(c.page(PAGE), RichelieuNotConfiguredError);
  assert.equal(f.calls.length, 0);
});

test("signs in with Richelieu's form, carries the session cookie, caches the page, keeps secrets out of the status", async () => {
  const f = fakeRichelieu();
  const c = client(f.transport);
  const p = await c.page(PAGE);
  assert.equal(p.listPrice, 12.5);
  assert.equal(p.cached, false);
  const login = f.calls.find(x => x.method === "POST")!;
  const form = new URLSearchParams(login.body);
  assert.equal(form.get("email"), "shared@consumers.test");
  assert.equal(form.get("checkLogin"), "1");
  assert.match(login.headers.Cookie, /PHPSESSID=s1/);
  const n = f.calls.length;
  assert.equal((await c.page(PAGE)).cached, true);
  assert.equal(f.calls.length, n); // from the cache
  const status = JSON.stringify(c.status());
  assert.ok(!status.includes("right") && !status.includes("shared@consumers.test") && !status.includes("PHPSESSID"));
  assert.equal(c.status().signedIn, true);
});

test("Richelieu ending the session: signs in again once and reads the page", async () => {
  const f = fakeRichelieu({ expireAfter: 2 });
  const c = client(f.transport);
  await c.page(PAGE);
  const again = await c.page(PAGE, { fresh: true });
  assert.equal(again.listPrice, 12.5);
  assert.equal(f.calls.filter(x => x.method === "POST").length, 2);
});

test("a refused sign-in waits 30 minutes before trying again (the shared account is never hammered)", async () => {
  const f = fakeRichelieu({ password: "other" });
  const clock = { t: 1_000_000 };
  const c = client(f.transport, undefined, clock);
  await assert.rejects(c.page(PAGE), RichelieuBlockedError);
  assert.equal(c.status().lastSignInError, "Invalid email or password");
  const n = f.calls.length;
  await assert.rejects(c.page(PAGE), RichelieuBlockedError);
  assert.equal(f.calls.length, n); // no new request while paused
  clock.t += 31 * 60_000;
  await assert.rejects(c.page(PAGE), RichelieuBlockedError);
  assert.equal(f.calls.filter(x => x.method === "POST").length, 2);
});

test("a CAPTCHA at sign-in stops it for 6 hours", async () => {
  const f = fakeRichelieu({ loginBody: `<form><div class="g-recaptcha" data-sitekey="k"></div></form>` });
  const c = client(f.transport);
  await assert.rejects(c.page(PAGE), (e: unknown) => e instanceof RichelieuBlockedError && /CAPTCHA/.test(e.message));
  assert.match(String(c.status().blocked?.reason), /CAPTCHA/);
});

test("11/6 (#3): a browser gets its own new session's cookies, without F5 or analytics cookies; the server's session stays", async () => {
  const f = fakeRichelieu();
  const c = client(f.transport);
  await c.page(PAGE); // the server's own session (s1)
  const cookies = await c.browserSession(); // a new one (s2)
  assert.deepEqual(cookies.map(x => x.name), ["PHPSESSID"]);
  assert.equal(cookies[0].value, "s2");
  assert.equal(cookies[0].httpOnly, true);
  assert.equal(cookies[0].path, "/");
  // The server's own session is still s1: the next price lookup does not sign in again.
  const posts = f.calls.filter(x => x.method === "POST").length;
  await c.page(PAGE, { fresh: true });
  assert.equal(f.calls.filter(x => x.method === "POST").length, posts);
  assert.match(f.calls[f.calls.length - 1].headers.Cookie, /PHPSESSID=s1/);
  assert.equal(c.browserSessionStatus().browserSessions, 1);
});

test("11/6 (#3): a refused browser sign-in pauses every sign-in (one shared account)", async () => {
  const f = fakeRichelieu({ password: "other" });
  const c = client(f.transport);
  await assert.rejects(c.browserSession(), RichelieuBlockedError);
  const n = f.calls.length;
  await assert.rejects(c.page(PAGE), RichelieuBlockedError);
  await assert.rejects(c.browserSession(), RichelieuBlockedError);
  assert.equal(f.calls.length, n);
});

test("requests to Richelieu are at least a second apart", async () => {
  const f = fakeRichelieu();
  const clock = { t: 1_000_000 };
  const times: number[] = [];
  const timed: Transport = async (...a) => { times.push(clock.t); return f.transport(...a); };
  const c = client(timed, undefined, clock);
  await c.page(PAGE);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 1000, `${times}`);
});
