import { Router } from "express";
import { db, receiptVouchersTable, paymentVouchersTable, customersTable, suppliersTable, accountTransactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

const PAYMENT_CATEGORY_LABELS: Record<string, string> = { supplier: "مورد", employee: "موظف", other: "أخرى" };

router.get("/receipt-vouchers", async (_req, res) => {
  const rows = await db.select().from(receiptVouchersTable).orderBy(sql`${receiptVouchersTable.createdAt} DESC`);
  return res.json(rows.map(r => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() })));
});

router.post("/receipt-vouchers", async (req, res) => {
  const { customerId, customerName, amount, date, accountId, reference, notes } = req.body;
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
    accountId: accountId ? Number(accountId) : null,
    reference: reference ?? null,
    notes: notes ?? null,
  }).returning();

  if (v.accountId) {
    await db.insert(accountTransactionsTable).values({
      accountId: v.accountId,
      direction: "in",
      amount: String(amount),
      description: `سند قبض رقم ${voucherNumber}${custLabel ? ` — ${custLabel}` : ""}`,
      category: "سندات قبض",
      date,
      reference: `receipt-voucher:${v.id}`,
    });
  }

  return res.status(201).json({ ...v, amount: Number(v.amount), createdAt: v.createdAt.toISOString() });
});

router.patch("/receipt-vouchers/:id", async (req, res) => {
  const { amount, date, accountId, reference, notes, customerName } = req.body;
  const updates: Record<string, unknown> = {};
  if (amount !== undefined) updates.amount = String(amount);
  if (date !== undefined) updates.date = date;
  if (accountId !== undefined) updates.accountId = accountId ? Number(accountId) : null;
  if (reference !== undefined) updates.reference = reference;
  if (notes !== undefined) updates.notes = notes;
  if (customerName !== undefined) updates.customerName = customerName;
  const [v] = await db.update(receiptVouchersTable).set(updates).where(eq(receiptVouchersTable.id, Number(req.params.id))).returning();
  if (!v) return res.status(404).json({ error: "Not found" });

  const existingTxn = await db.select().from(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `receipt-voucher:${v.id}`)).limit(1);
  if (v.accountId) {
    if (existingTxn[0]) {
      await db.update(accountTransactionsTable).set({ accountId: v.accountId, amount: String(v.amount), date: v.date, description: `سند قبض رقم ${v.voucherNumber}${v.customerName ? ` — ${v.customerName}` : ""}` }).where(eq(accountTransactionsTable.id, existingTxn[0].id));
    } else {
      await db.insert(accountTransactionsTable).values({
        accountId: v.accountId,
        direction: "in",
        amount: String(v.amount),
        description: `سند قبض رقم ${v.voucherNumber}${v.customerName ? ` — ${v.customerName}` : ""}`,
        category: "سندات قبض",
        date: v.date,
        reference: `receipt-voucher:${v.id}`,
      });
    }
  } else if (existingTxn[0]) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.id, existingTxn[0].id));
  }

  return res.json({ ...v, amount: Number(v.amount), createdAt: v.createdAt.toISOString() });
});

router.delete("/receipt-vouchers/:id", async (req, res) => {
  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `receipt-voucher:${req.params.id}`));
  await db.delete(receiptVouchersTable).where(eq(receiptVouchersTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

router.get("/payment-vouchers", async (_req, res) => {
  const rows = await db.select().from(paymentVouchersTable).orderBy(sql`${paymentVouchersTable.createdAt} DESC`);
  return res.json(rows.map(r => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() })));
});

router.post("/payment-vouchers", async (req, res) => {
  const { supplierId, paidTo, category, amount, date, accountId, reference, notes } = req.body;
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
    accountId: accountId ? Number(accountId) : null,
    reference: reference ?? null,
    notes: notes ?? null,
  }).returning();

  if (v.accountId) {
    await db.insert(accountTransactionsTable).values({
      accountId: v.accountId,
      direction: "out",
      amount: String(amount),
      description: `سند صرف رقم ${voucherNumber} — ${supplLabel}`,
      category: PAYMENT_CATEGORY_LABELS[v.category] ?? v.category,
      date,
      reference: `payment-voucher:${v.id}`,
    });
  }

  return res.status(201).json({ ...v, amount: Number(v.amount), createdAt: v.createdAt.toISOString() });
});

router.patch("/payment-vouchers/:id", async (req, res) => {
  const { paidTo, category, amount, date, accountId, reference, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (paidTo !== undefined) updates.paidTo = paidTo;
  if (category !== undefined) updates.category = category;
  if (amount !== undefined) updates.amount = String(amount);
  if (date !== undefined) updates.date = date;
  if (accountId !== undefined) updates.accountId = accountId ? Number(accountId) : null;
  if (reference !== undefined) updates.reference = reference;
  if (notes !== undefined) updates.notes = notes;
  const [v] = await db.update(paymentVouchersTable).set(updates).where(eq(paymentVouchersTable.id, Number(req.params.id))).returning();
  if (!v) return res.status(404).json({ error: "Not found" });

  const existingTxn = await db.select().from(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `payment-voucher:${v.id}`)).limit(1);
  if (v.accountId) {
    if (existingTxn[0]) {
      await db.update(accountTransactionsTable).set({ accountId: v.accountId, amount: String(v.amount), date: v.date, description: `سند صرف رقم ${v.voucherNumber} — ${v.paidTo}`, category: PAYMENT_CATEGORY_LABELS[v.category] ?? v.category }).where(eq(accountTransactionsTable.id, existingTxn[0].id));
    } else {
      await db.insert(accountTransactionsTable).values({
        accountId: v.accountId,
        direction: "out",
        amount: String(v.amount),
        description: `سند صرف رقم ${v.voucherNumber} — ${v.paidTo}`,
        category: PAYMENT_CATEGORY_LABELS[v.category] ?? v.category,
        date: v.date,
        reference: `payment-voucher:${v.id}`,
      });
    }
  } else if (existingTxn[0]) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.id, existingTxn[0].id));
  }

  return res.json({ ...v, amount: Number(v.amount), createdAt: v.createdAt.toISOString() });
});

router.delete("/payment-vouchers/:id", async (req, res) => {
  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `payment-voucher:${req.params.id}`));
  await db.delete(paymentVouchersTable).where(eq(paymentVouchersTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
