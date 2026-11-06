import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";

export const issueScreenshotUploadsTable = pgTable("issue_screenshot_uploads", {
  objectPath: text("object_path").primaryKey(),
  employeeId: text("employee_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIssueScreenshotUploadSchema = createInsertSchema(issueScreenshotUploadsTable).omit({ createdAt: true });
export type InsertIssueScreenshotUpload = z.infer<typeof insertIssueScreenshotUploadSchema>;
