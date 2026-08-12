import { pgTable, text, serial, timestamp, numeric, date, integer } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const rentalPaymentsTable = pgTable("rental_payments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  propertyName: text("property_name").notNull(),
  tenantName: text("tenant_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  period: text("period").notNull(), // e.g. "يناير 2024"
  date: date("date", { mode: "string" }).notNull(),
  accountId: integer("account_id").references(() => accountsTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RentalPayment = typeof rentalPaymentsTable.$inferSelect;
