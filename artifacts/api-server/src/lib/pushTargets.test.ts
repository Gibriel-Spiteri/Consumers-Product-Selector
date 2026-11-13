import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateTargetWhere, parseTargetQuery } from "./pushTargets";
import { customerNameFilter, openOrdersClause } from "./newSor";

test("only records that can take items, plus the one typed in full", () => {
  assert.equal(estimateTargetWhere({ kind: "number", prefix: "ES", digits: "237777" }),
    "t.tranid LIKE '%237777%' AND (t.status = 'A' OR t.tranid = 'ES237777')");
  assert.equal(estimateTargetWhere({ kind: "number", prefix: null, digits: "2377" }),
    "t.tranid LIKE '%2377%' AND (t.status = 'A' OR t.tranid = 'ES2377')");
  assert.equal(estimateTargetWhere({ kind: "number", prefix: "SO", digits: "714728" }), null);
  assert.equal(estimateTargetWhere({ kind: "number", prefix: "SOR", digits: "61" }), null);
  assert.equal(estimateTargetWhere({ kind: "name", name: "Systemtest" }), `t.status = 'A' AND ${customerNameFilter("Systemtest")}`);
  assert.equal(openOrdersClause("714728"), "(t.status IN ('A','B','D','E','F','G') OR t.tranid = 'SO714728')");
});

test("the one search box reads record numbers with or without their letters", () => {
  assert.deepEqual(parseTargetQuery("ES241762"), { kind: "number", prefix: "ES", digits: "241762" });
  assert.deepEqual(parseTargetQuery("so 714 728"), { kind: "number", prefix: "SO", digits: "714728" });
  assert.deepEqual(parseTargetQuery("SOR61"), { kind: "number", prefix: "SOR", digits: "61" });
  assert.deepEqual(parseTargetQuery("#2417"), { kind: "number", prefix: null, digits: "2417" });
  assert.equal(parseTargetQuery("ES24"), null);
  assert.equal(parseTargetQuery("1234567890"), null);
});

test("names: letters, spaces and a few marks only; never SQL", () => {
  assert.deepEqual(parseTargetQuery("  Linden   Kitchen & Bath "), { kind: "name", name: "Linden Kitchen & Bath" });
  assert.deepEqual(parseTargetQuery("O'Brien"), { kind: "name", name: "O'Brien" });
  assert.equal(parseTargetQuery("Al"), null);
  assert.equal(parseTargetQuery("x%' OR 1=1"), null);
  assert.equal(parseTargetQuery(""), null);
  assert.equal(customerNameFilter("O'Brien"), "(UPPER(c.companyname) LIKE '%O''BRIEN%' OR UPPER(c.lastname) LIKE '%O''BRIEN%' OR UPPER(c.firstname) LIKE '%O''BRIEN%')");
});
