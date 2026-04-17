import { pgTable, text, integer, serial, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  netsuiteId: text("netsuite_id").unique(),
  name: text("name").notNull(),
  salesdescription: text("salesdescription"),
  sku: text("sku"),
  price: numeric("price", { precision: 10, scale: 2 }),
  retailPrice: numeric("retail_price", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  fullImageUrl: text("full_image_url"),
  description: text("description"),
  manufacturer: text("manufacturer"),
  quantityAvailable: integer("quantity_available"),
  noReorder: integer("no_reorder").default(0),
  hasActivePpr: boolean("has_active_ppr").default(false),
  pprName: text("ppr_name"),
  pprPriceReductionRetail: numeric("ppr_price_reduction_retail", { precision: 10, scale: 2 }),
  isExpressBath: boolean("is_express_bath").default(false),
  isSpecialOrderStock: boolean("is_special_order_stock").default(false),
  binNumber: text("bin_number"),
  categoryId: integer("category_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
