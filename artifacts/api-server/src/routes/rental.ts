import { Router } from "express";
import { db, rentalPaymentsTable, accountTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/rental", async (_req, res) => {
  const rows = await db.select().from(rentalPaymentsTable).orderBy(rentalPaymentsTable.date);
  return res.json(rows.map(r => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() })));
});

router.post("/rental", async (req, res) => {
  const { propertyName, tenantName, amount, period, date, accountId, notes } = req.body;
  if (!propertyName || !tenantName || amount == null || !period || !date)
    return res.status(400).json({ error: "propertyName, tenantName, amount, period, date required" });

  const [r] = await db.insert(rentalPaymentsTable).values({
    propertyName, tenantName,
    amount: String(amount),
    period, date,
    accountId: accountId ? Number(accountId) : null,
    notes,
  }).returning();

  if (r.accountId) {
    await db.insert(accountTransactionsTable).values({
      accountId: r.accountId,
      direction: "in",
      amount: String(amount),
      description: `إيجار: ${propertyName} — ${tenantName}`,
      category: "إيجار",
      date,
      reference: `rental:${r.id}`,
    });
  }

  return res.status(201).json({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() });
});

router.patch("/rental/:id", async (req, res) => {
  const { propertyName, tenantName, amount, period, date, accountId, notes } = req.body;
  const updates: Record<string, any> = {};
  if (propertyName !== undefined) updates.propertyName = propertyName;
  if (tenantName !== undefined) updates.tenantName = tenantName;
  if (amount !== undefined) updates.amount = String(amount);
  if (period !== undefined) updates.period = period;
  if (date !== undefined) updates.date = date;
  if (accountId !== undefined) updates.accountId = accountId ? Number(accountId) : null;
  if (notes !== undefined) updates.notes = notes;

  const [r] = await db.update(rentalPaymentsTable).set(updates).where(eq(rentalPaymentsTable.id, Number(req.params.id))).returning();
  if (!r) return res.status(404).json({ error: "Not found" });

  const ref = `rental:${r.id}`;
  const existing = await db.select().from(accountTransactionsTable).where(eq(accountTransactionsTable.reference, ref)).limit(1);

  if (r.accountId) {
    const txnData = {
      accountId: r.accountId,
      amount: String(r.amount),
      description: `إيجار: ${r.propertyName} — ${r.tenantName}`,
      category: "إيجار",
      date: r.date,
    };
    if (existing[0]) {
      await db.update(accountTransactionsTable).set(txnData).where(eq(accountTransactionsTable.id, existing[0].id));
    } else {
      await db.insert(accountTransactionsTable).values({ ...txnData, direction: "in", reference: ref });
    }
  } else if (existing[0]) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.id, existing[0].id));
  }

  return res.json({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() });
});

router.delete("/rental/:id", async (req, res) => {
  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `rental:${req.params.id}`));
  await db.delete(rentalPaymentsTable).where(eq(rentalPaymentsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
