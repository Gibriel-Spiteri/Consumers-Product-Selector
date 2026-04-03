import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";

export const relatedItemsTable = pgTable("related_items", {
  id: serial("id").primaryKey(),
  parentNetsuiteId: text("parent_netsuite_id").notNull(),
  relatedNetsuiteId: text("related_netsuite_id").notNull(),
  description: text("description"),
  basePrice: text("base_price"),
  onlinePrice: text("online_price"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
