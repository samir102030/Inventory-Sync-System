import { Router } from "express";
import { db, quotationsTable, quotationItemsTable, customersTable, productsTable, invoicesTable, invoiceItemsTable, invoiceSettingsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

async function generateQuotationNumber() {
  const count = await db.select({ cnt: sql<number>`COUNT(*)` }).from(quotationsTable);
  const num = (Number(count[0]?.cnt ?? 0) + 1).toString().padStart(5, "0");
  return `QUO-${num}`;
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

  res.json({
    ...formatQuotation(q, q.customerName),
    items: items.map(i => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
  });
});

router.post("/quotations", async (req, res) => {
  const { customerId, customerName, items = [], discount = 0, tax = 0, notes, validUntil } = req.body;
  const quotationNumber = await generateQuotationNumber();

  const subtotal = items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
  const total = subtotal - Number(discount) + Number(tax);

  const [quotation] = await db.insert(quotationsTable).values({
    quotationNumber,
    customerId: customerId || null,
    customerName: customerName || null,
    subtotal: String(subtotal),
    discount: String(discount),
    tax: String(tax),
    total: String(total),
    status: "draft",
    notes: notes || null,
    validUntil: validUntil || null,
    createdBy: (req.session as any)?.user?.username ?? null,
  }).returning();

  if (items.length > 0) {
    await db.insert(quotationItemsTable).values(
      items.map((i: any) => ({
        quotationId: quotation.id,
        productId: i.productId || null,
        productName: i.productName,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        total: String(i.quantity * i.unitPrice),
      }))
    );
  }

  res.json({ ...formatQuotation(quotation), items });
});

router.put("/quotations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { customerId, customerName, items = [], discount = 0, tax = 0, notes, validUntil, status } = req.body;

  const subtotal = items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
  const total = subtotal - Number(discount) + Number(tax);

  const [updated] = await db.update(quotationsTable).set({
    customerId: customerId || null,
    customerName: customerName || null,
    subtotal: String(subtotal),
    discount: String(discount),
    tax: String(tax),
    total: String(total),
    status: status || "draft",
    notes: notes || null,
    validUntil: validUntil || null,
  }).where(eq(quotationsTable.id, id)).returning();

  if (!updated) return res.status(404).json({ error: "not found" });

  await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
  if (items.length > 0) {
    await db.insert(quotationItemsTable).values(
      items.map((i: any) => ({
        quotationId: id,
        productId: i.productId || null,
        productName: i.productName,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        total: String(i.quantity * i.unitPrice),
      }))
    );
  }

  res.json({ ...formatQuotation(updated), items });
});

router.patch("/quotations/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const [updated] = await db.update(quotationsTable).set({ status }).where(eq(quotationsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "not found" });
  res.json(formatQuotation(updated));
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

  const settings = await db.select().from(invoiceSettingsTable).limit(1);
  const prefix = settings[0]?.invoicePrefix ?? "INV";
  const count = await db.select({ cnt: sql<number>`COUNT(*)` }).from(invoicesTable);
  const num = (Number(count[0]?.cnt ?? 0) + 1).toString().padStart(5, "0");
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
    createdBy: (req.session as any)?.user?.username ?? null,
  }).returning();

  if (items.length > 0) {
    await db.insert(invoiceItemsTable).values(
      items.map(i => ({
        invoiceId: invoice.id,
        productId: i.productId!,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: "0",
        total: i.total,
      }))
    );
  }

  await db.update(quotationsTable).set({ status: "converted" }).where(eq(quotationsTable.id, id));

  res.json({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
});

export default router;
