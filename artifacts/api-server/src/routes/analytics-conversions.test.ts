import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as drizzle from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { analyticsEventsTable } from "@workspace/db";
import { GetVendorConversionsQueryParams, GetVendorConversionsResponse } from "@workspace/api-zod";
import { analyticsWhere } from "../lib/analytics-filters";
import { buildVendorConversions } from "../lib/vendor-conversions";

test("conversion endpoint validates filters, preserves admin gate and uses shared window/admin scope", async () => {
  let handler: Function;
  let gate: Function;
  let where: any;
  let queries = 0;
  const adminGate = () => {};
  const deps: Record<string, any> = {
    "drizzle-orm": drizzle,
    "@workspace/db": {
      analyticsEventsTable,
      db: { select: () => ({ from: () => ({ where: async (condition: any) => {
        queries++;
        where = condition;
        return [{ id: 1, employeeId: "42", eventType: "vendor_site_visit", metadata: { vendorDomain: "vendor.test", visitId: "visit-12345678" } }];
      } }) }) },
    },
    "@workspace/api-zod": { GetVendorConversionsQueryParams, GetVendorConversionsResponse },
    "../lib/analytics-filters": { analyticsWhere },
    "../lib/employees": {
      getAdminEmployeeIds: async () => ["99"],
      getEmployeeNames: async () => new Map([["42", "Fixture User"]]),
    },
    "../lib/vendor-conversions": { buildVendorConversions },
  };
  const exports: any = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./analytics-conversions.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  exports.registerAnalyticsConversions({ get: (path: string, auth: Function, fn: Function) => {
    assert.equal(path, "/admin/analytics/conversions"); gate = auth; handler = fn;
  } }, adminGate);
  assert.equal(gate!, adminGate);
  const send = async (query: any) => {
    const res: any = { code: 200, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; } };
    await handler!({ query, log: { error() {} } }, res);
    return res;
  };
  const response = await send({ range: "yesterday", includeAdmins: "0" });
  assert.equal(response.code, 200);
  assert.equal(response.body.rows[0].employeeName, "Fixture User");
  let sql = new PgDialect().sqlToQuery(where);
  assert.ok(sql.sql.includes('"created_at" >=') && sql.sql.includes('"created_at" <'));
  assert.ok(sql.sql.includes('"employee_id" not in'));
  assert.ok(sql.params.includes("99"));
  await send({ range: "90d", includeAdmins: "1" });
  sql = new PgDialect().sqlToQuery(where);
  assert.ok(!sql.sql.includes('"employee_id" not in'));
  assert.equal((await send({ range: "invalid" })).code, 400);
  assert.equal((await send({ includeAdmins: "yes" })).code, 400);
  assert.equal(queries, 2);
});
