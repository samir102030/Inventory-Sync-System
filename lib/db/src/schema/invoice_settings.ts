import { pgTable, text, serial, boolean, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoiceSettingsTable = pgTable("invoice_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  companyName: text("company_name").notNull().default("شركتي"),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
  companyLogo: text("company_logo"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  showTax: boolean("show_tax").notNull().default(false),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("14"),
  footerNote: text("footer_note"),
  primaryColor: text("primary_color").notNull().default("#1e40af"),
});

export const insertInvoiceSettingsSchema = createInsertSchema(invoiceSettingsTable).omit({ id: true });
export type InsertInvoiceSettings = z.infer<typeof insertInvoiceSettingsSchema>;
export type InvoiceSettings = typeof invoiceSettingsTable.$inferSelect;
