import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  // كسريّ لا صحيح: كميات البنود `numeric(10,3)`، وعمودٌ لا يسع ما يُطرح
  // منه يُقرِّب في كل حركة — فدورة بيع وإلغاء واحدة تخلق قطعة من العدم.
  // `mode: "number"` يبقي النوع رقمًا في الكود فلا يتغير أي قارئ.
  stock: numeric("stock", { precision: 12, scale: 3, mode: "number" }).notNull().default(0),
  taxStock: integer("tax_stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(5),
  barcode: text("barcode"),
  unit: text("unit").notNull().default("قطعة"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
