import { Router } from "express";
import { db, categoriesTable, productsTable, invoiceReturnItemsTable, invoiceItemsTable, purchaseItemsTable, warehouseStockTable, warehouseTransferItemsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router = Router();

router.get("/categories", async (_req, res) => {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.id);
  return res.json(cats.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/categories", async (req, res) => {
  const { name, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [cat] = await db.insert(categoriesTable).values({ name, description, icon }).returning();
  return res.status(201).json({ ...cat, createdAt: cat.createdAt.toISOString() });
});

router.patch("/categories/:id", async (req, res) => {
  const { name, description, icon } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (icon !== undefined) updates.icon = icon;
  const [cat] = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, Number(req.params.id))).returning();
  if (!cat) return res.status(404).json({ error: "Not found" });
  return res.json({ ...cat, createdAt: cat.createdAt.toISOString() });
});

router.delete("/categories/:id", async (req, res) => {
  const catId = Number(req.params.id);
  const products = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.categoryId, catId));
  if (products.length > 0) {
    const productIds = products.map(p => p.id);
    await db.delete(invoiceReturnItemsTable);
    await db.delete(invoiceItemsTable).where(inArray(invoiceItemsTable.productId, productIds));
    await db.delete(purchaseItemsTable).where(inArray(purchaseItemsTable.productId, productIds));
    await db.delete(warehouseStockTable).where(inArray(warehouseStockTable.productId, productIds));
    await db.delete(warehouseTransferItemsTable).where(inArray(warehouseTransferItemsTable.productId, productIds));
    await db.delete(productsTable).where(eq(productsTable.categoryId, catId));
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, catId));
  return res.json({ ok: true });
});

export default router;
