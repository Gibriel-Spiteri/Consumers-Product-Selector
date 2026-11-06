import { test } from "node:test";
import assert from "node:assert/strict";
import { redactDiagnosticText, safeReportUrl, caseStatusFields } from "./issue-diagnostics";
import { SubmitIssueReportBody, GetAdminIssuesResponse } from "@workspace/api-zod";

test("diagnostic redaction strips credentials, tokens, emails and URL query values", () => {
  const text = redactDiagnosticText('Authorization: Bearer my-secret-access-token password=hunter2 api_key=abc123 email=person@example.com https://example.com/page?token=secret#value');
  for (const secret of ["my-secret-access-token", "hunter2", "abc123", "person@example.com", "token=secret", "#value"]) assert.ok(!text.includes(secret));
  assert.ok(text.includes("https://example.com/page"));
});

test("page URLs exclude query strings, fragments and non-HTTP schemes", () => {
  assert.equal(safeReportUrl("https://example.com/special-order?session=secret#fragment"), "https://example.com/special-order");
  assert.equal(safeReportUrl("javascript:alert(1)"), "");
  assert.equal(safeReportUrl("data:image/png;base64,abc"), "");
});

test("diagnostic values are bounded and case fields never substitute the internal ID", () => {
  assert.equal(redactDiagnosticText("x".repeat(5000)).length, 2000);
  assert.deepEqual(caseStatusFields({ id: "99", casenumber: "74756", statusname: "Closed" }), { caseNumber: "74756", caseStatus: "Closed" });
  assert.deepEqual(caseStatusFields({ id: "99" }), { caseNumber: null, caseStatus: null });
});

test("report input enforces a request UUID and bounded diagnostics", () => {
  const input = {
    requestId: "123e4567-e89b-42d3-a456-426614174000", subject: "Issue", detail: "Description",
    pageUrl: "https://example.com", browserInfo: "Browser", browserLogs: [],
  };
  assert.ok(SubmitIssueReportBody.safeParse(input).success);
  assert.ok(!SubmitIssueReportBody.safeParse({ ...input, requestId: "not-a-uuid" }).success);
  assert.ok(!SubmitIssueReportBody.safeParse({ ...input, detail: "" }).success);
  assert.ok(!SubmitIssueReportBody.safeParse({ ...input, browserLogs: Array(41).fill({ timestamp: "now", level: "error", message: "Error" }) }).success);
  assert.ok(!SubmitIssueReportBody.safeParse({ ...input, browserLogs: [{ timestamp: "now", level: "error", message: "x".repeat(2001) }] }).success);
});

test("admin history empty state has an explicit valid contract", () => {
  assert.ok(GetAdminIssuesResponse.safeParse({ items: [], total: 0, page: 1, pageSize: 20, statusSyncError: null }).success);
});
