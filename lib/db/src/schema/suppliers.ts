import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  address: text("address"),
  taxNumber: text("tax_number"),
  notes: text("notes"),
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).notNull().default("0"), // what we owe them at start
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Supplier = typeof suppliersTable.$inferSelect;
