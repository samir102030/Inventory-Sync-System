import { Router } from "express";
import { db, purchasesTable, purchaseItemsTable, productsTable, suppliersTable, accountTransactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { nextDocumentNumber } from "../lib/document-number";

const router = Router();

router.get("/purchases", async (_req, res) => {
  const rows = await db
    .select({
      id: purchasesTable.id,
      purchaseNumber: purchasesTable.purchaseNumber,
      supplierId: purchasesTable.supplierId,
      supplierName: purchasesTable.supplierName,
      total: purchasesTable.total,
      tax: purchasesTable.tax,
      taxRate: purchasesTable.taxRate,
      date: purchasesTable.date,
      paymentMethod: purchasesTable.paymentMethod,
      accountId: purchasesTable.accountId,
      notes: purchasesTable.notes,
      isTaxable: purchasesTable.isTaxable,
      createdAt: purchasesTable.createdAt,
    })
    .from(purchasesTable)
    .orderBy(sql`${purchasesTable.createdAt} DESC`);
  return res.json(rows.map(r => ({ ...r, total: Number(r.total), tax: Number(r.tax), taxRate: Number(r.taxRate), createdAt: r.createdAt.toISOString() })));
});

router.get("/purchases/:id", async (req, res) => {
  const [p] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, Number(req.params.id))).limit(1);
  if (!p) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, p.id));
  return res.json({
    ...p,
    total: Number(p.total),
    tax: Number(p.tax),
    taxRate: Number(p.taxRate),
    createdAt: p.createdAt.toISOString(),
    items: items.map(i => ({
      ...i,
      quantity: Number(i.quantity),
      unitCost: Number(i.unitCost),
      total: Number(i.total),
    })),
  });
});

router.post("/purchases", async (req, res) => {
  const { supplierId, supplierName, date, notes, items, paymentMethod, accountId, isTaxable, taxRate } = req.body;
  if (!date || !items?.length) return res.status(400).json({ error: "date and items required" });
  if (paymentMethod === "credit" && !supplierId) return res.status(400).json({ error: "supplierId is required for credit purchases" });

  const rate = Number(taxRate ?? 0);
  const subtotal = (items as Array<{ quantity: number; unitCost: number }>)
    .reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const taxAmt = subtotal * (rate / 100);
  const total = subtotal + taxAmt;

  const purchaseNumber = await nextDocumentNumber("purchases", "purchase_number", "PUR", 4);

  const supplierLabel = supplierId
    ? (await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, supplierId)).limit(1))[0]?.name ?? supplierName ?? null
    : (supplierName ?? null);

  const method = paymentMethod === "credit" ? "credit" : "cash";
  const taxable = (isTaxable || rate > 0) ? 1 : 0;

  const [purchase] = await db.insert(purchasesTable).values({
    purchaseNumber,
    supplierId: supplierId ?? null,
    supplierName: supplierLabel,
    total: String(total),
    tax: String(taxAmt),
    taxRate: String(rate),
    date,
    paymentMethod: method,
    accountId: accountId ? Number(accountId) : null,
    notes: notes ?? null,
    isTaxable: taxable,
  }).returning();

  for (const item of items as Array<{ productId: number; productName: string; barcode?: string; quantity: number; unitCost: number }>) {
    const itemTotal = item.quantity * item.unitCost;
    const unitCostWithTax = item.unitCost * (1 + rate / 100);
    let barcode = item.barcode ?? null;
    if (!barcode) {
      const [prod] = await db.select({ barcode: productsTable.barcode }).from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
      barcode = prod?.barcode ?? null;
    }
    await db.insert(purchaseItemsTable).values({
      purchaseId: purchase.id,
      productId: item.productId,
      productName: item.productName,
      barcode,
      quantity: String(item.quantity),
      unitCost: String(item.unitCost),
      total: String(itemTotal),
    });
    if (taxable) {
      await db
        .update(productsTable)
        .set({ taxStock: sql`${productsTable.taxStock} + ${item.quantity}`, costPrice: String(unitCostWithTax) })
        .where(eq(productsTable.id, item.productId));
    } else {
      await db
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} + ${item.quantity}`, costPrice: String(item.unitCost) })
        .where(eq(productsTable.id, item.productId));
    }
  }

  if (method === "cash" && purchase.accountId && total > 0) {
    await db.insert(accountTransactionsTable).values({
      accountId: purchase.accountId,
      direction: "out",
      amount: String(total),
      description: `فاتورة مشتريات رقم ${purchaseNumber}${supplierLabel ? ` — ${supplierLabel}` : ""}${rate > 0 ? ` (شامل ضريبة ${rate}%)` : ""}`,
      category: "مشتريات",
      date,
      reference: `purchase:${purchase.id}`,
    });
  }

  return res.status(201).json({ ...purchase, total: Number(purchase.total), tax: Number(purchase.tax), taxRate: Number(purchase.taxRate), createdAt: purchase.createdAt.toISOString() });
});

router.delete("/purchases/:id", async (req, res) => {
  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `purchase:${req.params.id}`));
  await db.delete(purchasesTable).where(eq(purchasesTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
