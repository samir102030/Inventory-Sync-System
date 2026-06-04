import { Router } from "express";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq, and, ilike, lte, sql } from "drizzle-orm";

const router = Router();

function formatProduct(p: any, categoryName?: string | null) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    price: Number(p.price),
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
    categoryId: p.categoryId,
    categoryName: categoryName ?? null,
    stock: p.stock,
    minStock: p.minStock,
    barcode: p.barcode ?? null,
    unit: p.unit,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

router.get("/products", async (req, res) => {
  const { categoryId, search, barcode, lowStock } = req.query;

  const conditions = [];
  if (categoryId) conditions.push(eq(productsTable.categoryId, Number(categoryId)));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (barcode) conditions.push(eq(productsTable.barcode, String(barcode)));
  if (lowStock === "true") conditions.push(lte(productsTable.stock, productsTable.minStock));

  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      description: productsTable.description,
      price: productsTable.price,
      costPrice: productsTable.costPrice,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      stock: productsTable.stock,
      minStock: productsTable.minStock,
      barcode: productsTable.barcode,
      unit: productsTable.unit,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(productsTable.name);

  return res.json(rows.map(r => formatProduct(r, r.categoryName)));
});

router.post("/products", async (req, res) => {
  const { name, description, price, costPrice, categoryId, stock, minStock, barcode, unit } = req.body;
  if (!name || price == null || !categoryId) return res.status(400).json({ error: "name, price, categoryId required" });
  const [p] = await db.insert(productsTable).values({
    name, description, price: String(price),
    costPrice: costPrice != null ? String(costPrice) : null,
    categoryId: Number(categoryId),
    stock: stock ?? 0, minStock: minStock ?? 5, barcode, unit: unit ?? "قطعة",
  }).returning();

  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)).limit(1);
  return res.status(201).json(formatProduct(p, cats[0]?.name));
});

router.get("/products/:id", async (req, res) => {
  const rows = await db
    .select({ id: productsTable.id, name: productsTable.name, description: productsTable.description, price: productsTable.price, costPrice: productsTable.costPrice, categoryId: productsTable.categoryId, categoryName: categoriesTable.name, stock: productsTable.stock, minStock: productsTable.minStock, barcode: productsTable.barcode, unit: productsTable.unit, createdAt: productsTable.createdAt })
    .from(productsTable).leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, Number(req.params.id))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json(formatProduct(rows[0], rows[0].categoryName));
});

router.patch("/products/:id", async (req, res) => {
  const { name, description, price, costPrice, categoryId, stock, minStock, barcode, unit } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = String(price);
  if (costPrice !== undefined) updates.costPrice = costPrice != null ? String(costPrice) : null;
  if (categoryId !== undefined) updates.categoryId = Number(categoryId);
  if (stock !== undefined) updates.stock = stock;
  if (minStock !== undefined) updates.minStock = minStock;
  if (barcode !== undefined) updates.barcode = barcode;
  if (unit !== undefined) updates.unit = unit;
  const [p] = await db.update(productsTable).set(updates).where(eq(productsTable.id, Number(req.params.id))).returning();
  if (!p) return res.status(404).json({ error: "Not found" });
  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)).limit(1);
  return res.json(formatProduct(p, cats[0]?.name));
});

router.delete("/products/:id", async (req, res) => {
  await db.delete(productsTable).where(eq(productsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
