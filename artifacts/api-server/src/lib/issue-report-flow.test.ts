import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as schemas from "@workspace/api-zod";
import * as privacy from "./issue-diagnostics";

// Run real route handlers with an in-memory store and a fake NetSuite writer.
// No live employee sessions, storage objects or NetSuite cases are created.
function harness() {
  const records: Record<string, any>[] = [];
  const registered = new Map<string, Function[]>();
  let writes = 0;
  let failCreate = false;
  const table = new Proxy({}, { get: (_t, key) => String(key) });
  const matches = (row: any, expression: any): boolean => !expression || (expression.and
    ? expression.and.every((entry: any) => matches(row, entry))
    : expression.gt ? row[expression.key] > expression.value : row[expression.key] === expression.value);
  const db = {
    select: (selection?: any) => {
      let filter: any;
      const result = () => selection?.total ? [{ total: records.filter(row => matches(row, filter)).length }]
        : records.filter(row => matches(row, filter)).map(row => selection?.path ? { path: row.screenshotPath } : row);
      const chain: any = {
        from: () => chain, where: (value: any) => { filter = value; return chain; },
        limit: async () => result(), then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
      };
      return chain;
    },
    insert: () => {
      let value: any;
      const chain = { values: (input: any) => { value = input; return chain; }, onConflictDoNothing: () => chain,
        returning: async () => {
          if (records.some(row => row.id === value.id)) return [];
          const row = { createdAt: new Date(), caseId: null, caseNumber: null, caseStatus: null, statusCheckedAt: null, ...value };
          records.push(row); return [row];
        } };
      return chain;
    },
    update: () => ({ set: (value: any) => ({ where: async (filter: any) => {
      for (const row of records.filter(row => matches(row, filter))) Object.assign(row, value);
    } }) }),
  };
  const router: any = { use: () => router };
  for (const method of ["post", "get"]) router[method] = (path: string, ...handlers: Function[]) => { registered.set(`${method} ${path}`, handlers); return router; };
  const services = {
    findEmployeeReport: async (id: string, employeeId: string) => records.filter(row => row.id === id && row.employeeId === employeeId),
    createReportedCase: async () => { writes++; if (failCreate) throw new Error("Network response lost"); return "12345"; },
    refreshIssueCaseStatuses: async () => {
      for (const row of records.filter(row => row.caseId)) { row.caseNumber = "74756"; row.caseStatus = "Open"; }
    },
    listIssuePage: async () => records, issueTotal: async () => records.length,
  };
  const deps: Record<string, unknown> = {
    express: { Router: () => router },
    "drizzle-orm": { eq: (key: string, value: unknown) => ({ key, value }), and: (...and: any[]) => ({ and }), gt: (key: string, value: unknown) => ({ key, value, gt: true }), sql: () => "" },
    "@workspace/db": { db, issueReportsTable: table, issueScreenshotUploadsTable: table },
    "@workspace/api-zod": schemas,
    "../lib/session": { requireEmployee: () => {} },
    "../lib/employees": { getEmployeeByNetsuiteId: async () => ({ firstName: "Test", lastName: "Employee" }), isAdminRecord: () => true },
    "../lib/netsuite": { isNetSuiteConfigured: () => true },
    "../lib/objectStorage": { ObjectStorageService: class {} },
    "../lib/issue-reports": services,
    "../lib/issue-diagnostics": privacy,
  };
  const source = readFileSync(new URL("../routes/issues.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(compiled, {
    exports: {}, require: (id: string) => { assert.ok(id in deps, `Unexpected import ${id}`); return deps[id]; },
    Date, ReadableStream, Buffer,
  });
  const input = {
    requestId: "123e4567-e89b-42d3-a456-426614174000", subject: "Reported issue", detail: "Details",
    pageUrl: "https://example.com/special-order?session=secret", browserInfo: "Browser", browserLogs: [],
  };
  async function submit(body = input, employeeId = "42") {
    const response: any = { locals: { employeeId }, code: 200, status(code: number) { this.code = code; return this; }, json(value: unknown) { this.body = value; return this; } };
    const handlers = registered.get("post /cases")!;
    await handlers[handlers.length - 1]({ body, log: { error() {}, warn() {} } }, response);
    return response;
  }
  return { records, submit, input, writes: () => writes, fail: () => { failCreate = true; } };
}

test("submission saves reporter and diagnostics and returns the real case number", async () => {
  const h = harness();
  const response = await h.submit();
  assert.equal(response.code, 200);
  assert.equal(response.body.caseNumber, "74756");
  assert.equal(h.records[0]?.employeeId, "42");
  assert.equal(h.records[0]?.pageUrl, "https://example.com/special-order");
  assert.equal(h.records[0]?.caseStatus, "Open");
  assert.equal(h.records[0]?.submissionState, "submitted");
  assert.ok(h.records[0]?.captureError);
});

test("retrying the same report cannot create a second NetSuite case", async () => {
  const h = harness();
  await h.submit();
  const response = await h.submit();
  assert.equal(response.code, 200);
  assert.equal(h.writes(), 1);
  assert.equal(h.records.length, 1);
});

test("an ambiguous NetSuite failure is retained and never automatically written again", async () => {
  const h = harness(); h.fail();
  assert.equal((await h.submit()).code, 502);
  assert.equal(h.records[0]?.submissionState, "failed");
  assert.equal((await h.submit()).code, 409);
  assert.equal(h.writes(), 1);
});

test("invalid or blank report inputs do not create cases", async () => {
  const h = harness();
  assert.equal((await h.submit({ ...h.input, subject: " " })).code, 400);
  assert.equal((await h.submit({ ...h.input, pageUrl: "javascript:alert(1)" })).code, 400);
  assert.equal(h.writes(), 0);
});
