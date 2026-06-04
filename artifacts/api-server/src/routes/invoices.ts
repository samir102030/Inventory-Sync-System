import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, customersTable, productsTable, invoiceSettingsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

function formatInvoice(inv: any, customerName?: string | null) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerId: inv.customerId ?? null,
    customerName: customerName ?? null,
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    tax: Number(inv.tax),
    total: Number(inv.total),
    paymentMethod: inv.paymentMethod,
    status: inv.status,
    notes: inv.notes ?? null,
    createdBy: inv.createdBy ?? null,
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
  };
}

async function generateInvoiceNumber() {
  const settings = await db.select().from(invoiceSettingsTable).limit(1);
  const prefix = settings[0]?.invoicePrefix ?? "INV";
  const count = await db.select({ cnt: sql<number>`COUNT(*)` }).from(invoicesTable);
  const num = (Number(count[0]?.cnt ?? 0) + 1).toString().padStart(5, "0");
  return `${prefix}-${num}`;
}

router.get("/invoices", async (req, res) => {
  const { startDate, endDate, customerId, status } = req.query;
  const conditions = [];
  if (startDate) conditions.push(gte(sql`${invoicesTable.createdAt}::date`, sql`${String(startDate)}::date`));
  if (endDate) conditions.push(lte(sql`${invoicesTable.createdAt}::date`, sql`${String(endDate)}::date`));
  if (customerId) conditions.push(eq(invoicesTable.customerId, Number(customerId)));
  if (status) conditions.push(eq(invoicesTable.status, String(status)));

  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      status: invoicesTable.status,
      notes: invoicesTable.notes,
      createdBy: invoicesTable.createdBy,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${invoicesTable.createdAt} DESC`);

  return res.json(rows.map(r => formatInvoice(r, r.customerName)));
});

router.post("/invoices", async (req, res) => {
  const { customerId, items, discount, tax, paymentMethod, status, notes } = req.body;
  if (!items?.length || !paymentMethod) return res.status(400).json({ error: "items and paymentMethod required" });

  const invoiceNumber = await generateInvoiceNumber();
  const userId = (req.session as any)?.userId;
  let createdBy = null;
  if (userId) {
    const users = await db.select({ name: sql<string>`name` }).from(sql`users`).where(eq(sql`id`, userId)).limit(1);
  }

  let subtotal = 0;
  const resolvedItems: Array<{ productId: number; productName: string; quantity: number; unitPrice: number; discount: number; total: number }> = [];

  for (const item of items) {
    const products = await db.select().from(productsTable).where(eq(productsTable.id, Number(item.productId))).limit(1);
    const product = products[0];
    if (!product) return res.status(400).json({ error: `Product ${item.productId} not found` });
    const qty = Number(item.quantity);
    const price = Number(item.unitPrice);
    const itemDiscount = Number(item.discount ?? 0);
    const itemTotal = qty * price - itemDiscount;
    subtotal += itemTotal;
    resolvedItems.push({ productId: product.id, productName: product.name, quantity: qty, unitPrice: price, discount: itemDiscount, total: itemTotal });
  }

  const discountAmt = Number(discount ?? 0);
  const taxAmt = Number(tax ?? 0);
  const total = subtotal - discountAmt + taxAmt;

  const [inv] = await db.insert(invoicesTable).values({
    invoiceNumber,
    customerId: customerId ? Number(customerId) : null,
    subtotal: String(subtotal),
    discount: String(discountAmt),
    tax: String(taxAmt),
    total: String(total),
    paymentMethod,
    status: status ?? "paid",
    notes,
    createdBy,
  }).returning();

  for (const item of resolvedItems) {
    await db.insert(invoiceItemsTable).values({
      invoiceId: inv.id,
      productId: item.productId,
      productName: item.productName,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      discount: String(item.discount),
      total: String(item.total),
    });
    await db.update(productsTable).set({ stock: sql`${productsTable.stock} - ${item.quantity}` }).where(eq(productsTable.id, item.productId));
  }

  let customerName = null;
  if (customerId) {
    const custs = await db.select().from(customersTable).where(eq(customersTable.id, Number(customerId))).limit(1);
    customerName = custs[0]?.name ?? null;
  }

  return res.status(201).json(formatInvoice(inv, customerName));
});

router.get("/invoices/:id", async (req, res) => {
  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      status: invoicesTable.status,
      notes: invoicesTable.notes,
      createdBy: invoicesTable.createdBy,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(eq(invoicesTable.id, Number(req.params.id))).limit(1);

  if (!rows[0]) return res.status(404).json({ error: "Not found" });

  const itemRows = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, Number(req.params.id)));

  const items = itemRows.map(i => ({
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    quantity: Number(i.quantity),
    unitPrice: Number(i.unitPrice),
    discount: Number(i.discount),
    total: Number(i.total),
  }));

  return res.json({ ...formatInvoice(rows[0], rows[0].customerName), items });
});

router.patch("/invoices/:id", async (req, res) => {
  const { status, notes, discount } = req.body;
  const updates: Record<string, any> = {};
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (discount !== undefined) updates.discount = String(discount);
  const [inv] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, Number(req.params.id))).returning();
  if (!inv) return res.status(404).json({ error: "Not found" });
  return res.json(formatInvoice(inv));
});

router.delete("/invoices/:id", async (req, res) => {
  await db.delete(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
