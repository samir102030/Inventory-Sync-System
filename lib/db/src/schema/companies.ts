import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * الشركات (المستأجرون).
 *
 * كل شركة عالم مغلق: لا ترى بيانات غيرها إطلاقًا. مالك النظام (`owner`)
 * وحده يرى الشركات كلها ويتنقّل بينها.
 *
 * `isActive` للإيقاف دون حذف — عند توقف عميل عن الدفع مثلًا. البيانات تبقى
 * كما هي ويُمنع الدخول فقط.
 */
export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
