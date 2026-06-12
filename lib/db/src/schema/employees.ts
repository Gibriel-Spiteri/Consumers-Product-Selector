import { pgTable, text, boolean, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable(
  "employees",
  {
    id: serial("id").primaryKey(),
    netsuiteId: text("netsuite_id").notNull().unique(),
    entityId: text("entity_id"),
    email: text("email"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    giveAccess: boolean("give_access").default(false).notNull(),
    webstoreAccess: boolean("webstore_access").default(false).notNull(),
    webstoreAdmin: boolean("webstore_admin").default(false).notNull(),
    passwordHash: text("password_hash"),
    locationId: text("location_id"),
    locationName: text("location_name"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("employees_email_idx").on(table.email),
  })
);

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({
  id: true,
  updatedAt: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
