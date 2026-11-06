import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";

export const issueReportsTable = pgTable("issue_reports", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  subject: text("subject").notNull(),
  detail: text("detail").notNull(),
  pageUrl: text("page_url").notNull(),
  browserInfo: text("browser_info").notNull(),
  browserLogs: jsonb("browser_logs").$type<Array<{ timestamp: string; level: string; message: string }>>().notNull().default([]),
  screenshotPath: text("screenshot_path"),
  captureError: text("capture_error"),
  caseId: text("case_id"),
  caseNumber: text("case_number"),
  caseStatus: text("case_status"),
  statusCheckedAt: timestamp("status_checked_at", { withTimezone: true }),
  submissionState: text("submission_state").notNull().default("pending"),
  submissionError: text("submission_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("issue_reports_created_idx").on(table.createdAt)]);

export const insertIssueReportSchema = createInsertSchema(issueReportsTable).omit({ createdAt: true });
export type InsertIssueReport = z.infer<typeof insertIssueReportSchema>;
export type IssueReportRecord = typeof issueReportsTable.$inferSelect;
