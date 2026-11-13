import { test } from "node:test";
import assert from "node:assert/strict";
import { pushUiFrom, recentWhen, searchableQuery, splitCustomer, withRecent } from "./push-ui";

test("Send to NetSuite is the default; a browser that chose classic keeps it until ?pushui=new", () => {
  assert.deepEqual(pushUiFrom("", null), { ui: "new", store: null });
  assert.deepEqual(pushUiFrom("?pushui=other", null), { ui: "new", store: null });
  assert.deepEqual(pushUiFrom("", "classic"), { ui: "classic", store: null });
  assert.deepEqual(pushUiFrom("?pushui=new", "classic"), { ui: "new", store: "new" });
  assert.deepEqual(pushUiFrom("?pushui=classic", "new"), { ui: "classic", store: "classic" });
});

test("the search box takes ES / SO / SOR numbers, not names (2026-11-13)", () => {
  assert.equal(searchableQuery("ES241762"), "ES241762");
  assert.equal(searchableQuery("so 714 728"), "SO714728");
  assert.equal(searchableQuery("SOR61"), "SOR61");
  assert.equal(searchableQuery("2417"), "2417");
  assert.equal(searchableQuery("24"), null);
  assert.equal(searchableQuery("ES24"), null);
  // Were "Alvarez" and "Linden Kitchen & Bath" while names were searched.
  assert.equal(searchableQuery("Alvarez"), null);
  assert.equal(searchableQuery("Linden Kitchen & Bath"), null);
  assert.equal(searchableQuery("Al"), null);
  assert.equal(searchableQuery("x'; drop"), null);
});

test("customer display and recent list", () => {
  assert.deepEqual(splitCustomer("104453 Baloga"), { name: "Baloga", number: "104453" });
  assert.deepEqual(splitCustomer("Walk-in"), { name: "Walk-in", number: null });
  const list = withRecent([{ label: "ES1", customer: "a", at: 1 }, { label: "SOR61", customer: "b", at: 2 }], { label: "SOR61", customer: "b", at: 3 });
  assert.deepEqual(list.map(r => r.label), ["SOR61", "ES1"]);
  assert.equal(withRecent([1, 2, 3, 4, 5].map(i => ({ label: `L${i}`, customer: "", at: i })), { label: "N", customer: "", at: 9 }).length, 5);
  const now = new Date(2026, 10, 13, 15).getTime();
  assert.equal(recentWhen(new Date(2026, 10, 13, 9).getTime(), now), "Sent today");
  assert.equal(recentWhen(new Date(2026, 10, 12, 23).getTime(), now), "Sent yesterday");
  assert.equal(recentWhen(new Date(2026, 10, 9).getTime(), now), "Sent Nov 9");
});
