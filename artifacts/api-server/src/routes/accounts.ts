import { Router } from "express";
import { db, accountsTable, accountTransactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/accounts", async (_req, res) => {
  const rows = await db
    .select({
      id: accountsTable.id,
      name: accountsTable.name,
      type: accountsTable.type,
      color: accountsTable.color,
      initialBalance: accountsTable.initialBalance,
      notes: accountsTable.notes,
      createdAt: accountsTable.createdAt,
      totalIn: sql<number>`COALESCE(SUM(CASE WHEN ${accountTransactionsTable.direction} = 'in' THEN ${accountTransactionsTable.amount}::numeric ELSE 0 END), 0)`,
      totalOut: sql<number>`COALESCE(SUM(CASE WHEN ${accountTransactionsTable.direction} = 'out' THEN ${accountTransactionsTable.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(accountsTable)
    .leftJoin(accountTransactionsTable, eq(accountTransactionsTable.accountId, accountsTable.id))
    .groupBy(accountsTable.id)
    .orderBy(accountsTable.createdAt);

  return res.json(rows.map(r => ({
    ...r,
    initialBalance: Number(r.initialBalance),
    totalIn: Number(r.totalIn),
    totalOut: Number(r.totalOut),
    balance: Number(r.initialBalance) + Number(r.totalIn) - Number(r.totalOut),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/accounts", async (req, res) => {
  const { name, type, color, initialBalance, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [a] = await db.insert(accountsTable).values({
    name, type: type ?? "cash", color: color ?? "#3b82f6",
    initialBalance: String(initialBalance ?? 0),
    notes: notes ?? null,
  }).returning();
  return res.status(201).json({ ...a, initialBalance: Number(a.initialBalance), totalIn: 0, totalOut: 0, balance: Number(a.initialBalance), createdAt: a.createdAt.toISOString() });
});

router.patch("/accounts/:id", async (req, res) => {
  const { name, type, color, initialBalance, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (color !== undefined) updates.color = color;
  if (initialBalance !== undefined) updates.initialBalance = String(initialBalance);
  if (notes !== undefined) updates.notes = notes;
  const [a] = await db.update(accountsTable).set(updates).where(eq(accountsTable.id, Number(req.params.id))).returning();
  if (!a) return res.status(404).json({ error: "Not found" });
  return res.json({ ...a, initialBalance: Number(a.initialBalance), createdAt: a.createdAt.toISOString() });
});

router.delete("/accounts/:id", async (req, res) => {
  await db.delete(accountsTable).where(eq(accountsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

router.get("/accounts/:id/transactions", async (req, res) => {
  const rows = await db
    .select()
    .from(accountTransactionsTable)
    .where(eq(accountTransactionsTable.accountId, Number(req.params.id)))
    .orderBy(sql`${accountTransactionsTable.date} DESC, ${accountTransactionsTable.createdAt} DESC`);
  return res.json(rows.map(r => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() })));
});

router.post("/accounts/transactions", async (req, res) => {
  const { accountId, direction, amount, description, category, date, reference } = req.body;
  if (!accountId || !direction || amount == null || !description || !date)
    return res.status(400).json({ error: "accountId, direction, amount, description, date required" });

  const [t] = await db.insert(accountTransactionsTable).values({
    accountId: Number(accountId),
    direction,
    amount: String(amount),
    description,
    category: category ?? null,
    date,
    reference: reference ?? null,
  }).returning();
  return res.status(201).json({ ...t, amount: Number(t.amount), createdAt: t.createdAt.toISOString() });
});

router.delete("/accounts/transactions/:id", async (req, res) => {
  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
