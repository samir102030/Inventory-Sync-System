import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, customersTable, productsTable, invoiceSettingsTable, invoiceReturnsTable, invoiceReturnItemsTable, accountTransactionsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { nextDocumentNumber } from "../lib/document-number";

const router = Router();

function formatInvoice(inv: any, customerName?: string | null, customerWhatsapp?: string | null) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerId: inv.customerId ?? null,
    customerName: customerName ?? null,
    customerWhatsapp: customerWhatsapp ?? null,
    accountId: inv.accountId ?? null,
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    tax: Number(inv.tax),
    total: Number(inv.total),
    paymentMethod: inv.paymentMethod,
    status: inv.status,
    isTaxable: Number(inv.isTaxable ?? 0),
    notes: inv.notes ?? null,
    createdBy: inv.createdBy ?? null,
    approvalStatus: inv.approvalStatus ?? "approved",
    approvedBy: inv.approvedBy ?? null,
    approvedAt: inv.approvedAt instanceof Date ? inv.approvedAt.toISOString() : (inv.approvedAt ?? null),
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
  };
}

async function generateInvoiceNumber() {
  const settings = await db.select().from(invoiceSettingsTable).limit(1);
  const prefix = settings[0]?.invoicePrefix ?? "INV";
  return nextDocumentNumber("invoices", "invoice_number", prefix);
}

async function generateReturnNumber(_invoiceNumber: string) {
  return nextDocumentNumber("invoice_returns", "return_number", "RET");
}

router.get("/invoices/tax-ledger", async (req, res) => {
  const { from, to } = req.query;
  const conditions = [sql`${invoicesTable.tax}::numeric > 0`];
  if (from) conditions.push(gte(sql`${invoicesTable.createdAt}::date`, sql`${String(from)}::date`));
  if (to) conditions.push(lte(sql`${invoicesTable.createdAt}::date`, sql`${String(to)}::date`));

  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerName: customersTable.name,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(and(...conditions))
    .orderBy(sql`${invoicesTable.createdAt} DESC`);

  const invoices = rows.map(r => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    customerName: r.customerName ?? null,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    tax: Number(r.tax),
    total: Number(r.total),
    paymentMethod: r.paymentMethod,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    taxRate: Number(r.subtotal) > 0 ? Math.round((Number(r.tax) / Number(r.subtotal)) * 100) : 0,
  }));

  const totalTax = invoices.reduce((s, r) => s + r.tax, 0);
  const totalSubtotal = invoices.reduce((s, r) => s + r.subtotal, 0);
  const totalAmount = invoices.reduce((s, r) => s + r.total, 0);

  return res.json({ invoices, totalTax, totalSubtotal, totalAmount, count: invoices.length });
});

router.get("/invoices", async (req, res) => {
  const { startDate, endDate, customerId, status } = req.query;
  const conditions = [];
  if (startDate) conditions.push(gte(sql`${invoicesTable.createdAt}::date`, sql`${String(startDate)}::date`));
  if (endDate) conditions.push(lte(sql`${invoicesTable.createdAt}::date`, sql`${String(endDate)}::date`));
  if (customerId) conditions.push(eq(invoicesTable.customerId, Number(customerId)));
  if (status) conditions.push(eq(invoicesTable.status, String(status)));
  // ‏?approval=pending تستخدمه صفحة المراجعة.
  if (req.query.approval) {
    conditions.push(eq(invoicesTable.approvalStatus, String(req.query.approval)));
  }

  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      customerWhatsapp: customersTable.whatsapp,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      status: invoicesTable.status,
      notes: invoicesTable.notes,
      createdBy: invoicesTable.createdBy,
      approvalStatus: invoicesTable.approvalStatus,
      approvedBy: invoicesTable.approvedBy,
      approvedAt: invoicesTable.approvedAt,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${invoicesTable.createdAt} DESC`);

  return res.json(rows.map(r => formatInvoice(r, r.customerName, r.customerWhatsapp)));
});

router.post("/invoices", async (req, res) => {
  const { customerId, accountId, items, discount, tax, paymentMethod, status, notes, isTaxable } = req.body;
  if (!items?.length || !paymentMethod) return res.status(400).json({ error: "items and paymentMethod required" });
  if (paymentMethod === "credit" && !customerId) return res.status(400).json({ error: "customerId is required for credit sales" });

  const invoiceNumber = await generateInvoiceNumber();

  // كان الاستعلام هنا يُنفَّذ ونتيجته تُهمَل، فيبقى `created_by` فارغًا دائمًا.
  const userId = (req.session as any)?.userId;
  let createdBy: string | null = null;
  if (userId) {
    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    createdBy = user?.name ?? null;
  }

  let subtotal = 0;
  const resolvedItems: Array<{ productId: number; productName: string; barcode: string | null; quantity: number; unitPrice: number; costPrice: number; discount: number; total: number }> = [];

  for (const item of items) {
    const products = await db.select().from(productsTable).where(eq(productsTable.id, Number(item.productId))).limit(1);
    const product = products[0];
    if (!product) return res.status(400).json({ error: `Product ${item.productId} not found` });
    const qty = Number(item.quantity);
    const price = Number(item.unitPrice);
    const cost = Number(product.costPrice ?? 0);
    const itemDiscount = Number(item.discount ?? 0);
    const itemTotal = qty * price - itemDiscount;
    subtotal += itemTotal;
    resolvedItems.push({ productId: product.id, productName: product.name, barcode: product.barcode ?? null, quantity: qty, unitPrice: price, costPrice: cost, discount: itemDiscount, total: itemTotal });
  }

  const discountAmt = Number(discount ?? 0);
  const taxAmt = Number(tax ?? 0);
  const total = subtotal - discountAmt + taxAmt;

  const [inv] = await db.insert(invoicesTable).values({
    invoiceNumber,
    customerId: customerId ? Number(customerId) : null,
    accountId: accountId ? Number(accountId) : null,
    subtotal: String(subtotal),
    discount: String(discountAmt),
    tax: String(taxAmt),
    total: String(total),
    paymentMethod,
    status: status ?? "paid",
    notes,
    createdBy,
    // فاتورة الكاشير تنتظر مراجعة الأدمن؛ وما ينشئه الأدمن معتمد بحكم من أنشأه.
    approvalStatus: (req.session as any)?.role === "cashier" ? "pending" : "approved",
  }).returning();

  for (const item of resolvedItems) {
    await db.insert(invoiceItemsTable).values({
      invoiceId: inv.id,
      productId: item.productId,
      productName: item.productName,
      barcode: item.barcode,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      costPrice: String(item.costPrice),
      discount: String(item.discount),
      total: String(item.total),
    });
    await db.update(productsTable).set({ stock: sql`${productsTable.stock} - ${item.quantity}` }).where(eq(productsTable.id, item.productId));
  }

  if (accountId && paymentMethod !== "credit" && (inv.status === "paid" || !status) && total > 0) {
    await db.insert(accountTransactionsTable).values({
      accountId: Number(accountId),
      direction: "in",
      amount: String(total),
      description: `فاتورة مبيعات رقم ${invoiceNumber}`,
      category: "مبيعات",
      date: new Date().toISOString().slice(0, 10),
      reference: `invoice:${inv.id}`,
    });
  }

  let customerName = null;
  let customerWhatsapp = null;
  if (customerId) {
    const custs = await db.select().from(customersTable).where(eq(customersTable.id, Number(customerId))).limit(1);
    customerName = custs[0]?.name ?? null;
    customerWhatsapp = custs[0]?.whatsapp ?? null;
  }

  return res.status(201).json(formatInvoice(inv, customerName, customerWhatsapp));
});

router.get("/invoices/:id", async (req, res) => {
  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      customerWhatsapp: customersTable.whatsapp,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      status: invoicesTable.status,
      notes: invoicesTable.notes,
      createdBy: invoicesTable.createdBy,
      approvalStatus: invoicesTable.approvalStatus,
      approvedBy: invoicesTable.approvedBy,
      approvedAt: invoicesTable.approvedAt,
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
    barcode: i.barcode ?? null,
    quantity: Number(i.quantity),
    unitPrice: Number(i.unitPrice),
    costPrice: Number(i.costPrice ?? 0),
    discount: Number(i.discount),
    total: Number(i.total),
  }));

  return res.json({ ...formatInvoice(rows[0], rows[0].customerName, rows[0].customerWhatsapp), items });
});

router.patch("/invoices/:id", async (req, res) => {
  const { status, notes, discount, tax, paymentMethod, customerId, accountId } = req.body;

  const invRows = await db.select().from(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id))).limit(1);
  if (!invRows[0]) return res.status(404).json({ error: "Not found" });
  const inv = invRows[0];

  const updates: Record<string, any> = {};
  if (notes !== undefined) updates.notes = notes;
  if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;
  if (customerId !== undefined) updates.customerId = customerId ? Number(customerId) : null;
  if (accountId !== undefined) updates.accountId = accountId ? Number(accountId) : null;

  const newDiscount = discount !== undefined ? Number(discount) : Number(inv.discount);
  const newTax = tax !== undefined ? Number(tax) : Number(inv.tax);
  if (discount !== undefined) updates.discount = String(newDiscount);
  if (tax !== undefined) updates.tax = String(newTax);

  let newTotal = Number(inv.total);
  if (discount !== undefined || tax !== undefined) {
    newTotal = Number(inv.subtotal) - newDiscount + newTax;
    updates.total = String(newTotal);
  }

  if (status !== undefined && status !== inv.status) {
    updates.status = status;
    if (status === "cancelled" && inv.status !== "cancelled") {
      const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, inv.id));
      for (const item of items) {
        await db.update(productsTable).set({ stock: sql`${productsTable.stock} + ${item.quantity}` }).where(eq(productsTable.id, item.productId));
      }
      await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `invoice:${inv.id}`));
    }
  }

  const [updated] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, Number(req.params.id))).returning();

  if (updated.status === "paid" || updated.status === "partial_return") {
    const finalAccountId = updated.accountId;
    if (finalAccountId && updated.paymentMethod !== "credit") {
      const existingTxn = await db.select().from(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `invoice:${inv.id}`)).limit(1);
      if (existingTxn[0]) {
        await db.update(accountTransactionsTable).set({ accountId: finalAccountId, amount: String(newTotal) }).where(eq(accountTransactionsTable.id, existingTxn[0].id));
      } else {
        await db.insert(accountTransactionsTable).values({
          accountId: finalAccountId,
          direction: "in",
          amount: String(newTotal),
          description: `فاتورة مبيعات رقم ${updated.invoiceNumber}`,
          category: "مبيعات",
          date: new Date().toISOString().slice(0, 10),
          reference: `invoice:${inv.id}`,
        });
      }
    } else if (updated.paymentMethod === "credit") {
      await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `invoice:${inv.id}`));
    }
  }

  let customerName = null;
  if (updated.customerId) {
    const custs = await db.select().from(customersTable).where(eq(customersTable.id, updated.customerId)).limit(1);
    customerName = custs[0]?.name ?? null;
  }
  return res.json(formatInvoice(updated, customerName));
});

/**
 * اعتماد فاتورة راجعها الأدمن.
 *
 * لا شيء يتحرك هنا: المخزون والخزينة تحرّكا لحظة البيع. هذه علامة تدقيق —
 * "رأيتها ووافقت" — واسم من وافق محفوظ معها.
 *
 * ممنوع على الكاشير في `require-auth.ts`؛ بدونه كان `POST /invoices/:id/approve`
 * يقع تحت سماحه بـ `POST /invoices` فيعتمد فواتير نفسه.
 */
router.post("/invoices/:id/approve", async (req, res) => {
  const userId = (req.session as any)?.userId;
  let approver: string | null = null;
  if (userId) {
    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
    approver = user?.name ?? null;
  }

  const [updated] = await db
    .update(invoicesTable)
    .set({ approvalStatus: "approved", approvedBy: approver, approvedAt: new Date() })
    .where(eq(invoicesTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "الفاتورة غير موجودة." });
  return res.json(formatInvoice(updated));
});

router.get("/invoices/:id/returns", async (req, res) => {
  const returns = await db
    .select()
    .from(invoiceReturnsTable)
    .where(eq(invoiceReturnsTable.invoiceId, Number(req.params.id)))
    .orderBy(sql`${invoiceReturnsTable.createdAt} DESC`);

  const result = [];
  for (const ret of returns) {
    const items = await db.select().from(invoiceReturnItemsTable).where(eq(invoiceReturnItemsTable.returnId, ret.id));
    result.push({
      ...ret,
      total: Number(ret.total),
      createdAt: ret.createdAt.toISOString(),
      items: items.map(i => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), total: Number(i.total) })),
    });
  }
  return res.json(result);
});

router.post("/invoices/:id/return", async (req, res) => {
  const { reason, items, accountId: overrideAccountId } = req.body;
  if (!items?.length) return res.status(400).json({ error: "items required" });

  const invRows = await db.select().from(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id))).limit(1);
  if (!invRows[0]) return res.status(404).json({ error: "Invoice not found" });
  const inv = invRows[0];

  const originalItems = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, inv.id));

  let returnTotal = 0;
  const returnItems: Array<{ productId: number; productName: string; quantity: number; unitPrice: number; total: number }> = [];

  for (const retItem of items) {
    const original = originalItems.find(o => o.productId === Number(retItem.productId));
    if (!original) return res.status(400).json({ error: `Item not found in invoice` });
    const qty = Number(retItem.quantity);
    if (qty <= 0) continue;
    if (qty > Number(original.quantity)) return res.status(400).json({ error: `Cannot return more than original quantity for ${original.productName}` });
    const price = Number(original.unitPrice);
    const itemTotal = qty * price;
    returnTotal += itemTotal;
    returnItems.push({ productId: original.productId, productName: original.productName, quantity: qty, unitPrice: price, total: itemTotal });
  }

  if (returnItems.length === 0) return res.status(400).json({ error: "No valid items to return" });

  const returnNumber = await generateReturnNumber(inv.invoiceNumber);

  const [ret] = await db.insert(invoiceReturnsTable).values({
    returnNumber,
    invoiceId: inv.id,
    reason: reason ?? null,
    total: String(returnTotal),
  }).returning();

  for (const item of returnItems) {
    await db.insert(invoiceReturnItemsTable).values({
      returnId: ret.id,
      productId: item.productId,
      productName: item.productName,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      total: String(item.total),
    });
    await db.update(productsTable).set({ stock: sql`${productsTable.stock} + ${item.quantity}` }).where(eq(productsTable.id, item.productId));
  }

  const allOriginalQty = originalItems.reduce((s, i) => s + Number(i.quantity), 0);
  const allReturnedQty = returnItems.reduce((s, i) => s + i.quantity, 0);
  const totalReturnedRows = await db.select({ cnt: sql<number>`COUNT(*)` }).from(invoiceReturnItemsTable)
    .innerJoin(invoiceReturnsTable, eq(invoiceReturnsTable.id, invoiceReturnItemsTable.returnId))
    .where(eq(invoiceReturnsTable.invoiceId, inv.id));
  const totalReturnedQtyRows = await db.select({ total: sql<number>`SUM(${invoiceReturnItemsTable.quantity}::numeric)` })
    .from(invoiceReturnItemsTable)
    .innerJoin(invoiceReturnsTable, eq(invoiceReturnsTable.id, invoiceReturnItemsTable.returnId))
    .where(eq(invoiceReturnsTable.invoiceId, inv.id));
  const totalReturnedQty = Number(totalReturnedQtyRows[0]?.total ?? 0);

  const newStatus = totalReturnedQty >= allOriginalQty ? "returned" : "partial_return";
  await db.update(invoicesTable).set({ status: newStatus }).where(eq(invoicesTable.id, inv.id));

  const effectiveAccountId = overrideAccountId && overrideAccountId !== "none" ? Number(overrideAccountId) : inv.accountId;
  if (effectiveAccountId) {
    await db.insert(accountTransactionsTable).values({
      accountId: effectiveAccountId,
      direction: "out",
      amount: String(returnTotal),
      description: `مرتجع فاتورة رقم ${inv.invoiceNumber} (${returnNumber})`,
      category: "مرتجعات",
      date: new Date().toISOString().slice(0, 10),
      reference: `invoice-return:${ret.id}`,
    });
  }

  return res.status(201).json({
    ...ret,
    total: Number(ret.total),
    createdAt: ret.createdAt.toISOString(),
    items: returnItems,
  });
});

router.delete("/invoices/:id", async (req, res) => {
  const returns = await db.select().from(invoiceReturnsTable).where(eq(invoiceReturnsTable.invoiceId, Number(req.params.id)));
  for (const ret of returns) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `invoice-return:${ret.id}`));
  }
  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `invoice:${req.params.id}`));
  await db.delete(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
