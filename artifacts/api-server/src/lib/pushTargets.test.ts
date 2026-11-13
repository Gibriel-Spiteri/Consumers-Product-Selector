import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTargetQuery } from "./pushTargets";
import { customerNameFilter } from "./newSor";

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
