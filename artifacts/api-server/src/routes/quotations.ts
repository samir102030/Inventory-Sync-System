import { Router } from "express";
import { db, quotationsTable, quotationItemsTable, customersTable, productsTable, invoicesTable, invoiceItemsTable, invoiceSettingsTable, usersTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

// Derived from the highest number already issued, not from the row count.
// Counting rows reuses numbers after a deletion, which then collides with the
// UNIQUE constraint on quotation_number and blocks saving entirely.
async function generateQuotationNumber() {
  const [row] = await db
    .select({
      max: sql<number>`COALESCE(MAX(NULLIF(SUBSTRING(${quotationsTable.quotationNumber} FROM '[0-9]+$'), '')::int), 0)`,
    })
    .from(quotationsTable);
  const num = (Number(row?.max ?? 0) + 1).toString().padStart(5, "0");
  return `QUO-${num}`;
}

/**
 * حساب العرض: مجموع البنود بعد خصم كل بند، ثم الخصم العام، ثم الضريبة.
 *
 * الضريبة تُحسب من نسبة `invoice_settings.tax_rate` على الصافي بعد الخصم،
 * لا تُكتب مبلغًا يدويًا كما كان. العميل يستطيع تجاوزها بإرسال `tax` صراحةً
 * — بعض العروض تُسعَّر بمبلغ ضريبة متفق عليه.
 */
async function priceQuotation(items: any[], discount: unknown, tax: unknown) {
  const lines = items.map((i: any) => {
    const quantity = Number(i.quantity) || 0;
    const unitPrice = Number(i.unitPrice) || 0;
    const lineDiscount = Number(i.discount ?? 0) || 0;
    return { ...i, quantity, unitPrice, discount: lineDiscount, total: quantity * unitPrice - lineDiscount };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const discountAmount = Number(discount ?? 0) || 0;
  const net = subtotal - discountAmount;

  let taxAmount: number;
  if (tax === undefined || tax === null || tax === "") {
    const [settings] = await db
      .select({ rate: invoiceSettingsTable.taxRate, showTax: invoiceSettingsTable.showTax })
      .from(invoiceSettingsTable)
      .limit(1);
    const rate = settings?.showTax ? Number(settings.rate ?? 0) : 0;
    taxAmount = Math.round(net * (rate / 100) * 100) / 100;
  } else {
    taxAmount = Number(tax) || 0;
  }

  return { lines, subtotal, discountAmount, taxAmount, total: net + taxAmount };
}

/**
 * من أنشأ المستند.
 *
 * كان يقرأ `req.session.user?.username` وهذا الحقل لا يُضبط إطلاقًا — الجلسة
 * تحفظ `userId` و `role` فقط — فكان `created_by` فارغًا في كل عرض سعر.
 */
async function currentUserName(req: any): Promise<string | null> {
  const userId = (req.session as any)?.userId;
  if (!userId) return null;
  const [user] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.name ?? null;
}

function formatQuotation(q: any, customerName?: string | null) {
  return {
    id: q.id,
    quotationNumber: q.quotationNumber,
    customerId: q.customerId ?? null,
    customerName: customerName ?? q.customerName ?? null,
    subtotal: Number(q.subtotal),
    discount: Number(q.discount),
    tax: Number(q.tax),
    total: Number(q.total),
    status: q.status,
    notes: q.notes ?? null,
    validUntil: q.validUntil ?? null,
    createdBy: q.createdBy ?? null,
    createdAt: q.createdAt instanceof Date ? q.createdAt.toISOString() : q.createdAt,
  };
}

router.get("/quotations", async (req, res) => {
  const rows = await db
    .select({
      id: quotationsTable.id,
      quotationNumber: quotationsTable.quotationNumber,
      customerId: quotationsTable.customerId,
      customerName: customersTable.name,
      subtotal: quotationsTable.subtotal,
      discount: quotationsTable.discount,
      tax: quotationsTable.tax,
      total: quotationsTable.total,
      status: quotationsTable.status,
      notes: quotationsTable.notes,
      validUntil: quotationsTable.validUntil,
      createdBy: quotationsTable.createdBy,
      createdAt: quotationsTable.createdAt,
    })
    .from(quotationsTable)
    .leftJoin(customersTable, eq(quotationsTable.customerId, customersTable.id))
    .orderBy(desc(quotationsTable.createdAt));

  res.json(rows.map(r => formatQuotation(r, r.customerName)));
});

router.get("/quotations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [q] = await db
    .select({
      id: quotationsTable.id,
      quotationNumber: quotationsTable.quotationNumber,
      customerId: quotationsTable.customerId,
      customerName: customersTable.name,
      subtotal: quotationsTable.subtotal,
      discount: quotationsTable.discount,
      tax: quotationsTable.tax,
      total: quotationsTable.total,
      status: quotationsTable.status,
      notes: quotationsTable.notes,
      validUntil: quotationsTable.validUntil,
      createdBy: quotationsTable.createdBy,
      createdAt: quotationsTable.createdAt,
    })
    .from(quotationsTable)
    .leftJoin(customersTable, eq(quotationsTable.customerId, customersTable.id))
    .where(eq(quotationsTable.id, id));

  if (!q) return res.status(404).json({ error: "not found" });

  const items = await db
    .select()
    .from(quotationItemsTable)
    .where(eq(quotationItemsTable.quotationId, id));

  return res.json({
    ...formatQuotation(q, q.customerName),
    items: items.map(i => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discount: Number(i.discount ?? 0),
      total: Number(i.total),
    })),
  });
});

router.post("/quotations", async (req, res) => {
  const { customerId, customerName, items = [], discount = 0, tax, notes, validUntil } = req.body;
  const quotationNumber = await generateQuotationNumber();

  const priced = await priceQuotation(items, discount, tax);

  const [quotation] = await db.insert(quotationsTable).values({
    quotationNumber,
    customerId: customerId || null,
    customerName: customerName || null,
    subtotal: String(priced.subtotal),
    discount: String(priced.discountAmount),
    tax: String(priced.taxAmount),
    total: String(priced.total),
    status: "draft",
    notes: notes || null,
    validUntil: validUntil || null,
    createdBy: await currentUserName(req),
  }).returning();

  if (priced.lines.length > 0) {
    await db.insert(quotationItemsTable).values(
      priced.lines.map((i: any) => ({
        quotationId: quotation.id,
        productId: i.productId || null,
        productName: i.productName,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        discount: String(i.discount),
        total: String(i.total),
      }))
    );
  }

  return res.json({ ...formatQuotation(quotation), items: priced.lines });
});

router.put("/quotations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { customerId, customerName, items = [], discount = 0, tax, notes, validUntil, status } = req.body;

  const priced = await priceQuotation(items, discount, tax);

  const [updated] = await db.update(quotationsTable).set({
    customerId: customerId || null,
    customerName: customerName || null,
    subtotal: String(priced.subtotal),
    discount: String(priced.discountAmount),
    tax: String(priced.taxAmount),
    total: String(priced.total),
    status: status || "draft",
    notes: notes || null,
    validUntil: validUntil || null,
  }).where(eq(quotationsTable.id, id)).returning();

  if (!updated) return res.status(404).json({ error: "not found" });

  await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
  if (priced.lines.length > 0) {
    await db.insert(quotationItemsTable).values(
      priced.lines.map((i: any) => ({
        quotationId: id,
        productId: i.productId || null,
        productName: i.productName,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        discount: String(i.discount),
        total: String(i.total),
      }))
    );
  }

  return res.json({ ...formatQuotation(updated), items: priced.lines });
});

router.patch("/quotations/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const [updated] = await db.update(quotationsTable).set({ status }).where(eq(quotationsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "not found" });
  return res.json(formatQuotation(updated));
});

router.delete("/quotations/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(quotationsTable).where(eq(quotationsTable.id, id));
  res.json({ ok: true });
});

router.post("/quotations/:id/convert", async (req, res) => {
  const id = Number(req.params.id);

  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) return res.status(404).json({ error: "not found" });

  const items = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));

  // invoice_items.product_id is NOT NULL, so a quotation line typed by hand
  // (no catalogue product behind it) would fail at insert time with an opaque
  // database error. Fail early with something the user can act on instead.
  const unlinked = items.filter((i) => !i.productId).map((i) => i.productName);
  if (unlinked.length > 0) {
    return res.status(400).json({
      error:
        "لا يمكن تحويل العرض لفاتورة لأن البنود التالية غير مرتبطة بمنتج من المخزن: " +
        unlinked.join("، ") +
        ". افتح العرض واختر المنتج لكل بند منهم، أو أضفه للمنتجات أولاً.",
      code: "UNLINKED_ITEMS",
      items: unlinked,
    });
  }

  const settings = await db.select().from(invoiceSettingsTable).limit(1);
  const prefix = settings[0]?.invoicePrefix ?? "INV";
  const [maxRow] = await db
    .select({
      max: sql<number>`COALESCE(MAX(NULLIF(SUBSTRING(${invoicesTable.invoiceNumber} FROM '[0-9]+$'), '')::int), 0)`,
    })
    .from(invoicesTable);
  const num = (Number(maxRow?.max ?? 0) + 1).toString().padStart(5, "0");
  const invoiceNumber = `${prefix}-${num}`;

  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNumber,
    customerId: q.customerId,
    subtotal: q.subtotal,
    discount: q.discount,
    tax: q.tax,
    total: q.total,
    paymentMethod: "cash",
    status: "draft",
    notes: q.notes,
    createdBy: await currentUserName(req),
  }).returning();

  if (items.length > 0) {
    await db.insert(invoiceItemsTable).values(
      items.map(i => ({
        invoiceId: invoice.id,
        productId: i.productId!,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        // خصم البند ينتقل مع البند: بدونه ترتفع الفاتورة عن العرض المتفق عليه.
        discount: i.discount ?? "0",
        total: i.total,
      }))
    );
  }

  await db.update(quotationsTable).set({ status: "converted" }).where(eq(quotationsTable.id, id));

  return res.json({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
});

export default router;
