import { pgTable, text, serial, timestamp, numeric, date, integer } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const creditCardsTable = pgTable("credit_cards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),           // e.g. "Visa CIB", "MasterCard NBE"
  lastFour: text("last_four"),            // optional last 4 digits
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }),
  billingDay: integer("billing_day"),     // day of month statement closes
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditCardTransactionsTable = pgTable("credit_card_transactions", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => creditCardsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  transactionDate: date("transaction_date", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "paid"
  paidDate: date("paid_date", { mode: "string" }),
  accountId: integer("account_id").references(() => accountsTable.id), // account paid from
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CreditCard = typeof creditCardsTable.$inferSelect;
export type CreditCardTransaction = typeof creditCardTransactionsTable.$inferSelect;
