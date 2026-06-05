import { Router } from "express";
import { db, receiptVouchersTable, paymentVouchersTable, customersTable, suppliersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/receipt-vouchers", async (_req, res) => {
  const rows = await db.select().from(receiptVouchersTable).orderBy(sql`${receiptVouchersTable.createdAt} DESC`);
  return res.json(rows.map(r => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() })));
});

router.post("/receipt-vouchers", async (req, res) => {
  const { customerId, customerName, amount, date, reference, notes } = req.body;
  if (!amount || !date) return res.status(400).json({ error: "amount and date required" });

  const [{ cnt }] = await db.select({ cnt: sql<number>`COUNT(*)` }).from(receiptVouchersTable);
  const voucherNumber = `RV-${String(Number(cnt) + 1).padStart(4, "0")}`;

  const custLabel = customerId
    ? (await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1))[0]?.name ?? customerName ?? null
    : (customerName ?? null);

  const [v] = await db.insert(receiptVouchersTable).values({
    voucherNumber,
    customerId: customerId ?? null,
    customerName: custLabel,
    amount: String(amount),
    date,
    reference: reference ?? null,
    notes: notes ?? null,
  }).returning();

  return res.status(201).json({ ...v, amount: Number(v.amount), createdAt: v.createdAt.toISOString() });
});

router.patch("/receipt-vouchers/:id", async (req, res) => {
  const { amount, date, reference, notes, customerName } = req.body;
  const updates: Record<string, unknown> = {};
  if (amount !== undefined) updates.amount = String(amount);
  if (date !== undefined) updates.date = date;
  if (reference !== undefined) updates.reference = reference;
  if (notes !== undefined) updates.notes = notes;
  if (customerName !== undefined) updates.customerName = customerName;
  const [v] = await db.update(receiptVouchersTable).set(updates).where(eq(receiptVouchersTable.id, Number(req.params.id))).returning();
  if (!v) return res.status(404).json({ error: "Not found" });
  return res.json({ ...v, amount: Number(v.amount), createdAt: v.createdAt.toISOString() });
});

router.delete("/receipt-vouchers/:id", async (req, res) => {
  await db.delete(receiptVouchersTable).where(eq(receiptVouchersTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

router.get("/payment-vouchers", async (_req, res) => {
  const rows = await db.select().from(paymentVouchersTable).orderBy(sql`${paymentVouchersTable.createdAt} DESC`);
  return res.json(rows.map(r => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() })));
});

router.post("/payment-vouchers", async (req, res) => {
  const { supplierId, paidTo, category, amount, date, reference, notes } = req.body;
  if (!paidTo || !amount || !date) return res.status(400).json({ error: "paidTo, amount and date required" });

  const [{ cnt }] = await db.select({ cnt: sql<number>`COUNT(*)` }).from(paymentVouchersTable);
  const voucherNumber = `PV-${String(Number(cnt) + 1).padStart(4, "0")}`;

  const supplLabel = supplierId
    ? (await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, supplierId)).limit(1))[0]?.name ?? paidTo
    : paidTo;

  const [v] = await db.insert(paymentVouchersTable).values({
    voucherNumber,
    supplierId: supplierId ?? null,
    paidTo: supplLabel,
    category: category ?? "supplier",
    amount: String(amount),
    date,
    reference: reference ?? null,
    notes: notes ?? null,
  }).returning();

  return res.status(201).json({ ...v, amount: Number(v.amount), createdAt: v.createdAt.toISOString() });
});

router.patch("/payment-vouchers/:id", async (req, res) => {
  const { paidTo, category, amount, date, reference, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (paidTo !== undefined) updates.paidTo = paidTo;
  if (category !== undefined) updates.category = category;
  if (amount !== undefined) updates.amount = String(amount);
  if (date !== undefined) updates.date = date;
  if (reference !== undefined) updates.reference = reference;
  if (notes !== undefined) updates.notes = notes;
  const [v] = await db.update(paymentVouchersTable).set(updates).where(eq(paymentVouchersTable.id, Number(req.params.id))).returning();
  if (!v) return res.status(404).json({ error: "Not found" });
  return res.json({ ...v, amount: Number(v.amount), createdAt: v.createdAt.toISOString() });
});

router.delete("/payment-vouchers/:id", async (req, res) => {
  await db.delete(paymentVouchersTable).where(eq(paymentVouchersTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
