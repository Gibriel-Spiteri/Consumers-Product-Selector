import { pgTable, text, integer, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productImagesTable = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productNetsuiteId: text("product_netsuite_id").notNull(),
    url: text("url").notNull(),
    displayOrder: integer("display_order"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdx: index("product_images_product_idx").on(table.productNetsuiteId),
  })
);

export const insertProductImageSchema = createInsertSchema(productImagesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertProductImage = z.infer<typeof insertProductImageSchema>;
export type ProductImage = typeof productImagesTable.$inferSelect;
