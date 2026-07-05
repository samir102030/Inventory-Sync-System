import { Router } from "express";
import { db, expensesTable, accountTransactionsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

const EXPENSE_CATEGORY_LABELS: Record<string, string> = { rent: "إيجار", utilities: "خدمات وفواتير", salaries: "رواتب", other: "أخرى" };

router.get("/expenses", async (req, res) => {
  const { startDate, endDate, category } = req.query;
  const conditions = [];
  if (startDate) conditions.push(gte(expensesTable.date, String(startDate)));
  if (endDate) conditions.push(lte(expensesTable.date, String(endDate)));
  if (category) conditions.push(eq(expensesTable.category, String(category)));
  const rows = await db.select().from(expensesTable).where(conditions.length ? and(...conditions) : undefined).orderBy(expensesTable.date);
  return res.json(rows.map(r => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() })));
});

router.post("/expenses", async (req, res) => {
  const { description, amount, category, date, accountId, notes } = req.body;
  if (!description || amount == null || !category || !date) return res.status(400).json({ error: "description, amount, category, date required" });
  const [e] = await db.insert(expensesTable).values({ description, amount: String(amount), category, date, accountId: accountId ? Number(accountId) : null, notes }).returning();

  if (e.accountId) {
    await db.insert(accountTransactionsTable).values({
      accountId: e.accountId,
      direction: "out",
      amount: String(amount),
      description: `مصروف: ${description}`,
      category: EXPENSE_CATEGORY_LABELS[category] ?? category,
      date,
      reference: `expense:${e.id}`,
    });
  }

  return res.status(201).json({ ...e, amount: Number(e.amount), createdAt: e.createdAt.toISOString() });
});

router.patch("/expenses/:id", async (req, res) => {
  const { description, amount, category, date, accountId, notes } = req.body;
  const updates: Record<string, any> = {};
  if (description !== undefined) updates.description = description;
  if (amount !== undefined) updates.amount = String(amount);
  if (category !== undefined) updates.category = category;
  if (date !== undefined) updates.date = date;
  if (accountId !== undefined) updates.accountId = accountId ? Number(accountId) : null;
  if (notes !== undefined) updates.notes = notes;
  const [e] = await db.update(expensesTable).set(updates).where(eq(expensesTable.id, Number(req.params.id))).returning();
  if (!e) return res.status(404).json({ error: "Not found" });

  const existingTxn = await db.select().from(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `expense:${e.id}`)).limit(1);
  if (e.accountId) {
    if (existingTxn[0]) {
      await db.update(accountTransactionsTable).set({
        accountId: e.accountId,
        amount: String(e.amount),
        description: `مصروف: ${e.description}`,
        category: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
        date: e.date,
      }).where(eq(accountTransactionsTable.id, existingTxn[0].id));
    } else {
      await db.insert(accountTransactionsTable).values({
        accountId: e.accountId,
        direction: "out",
        amount: String(e.amount),
        description: `مصروف: ${e.description}`,
        category: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
        date: e.date,
        reference: `expense:${e.id}`,
      });
    }
  } else if (existingTxn[0]) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.id, existingTxn[0].id));
  }

  return res.json({ ...e, amount: Number(e.amount), createdAt: e.createdAt.toISOString() });
});

router.delete("/expenses/:id", async (req, res) => {
  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `expense:${req.params.id}`));
  await db.delete(expensesTable).where(eq(expensesTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
