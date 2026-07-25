import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const banksTable = pgTable("banks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  branch: text("branch"),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
