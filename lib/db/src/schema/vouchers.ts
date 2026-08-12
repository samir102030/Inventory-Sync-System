import { pgTable, text, serial, timestamp, integer, numeric, date } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { suppliersTable } from "./suppliers";
import { accountsTable } from "./accounts";

export const receiptVouchersTable = pgTable("receipt_vouchers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  voucherNumber: text("voucher_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customersTable.id),
  customerName: text("customer_name"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  accountId: integer("account_id").references(() => accountsTable.id),
  type: text("type").notNull().default("payment"), // "payment" | "deposit"
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentVouchersTable = pgTable("payment_vouchers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  voucherNumber: text("voucher_number").notNull().unique(),
  supplierId: integer("supplier_id").references(() => suppliersTable.id),
  paidTo: text("paid_to").notNull(),
  category: text("category").notNull().default("supplier"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  accountId: integer("account_id").references(() => accountsTable.id),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReceiptVoucher = typeof receiptVouchersTable.$inferSelect;
export type PaymentVoucher = typeof paymentVouchersTable.$inferSelect;
