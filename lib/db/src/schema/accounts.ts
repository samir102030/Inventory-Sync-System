import { pgTable, text, serial, timestamp, integer, numeric, date, boolean } from "drizzle-orm/pg-core";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  type: text("type").notNull().default("cash"),
  color: text("color").notNull().default("#3b82f6"),
  initialBalance: numeric("initial_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountTransactionsTable = pgTable("account_transactions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  category: text("category"),
  date: date("date", { mode: "string" }).notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accountsTable.$inferSelect;
export type AccountTransaction = typeof accountTransactionsTable.$inferSelect;
