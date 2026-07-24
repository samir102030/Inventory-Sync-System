import { Router } from "express";
import { db, creditCardsTable, creditCardTransactionsTable, accountTransactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

/* ─── Cards ─── */

router.get("/credit-cards", async (_req, res) => {
  const cards = await db.select().from(creditCardsTable).orderBy(creditCardsTable.createdAt);
  // attach pending balance per card
  const result = await Promise.all(cards.map(async c => {
    const [row] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric),0)` })
      .from(creditCardTransactionsTable)
      .where(eq(creditCardTransactionsTable.cardId, c.id));
    const [pendingRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric),0)` })
      .from(creditCardTransactionsTable)
      .where(eq(creditCardTransactionsTable.cardId, c.id));
    const pending = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric),0)` })
      .from(creditCardTransactionsTable)
      .where(eq(creditCardTransactionsTable.cardId, c.id));
    return {
      ...c,
      creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
      createdAt: c.createdAt.toISOString(),
    };
  }));
  return res.json(result);
});

router.post("/credit-cards", async (req, res) => {
  const { name, lastFour, creditLimit, billingDay, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [c] = await db.insert(creditCardsTable).values({
    name,
    lastFour: lastFour || null,
    creditLimit: creditLimit ? String(creditLimit) : null,
    billingDay: billingDay ? Number(billingDay) : null,
    notes: notes || null,
  }).returning();
  return res.status(201).json({ ...c, creditLimit: c.creditLimit ? Number(c.creditLimit) : null, createdAt: c.createdAt.toISOString() });
});

router.patch("/credit-cards/:id", async (req, res) => {
  const { name, lastFour, creditLimit, billingDay, notes } = req.body;
  const upd: Record<string, any> = {};
  if (name !== undefined) upd.name = name;
  if (lastFour !== undefined) upd.lastFour = lastFour || null;
  if (creditLimit !== undefined) upd.creditLimit = creditLimit ? String(creditLimit) : null;
  if (billingDay !== undefined) upd.billingDay = billingDay ? Number(billingDay) : null;
  if (notes !== undefined) upd.notes = notes || null;
  const [c] = await db.update(creditCardsTable).set(upd).where(eq(creditCardsTable.id, Number(req.params.id))).returning();
  if (!c) return res.status(404).json({ error: "Not found" });
  return res.json({ ...c, creditLimit: c.creditLimit ? Number(c.creditLimit) : null, createdAt: c.createdAt.toISOString() });
});

router.delete("/credit-cards/:id", async (req, res) => {
  const id = Number(req.params.id);
  const txns = await db.select().from(creditCardTransactionsTable).where(eq(creditCardTransactionsTable.cardId, id));
  for (const t of txns) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `cc_payment:${t.id}`));
  }
  await db.delete(creditCardTransactionsTable).where(eq(creditCardTransactionsTable.cardId, id));
  await db.delete(creditCardsTable).where(eq(creditCardsTable.id, id));
  return res.json({ ok: true });
});

/* ─── Transactions ─── */

const fmtTxn = (t: any) => ({
  ...t,
  amount: Number(t.amount),
  createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
});

router.get("/credit-cards/:id/transactions", async (req, res) => {
  const rows = await db
    .select()
    .from(creditCardTransactionsTable)
    .where(eq(creditCardTransactionsTable.cardId, Number(req.params.id)))
    .orderBy(creditCardTransactionsTable.dueDate);
  return res.json(rows.map(fmtTxn));
});

router.post("/credit-cards/:id/transactions", async (req, res) => {
  const cardId = Number(req.params.id);
  const { description, amount, transactionDate, dueDate, notes } = req.body;
  if (!description || amount == null || !transactionDate || !dueDate)
    return res.status(400).json({ error: "description, amount, transactionDate, dueDate required" });

  const [t] = await db.insert(creditCardTransactionsTable).values({
    cardId, description,
    amount: String(amount),
    transactionDate, dueDate,
    status: "pending",
    notes: notes || null,
  }).returning();
  return res.status(201).json(fmtTxn(t));
});

router.patch("/credit-cards/transactions/:id", async (req, res) => {
  const { description, amount, transactionDate, dueDate, status, paidDate, accountId, notes } = req.body;
  const upd: Record<string, any> = {};
  if (description !== undefined) upd.description = description;
  if (amount !== undefined) upd.amount = String(amount);
  if (transactionDate !== undefined) upd.transactionDate = transactionDate;
  if (dueDate !== undefined) upd.dueDate = dueDate;
  if (notes !== undefined) upd.notes = notes || null;
  if (accountId !== undefined) upd.accountId = accountId ? Number(accountId) : null;

  // Handle status change to paid
  const oldRows = await db.select().from(creditCardTransactionsTable).where(eq(creditCardTransactionsTable.id, Number(req.params.id))).limit(1);
  if (!oldRows[0]) return res.status(404).json({ error: "Not found" });
  const old = oldRows[0];

  if (status !== undefined && status !== old.status) {
    upd.status = status;
    if (status === "paid") {
      upd.paidDate = paidDate || new Date().toISOString().slice(0, 10);
      upd.accountId = accountId ? Number(accountId) : old.accountId;
    } else {
      upd.paidDate = null;
    }
  }

  const [t] = await db.update(creditCardTransactionsTable).set(upd).where(eq(creditCardTransactionsTable.id, Number(req.params.id))).returning();
  if (!t) return res.status(404).json({ error: "Not found" });

  // Sync account transaction
  const ref = `cc_payment:${t.id}`;
  const existing = await db.select().from(accountTransactionsTable).where(eq(accountTransactionsTable.reference, ref)).limit(1);

  if (t.status === "paid" && t.accountId) {
    const txnData = {
      accountId: t.accountId,
      amount: String(t.amount),
      description: `سداد كريدت كارد: ${t.description}`,
      category: "كريدت كارد",
      date: t.paidDate!,
    };
    if (existing[0]) {
      await db.update(accountTransactionsTable).set(txnData).where(eq(accountTransactionsTable.id, existing[0].id));
    } else {
      await db.insert(accountTransactionsTable).values({ ...txnData, direction: "out", reference: ref });
    }
  } else if (t.status === "pending" && existing[0]) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.id, existing[0].id));
  }

  return res.json(fmtTxn(t));
});

router.delete("/credit-cards/transactions/:id", async (req, res) => {
  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `cc_payment:${req.params.id}`));
  await db.delete(creditCardTransactionsTable).where(eq(creditCardTransactionsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
