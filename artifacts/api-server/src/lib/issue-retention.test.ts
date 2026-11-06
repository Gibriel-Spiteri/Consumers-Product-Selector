import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { issueScreenshotExpired, issueScreenshotExpiresAt, ISSUE_SCREENSHOT_EXPIRED } from "./issue-retention";

test("screenshots expire at twelve calendar months, not 365 days", () => {
  const created = new Date("2023-03-01T10:30:00Z");
  assert.equal(issueScreenshotExpiresAt(created).toISOString(), "2024-03-01T10:30:00.000Z");
  assert.equal(issueScreenshotExpired(created, new Date("2024-03-01T10:29:59.999Z")), false);
  assert.equal(issueScreenshotExpired(created, new Date("2024-03-01T10:30:00Z")), true);
  assert.equal(created.toISOString(), "2023-03-01T10:30:00.000Z");
});

test("leap-day creation clamps to February 28, preserving the UTC time", () => {
  assert.equal(issueScreenshotExpiresAt(new Date("2024-02-29T23:59:12Z")).toISOString(), "2025-02-28T23:59:12.000Z");
});

function loadModule(name: string, deps: Record<string, unknown>) {
  const source = readFileSync(new URL(name, import.meta.url), "utf8");
  const exports: Record<string, any> = {};
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, Date, setInterval, clearInterval, process: { env: {} },
    require: (id: string) => {
      assert.ok(id in deps, `Unexpected import: ${id}`);
      return deps[id];
    },
  });
  return exports;
}

test("new case includes the verified CPS admin link in both NetSuite detail fields", async () => {
  let payload: any;
  const module = loadModule("./issue-reports.ts", {
    "drizzle-orm": {}, "@workspace/db": {},
    "./netsuite": { netsuiteCreate: async (_path: string, input: any) => { payload = input; return "123"; } },
    "./issue-diagnostics": {},
  });
  await module.createReportedCase({ detail: "Test issue", pageUrl: "https://example.com/list", id: "test", browserInfo: "Browser", employeeId: "42", subject: "Issue" });
  for (const field of ["incomingMessage", "custevent_xprdetail"]) {
    assert.ok(payload[field].includes("CPS Admin: https://consumersstore.com/admin"));
    assert.ok(payload[field].includes("Page URL: https://example.com/list"));
  }
});

test("cleanup deletes bytes before clearing the path; failed deletes remain retryable", async () => {
  const events: string[] = [];
  const rows = [{ id: "ok", path: "/objects/ok" }, { id: "missing", path: "/objects/missing" }, { id: "failed", path: "/objects/failed" }];
  const table = new Proxy({}, { get: (_target, key) => String(key) });
  class Missing extends Error {}
  const module = loadModule("./issue-screenshot-purge.ts", {
    "drizzle-orm": { and: (...args: any[]) => args, eq: (key: string, value: string) => ({ key, value }), isNotNull: () => true, sql: () => true },
    "@workspace/db": {
      issueReportsTable: table, issueScreenshotUploadsTable: table,
      db: {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => rows }) }) }),
        update: () => ({ set: (value: any) => ({ where: async (filter: any[]) => {
          assert.equal(value.screenshotPath, null);
          assert.equal(value.captureError, ISSUE_SCREENSHOT_EXPIRED);
          events.push(`clear:${filter[0].value}`);
        } }) }),
        delete: () => ({ where: async () => { events.push("remove-grant"); } }),
      },
    },
    "./objectStorage": {
      ObjectNotFoundError: Missing,
      ObjectStorageService: class {
        async getObjectEntityFile(path: string) {
          if (path.endsWith("missing")) throw new Missing();
          return { delete: async () => {
            if (path.endsWith("failed")) throw new Error("Storage offline");
            events.push("delete:ok");
          } };
        }
      },
    },
    "./issue-retention": { ISSUE_SCREENSHOT_EXPIRED },
    "./logger": { logger: { info() {}, error() {} } },
  });
  await module.checkIssueScreenshotRetention();
  assert.deepEqual(events, ["delete:ok", "clear:ok", "remove-grant", "clear:missing", "remove-grant"]);
});
