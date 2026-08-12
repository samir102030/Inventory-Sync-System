import { pgTable, text, serial, timestamp, integer, numeric, date } from "drizzle-orm/pg-core";
import { suppliersTable } from "./suppliers";
import { productsTable } from "./products";
import { accountsTable } from "./accounts";

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  purchaseNumber: text("purchase_number").notNull().unique(),
  supplierId: integer("supplier_id").references(() => suppliersTable.id),
  supplierName: text("supplier_name"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  date: date("date", { mode: "string" }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  accountId: integer("account_id").references(() => accountsTable.id),
  notes: text("notes"),
  isTaxable: integer("is_taxable").notNull().default(0),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseItemsTable = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  purchaseId: integer("purchase_id").notNull().references(() => purchasesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  productName: text("product_name").notNull(),
  barcode: text("barcode"),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
});

export type Purchase = typeof purchasesTable.$inferSelect;
export type PurchaseItem = typeof purchaseItemsTable.$inferSelect;
