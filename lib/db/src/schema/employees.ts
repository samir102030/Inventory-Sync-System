import { pgTable, text, serial, timestamp, numeric, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  position: text("position").notNull().default(""),
  baseSalary: numeric("base_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  phone: text("phone"),
  hireDate: date("hire_date", { mode: "string" }),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salaryPaymentsTable = pgTable("salary_payments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  month: text("month").notNull(),
  accountId: integer("account_id").references(() => accountsTable.id),
  notes: text("notes"),
  paidAt: date("paid_at", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
export type SalaryPayment = typeof salaryPaymentsTable.$inferSelect;
