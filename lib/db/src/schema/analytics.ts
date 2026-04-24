import { pgTable, text, integer, serial, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const analyticsEventsTable = pgTable(
  "analytics_events",
  {
    id: serial("id").primaryKey(),
    employeeId: text("employee_id"),
    sessionId: text("session_id").notNull(),
    eventType: text("event_type").notNull(),
    path: text("path"),
    categoryId: integer("category_id"),
    productId: integer("product_id"),
    metadata: jsonb("metadata"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("analytics_events_created_at_idx").on(t.createdAt),
    index("analytics_events_employee_id_idx").on(t.employeeId),
    index("analytics_events_event_type_idx").on(t.eventType),
    index("analytics_events_event_type_created_at_idx").on(t.eventType, t.createdAt),
    index("analytics_events_category_id_idx").on(t.categoryId),
    index("analytics_events_product_id_idx").on(t.productId),
    index("analytics_events_session_id_idx").on(t.sessionId),
  ],
);

export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEventsTable.$inferInsert;
