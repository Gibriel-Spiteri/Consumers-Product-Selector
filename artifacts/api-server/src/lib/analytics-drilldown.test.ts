import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as drizzle from "drizzle-orm";
import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { GetAnalyticsDrilldownQueryParams, GetAnalyticsDrilldownResponse } from "@workspace/api-zod";

// Execute the real route with the real Drizzle timestamp decoder and response
// schema, without opening an app session or writing analytics records.
const eventsTable = pgTable("analytics_events", {
  id: serial("id"), employeeId: text("employee_id"), eventType: text("event_type"),
  createdAt: timestamp("created_at"), metadata: jsonb("metadata"), productId: serial("product_id"),
});
const products = pgTable("products", { id: serial("id"), name: text("name") });

function harness(empty = false) {
  let handler: Function;
  const errors: unknown[] = [];
  let queryIndex = 0;
  const db = {
    select(selection: any) {
      const index = queryIndex++;
      const query: any = {};
      for (const method of ["from", "where", "groupBy", "orderBy", "leftJoin", "limit", "offset"]) {
        query[method] = () => query;
      }
      query.then = (resolve: Function, reject: Function) => Promise.resolve().then(() => {
        if (empty) return index === 2 ? [{ total: 0 }] : [];
        if (index === 0) return [{
          employeeId: "123", count: 1,
          // PostgreSQL returns MAX(timestamp) as text unless explicitly decoded.
          lastSeen: selection.lastSeen.decoder.mapFromDriverValue("2026-11-08 15:30:00.123"),
        }];
        if (index === 1) return [{ domain: "vendor.test", count: 1 }];
        if (index === 2) return [{ total: 1 }];
        return [{
          id: 1, employeeId: "123", createdAt: new Date("2026-11-08T15:30:00.123Z"),
          metadata: { vendorDomain: "vendor.test" }, productName: null,
        }];
      }).then(resolve as any, reject as any);
      return query;
    },
  };
  const deps: Record<string, unknown> = {
    "drizzle-orm": drizzle,
    "@workspace/db": { db, analyticsEventsTable: eventsTable, productsTable: products },
    "@workspace/api-zod": { GetAnalyticsDrilldownQueryParams, GetAnalyticsDrilldownResponse },
    "../lib/analytics-filters": { analyticsWhere: () => undefined },
    "../lib/employees": {
      getAdminEmployeeIds: async () => ["999"],
      getEmployeeNames: async () => new Map([["123", "Test User"]]),
    },
  };
  const exports: any = {};
  const source = readFileSync(new URL("../routes/analytics-drilldown.ts", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports, Date, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; },
  });
  exports.registerAnalyticsDrilldown({ get(_path: string, _guard: unknown, fn: Function) { handler = fn; } }, () => {});
  return async (eventType: string) => {
    const res: any = {
      code: 200,
      status(code: number) { this.code = code; return this; },
      json(body: unknown) { this.body = body; },
    };
    await handler!({
      query: { range: "7d", includeAdmins: "0", eventType },
      log: { error(err: unknown) { errors.push(err); } },
    }, res);
    assert.deepEqual(errors, []);
    return res;
  };
}

for (const eventType of ["vendor_site_visit", "quickadd_capture", "add_to_list", "push_to_estimate"]) {
  test(`${eventType}: populated breakdown decodes aggregate timestamp before serialization`, async () => {
    const res = await harness()(eventType);
    assert.equal(res.code, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.actors[0].lastSeen, "2026-11-08T15:30:00.123Z");
    assert.equal(res.body.events[0].createdAt, "2026-11-08T15:30:00.123Z");
    assert.equal(res.body.actors[0].employeeName, "Test User");
  });
}

test("empty breakdown remains a successful empty result", async () => {
  const res = await harness(true)("quickadd_capture");
  assert.equal(res.code, 200);
  assert.equal(res.body.total, 0);
  assert.deepEqual(res.body.actors, []);
  assert.deepEqual(res.body.events, []);
});
