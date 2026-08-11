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
  clerkUserId: text("clerk_user_id").unique(),
  status: text("status").notNull().default("active"),
  /**
   * الشركة التي ينتمي إليها المستخدم.
   * NULL يعني مالك النظام (`owner`) — فوق الشركات كلها، لا داخل واحدة.
   */
  companyId: integer("company_id").references(() => companiesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
