import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret";
process.env.DATABASE_URL ??= "postgres://unused:unused@127.0.0.1:1/unused"; // the db pool is never queried here
const { signSession, verifySession, requireEmployee } = await import("./session");
const { fetchNetSuite } = await import("./netsuite");

test("a signed token round-trips to its employee id", () => {
  assert.equal(verifySession(signSession("4525")), "4525");
  assert.equal(verifySession(signSession("-5")), "-5");
});

test("missing, altered, forged and expired tokens are rejected", () => {
  const token = signSession("4525");
  const [payload, signature] = token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ e: "1", x: Date.now() + 1e9 })).toString("base64url");
  for (const bad of [
    undefined, null, "", "abc", `${payload}`, `${payload}.${signature}.x`,
    `${forgedPayload}.${signature}`, `${payload}.${signature.slice(0, -2)}AA`,
  ]) {
    assert.equal(verifySession(bad as any), null, String(bad));
  }
  const old = signSession("4525", Date.now() - 31 * 86400000);
  assert.equal(verifySession(old), null, "expired after 30 days");
});

test("estimate routes answer 401 without a valid sign-in token", async () => {
  for (const authorization of [undefined, "Bearer nope", `Basic ${signSession("4525")}`]) {
    let status = 0, body: any = null, nextCalled = false;
    const res: any = { locals: {}, status(s: number) { status = s; return this; }, json(b: any) { body = b; return this; } };
    await requireEmployee({ headers: authorization ? { authorization } : {} } as any, res, () => { nextCalled = true; });
    assert.equal(status, 401, String(authorization));
    assert.equal(body.code, "SIGN_IN_REQUIRED");
    assert.equal(nextCalled, false);
  }
});

test("NetSuite 429 (concurrency limit) is retried; other errors are not", async () => {
  const realFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = (async () => new Response("", { status: ++calls < 3 ? 429 : 200 })) as typeof fetch;
    assert.equal((await fetchNetSuite("https://example.test", { method: "PATCH" })).status, 200);
    assert.equal(calls, 3);
    calls = 0;
    globalThis.fetch = (async () => { calls++; return new Response("", { status: 400 }); }) as typeof fetch;
    assert.equal((await fetchNetSuite("https://example.test", { method: "PATCH" })).status, 400);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
