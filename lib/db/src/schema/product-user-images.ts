import { pgTable, text, integer, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productUserImagesTable = pgTable(
  "product_user_images",
  {
    id: serial("id").primaryKey(),
    netsuiteId: text("netsuite_id").notNull().unique(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size"),
    uploadedByEmployeeId: text("uploaded_by_employee_id"),
    uploadedByEmployeeName: text("uploaded_by_employee_name"),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
    lastSeenInSyncAt: timestamp("last_seen_in_sync_at").defaultNow().notNull(),
  },
  (table) => ({
    lastSeenIdx: index("product_user_images_last_seen_idx").on(table.lastSeenInSyncAt),
  })
);

export const insertProductUserImageSchema = createInsertSchema(productUserImagesTable).omit({
  id: true,
  uploadedAt: true,
  lastSeenInSyncAt: true,
});

export type InsertProductUserImage = z.infer<typeof insertProductUserImageSchema>;
export type ProductUserImage = typeof productUserImagesTable.$inferSelect;
