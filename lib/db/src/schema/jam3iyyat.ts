import { pgTable, text, serial, timestamp, numeric, date, integer } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const jam3iyyatTable = pgTable("jam3iyyat", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  totalMembers: integer("total_members").notNull(),
  amountPerMember: numeric("amount_per_member", { precision: 12, scale: 2 }).notNull(),
  myTurn: integer("my_turn").notNull(), // which turn number I receive the pot
  startDate: date("start_date", { mode: "string" }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jam3iyyaPaymentsTable = pgTable("jam3iyya_payments", {
  id: serial("id").primaryKey(),
  jam3iyyaId: integer("jam3iyya_id").notNull().references(() => jam3iyyatTable.id),
  month: text("month").notNull(), // e.g. "2024-01"
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  accountId: integer("account_id").references(() => accountsTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Jam3iyya = typeof jam3iyyatTable.$inferSelect;
export type Jam3iyyaPayment = typeof jam3iyyaPaymentsTable.$inferSelect;
