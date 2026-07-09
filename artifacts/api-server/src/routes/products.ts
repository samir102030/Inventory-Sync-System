import { Router } from "express";
import { db, productsTable, categoriesTable, invoiceItemsTable, invoicesTable, purchaseItemsTable, purchasesTable, customersTable, invoiceReturnItemsTable, warehouseStockTable, warehouseTransferItemsTable } from "@workspace/db";
import { eq, and, ilike, lte, sql, or } from "drizzle-orm";

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
    taxStock: p.taxStock ?? 0,
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
    .orderBy(productsTable.categoryId, productsTable.name);

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

router.get("/products/tracking", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);

  const matches = await db
    .select({ id: productsTable.id, name: productsTable.name, barcode: productsTable.barcode, stock: productsTable.stock, price: productsTable.price, costPrice: productsTable.costPrice })
    .from(productsTable)
    .where(or(ilike(productsTable.name, `%${q}%`), eq(productsTable.barcode, q)));

  const results = await Promise.all(matches.map(async product => {
    const saleRows = await db
      .select({ invoiceId: invoiceItemsTable.invoiceId, invoiceNumber: invoicesTable.invoiceNumber, date: invoicesTable.createdAt, quantity: invoiceItemsTable.quantity, unitPrice: invoiceItemsTable.unitPrice, total: invoiceItemsTable.total, customerName: customersTable.name })
      .from(invoiceItemsTable)
      .innerJoin(invoicesTable, eq(invoiceItemsTable.invoiceId, invoicesTable.id))
      .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
      .where(eq(invoiceItemsTable.productId, product.id))
      .orderBy(sql`${invoicesTable.createdAt} DESC`);

    const purchaseRows = await db
      .select({ purchaseId: purchaseItemsTable.purchaseId, purchaseNumber: purchasesTable.purchaseNumber, date: purchasesTable.date, quantity: purchaseItemsTable.quantity, unitCost: purchaseItemsTable.unitCost, total: purchaseItemsTable.total, supplierName: purchasesTable.supplierName })
      .from(purchaseItemsTable)
      .innerJoin(purchasesTable, eq(purchaseItemsTable.purchaseId, purchasesTable.id))
      .where(eq(purchaseItemsTable.productId, product.id))
      .orderBy(sql`${purchasesTable.date} DESC`);

    const sales = saleRows.map(r => ({ invoiceId: r.invoiceId, invoiceNumber: r.invoiceNumber, date: r.date instanceof Date ? r.date.toISOString() : r.date, quantity: Number(r.quantity), unitPrice: Number(r.unitPrice), total: Number(r.total), customerName: r.customerName ?? null }));
    const purchases = purchaseRows.map(r => ({ purchaseId: r.purchaseId, purchaseNumber: r.purchaseNumber, date: r.date, quantity: Number(r.quantity), unitCost: Number(r.unitCost), total: Number(r.total), supplierName: r.supplierName ?? null }));
    const totalSold = sales.reduce((s, r) => s + r.quantity, 0);
    const totalPurchased = purchases.reduce((s, r) => s + r.quantity, 0);
    const totalSalesRevenue = sales.reduce((s, r) => s + r.total, 0);
    const totalPurchaseCost = purchases.reduce((s, r) => s + r.total, 0);
    return { product: { id: product.id, name: product.name, barcode: product.barcode ?? null, stock: product.stock, price: Number(product.price), costPrice: product.costPrice != null ? Number(product.costPrice) : null }, sales, purchases, totalSold, totalPurchased, totalSalesRevenue, totalPurchaseCost };
  }));

  return res.json(results);
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

router.post("/products/delete-all", async (req, res) => {
  await db.delete(invoiceReturnItemsTable);
  await db.delete(invoiceItemsTable);
  await db.delete(purchaseItemsTable);
  await db.delete(warehouseStockTable);
  await db.delete(warehouseTransferItemsTable);
  await db.delete(productsTable);
  await db.delete(categoriesTable);
  return res.json({ ok: true });
});

router.post("/products/bulk-delete", async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids array required" });
  const deleted: number[] = [];
  const failed: { id: number; name: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      const [product] = await db.select({ id: productsTable.id, name: productsTable.name }).from(productsTable).where(eq(productsTable.id, id)).limit(1);
      if (!product) continue;
      await db.delete(productsTable).where(eq(productsTable.id, id));
      deleted.push(id);
    } catch (err: any) {
      const [product] = await db.select({ name: productsTable.name }).from(productsTable).where(eq(productsTable.id, id)).limit(1);
      const name = product?.name ?? `#${id}`;
      const msg = String(err?.message ?? "");
      const reason = msg.includes("foreign key") || msg.includes("violates") ? "مرتبط بفاتورة أو مشترى" : "خطأ غير متوقع";
      failed.push({ id, name, reason });
    }
  }
  return res.json({ deleted, failed });
});

router.delete("/products/:id", async (req, res) => {
  await db.delete(productsTable).where(eq(productsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

router.post("/products/import", async (req, res) => {
  const { items } = req.body as { items: Array<{ name: string; price: number; costPrice?: number; categoryName?: string; barcode?: string; stock?: number; minStock?: number; unit?: string }> };
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "items array required" });

  const allCategories = await db.select().from(categoriesTable);
  const catMap = new Map(allCategories.map(c => [c.name.trim().toLowerCase(), c.id]));

  const results = { created: 0, failed: 0, errors: [] as string[] };

  for (const item of items) {
    try {
      if (!item.name || item.price == null) { results.failed++; results.errors.push(`صف بدون اسم أو سعر: ${JSON.stringify(item)}`); continue; }
      const catId = item.categoryName ? (catMap.get(item.categoryName.trim().toLowerCase()) ?? null) : null;
      await db.insert(productsTable).values({
        name: String(item.name),
        price: String(item.price),
        costPrice: item.costPrice != null ? String(item.costPrice) : null,
        categoryId: catId ?? allCategories[0]?.id ?? 1,
        barcode: item.barcode ? String(item.barcode) : null,
        stock: item.stock != null ? Number(item.stock) : 0,
        minStock: item.minStock != null ? Number(item.minStock) : 5,
        unit: item.unit ?? "قطعة",
      });
      results.created++;
    } catch (err: any) {
      results.failed++;
      results.errors.push(`${item.name}: ${err.message}`);
    }
  }

  return res.json(results);
});

export default router;
