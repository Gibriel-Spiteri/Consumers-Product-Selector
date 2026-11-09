import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const monitorUrl = new URL("./startup-error-monitor.ts", import.meta.url).href;

for (const failure of [
  {
    name: "unhandled emitter error",
    code: `const { EventEmitter } = await import("node:events");
      setImmediate(() => new EventEmitter().emit("error",
        Object.assign(new Error("fixture socket failure"), { code: "ECONNRESET" })));`,
    message: "fixture socket failure",
    errorCode: "ECONNRESET",
    origin: "uncaughtException",
  },
  {
    name: "unhandled rejection",
    code: `Promise.reject(new Error("fixture startup rejection"));`,
    message: "fixture startup rejection",
    origin: "unhandledRejection",
  },
]) {
  test(`fatal diagnostics record ${failure.name} without suppressing exit`, () => {
    // A separate process is essential: the monitor must NOT keep a fatal process
    // alive. No app imports, database connection, or NetSuite sync are involved.
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "--input-type=module", "-e",
      `await import(${JSON.stringify(monitorUrl)}); ${failure.code}`,
    ], {
      env: { ...process.env, NODE_ENV: "production", LOG_LEVEL: "info" },
      encoding: "utf8", timeout: 15000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    const line = result.stdout.split("\n").find(line => line.startsWith("{"));
    assert.ok(line, `Expected structured fatal log; stderr: ${result.stderr}`);
    const log = JSON.parse(line);
    assert.equal(log.level, 60);
    assert.equal(log.err.message, failure.message);
    assert.ok(log.err.stack.includes(failure.message));
    assert.equal(log.origin, failure.origin);
    if (failure.errorCode) assert.equal(log.err.code, failure.errorCode);
  });
}
