import { pgTable, text, integer, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const productAttributesTable = pgTable("product_attributes", {
  id: serial("id").primaryKey(),
  netsuiteId: text("netsuite_id").unique(),
  productNetsuiteId: text("product_netsuite_id").notNull(),
  attributeName: text("attribute_name").notNull(),
  attributeValueId: text("attribute_value_id"),
  attributeValue: text("attribute_value").notNull(),
  sortOrder: integer("sort_order"),
  isFilter: boolean("is_filter").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
