import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  role: text("role").notNull().default("cashier"),
  email: text("email").unique(),
  phone: text("phone"),
  /**
   * `pending`  بانتظار موافقة أدمن على طلب تسجيل.
   * `invited`  وُوفق عليه وأُرسل كود التفعيل، ولم يختر كلمة مرور بعد.
   * `active`   يعمل.
   */
  status: text("status").notNull().default("active"),
  /**
   * الشركة التي ينتمي إليها المستخدم.
   * NULL يعني مالك النظام (`owner`) — فوق الشركات كلها، لا داخل واحدة.
   */
  companyId: integer("company_id").references(() => companiesTable.id),
  /**
   * كود التفعيل مخزَّن كبصمة لا كنص: من يقرأ الجدول لا يستطيع تفعيل حساب
   * غيره. يُولَّد عند الموافقة ويُرسَل بالإيميل.
   */
  activationCodeHash: text("activation_code_hash"),
  activationExpiresAt: timestamp("activation_expires_at", { withTimezone: true }),
  /** اسم الشركة الذي طلبه عميل جديد، قبل أن توجد الشركة فعلًا. */
  requestedCompanyName: text("requested_company_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
