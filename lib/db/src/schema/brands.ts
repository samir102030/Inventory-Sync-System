import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * البراندات (Hikvision، Dahua...).
 *
 * يضيفها المورّد (`vendor`) ويعدّلها ولا يحذفها. ما يضيفه يبقى `pending`
 * حتى يعتمده أدمن الشركة أو مالك النظام، وعندها يراه الجميع.
 *
 * الاسم فريد داخل الشركة لا عبر النظام: براند عند عميل لا يمنعه عند غيره.
 */
export const brandsTable = pgTable("brands", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  description: text("description"),
  website: text("website"),
  approvalStatus: text("approval_status").notNull().default("approved"),
  createdBy: text("created_by"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBrandSchema = createInsertSchema(brandsTable).omit({ id: true, createdAt: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brandsTable.$inferSelect;
