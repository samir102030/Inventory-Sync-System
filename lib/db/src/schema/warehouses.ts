import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const warehousesTable = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isMain: boolean("is_main").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const warehouseStockTable = pgTable("warehouse_stock", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull().references(() => warehousesTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull().default(0),
});

export const warehouseTransfersTable = pgTable("warehouse_transfers", {
  id: serial("id").primaryKey(),
  transferNumber: text("transfer_number").notNull(),
  fromWarehouseId: integer("from_warehouse_id").references(() => warehousesTable.id),
  toWarehouseId: integer("to_warehouse_id").references(() => warehousesTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const warehouseTransferItemsTable = pgTable("warehouse_transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull().references(() => warehouseTransfersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
});

export type Warehouse = typeof warehousesTable.$inferSelect;
export type WarehouseStock = typeof warehouseStockTable.$inferSelect;
export type WarehouseTransfer = typeof warehouseTransfersTable.$inferSelect;
