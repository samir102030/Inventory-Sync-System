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

/* ── Bulk import ── */
router.post("/accounts/bulk-import", async (req, res) => {
  const { accounts } = req.body;
  if (!Array.isArray(accounts) || !accounts.length)
    return res.status(400).json({ error: "accounts array required" });

  const results = { created: 0, skipped: 0 };
  const valid = accounts.filter(a => a.name?.trim());
  results.skipped += accounts.length - valid.length;

  const rows = valid.map(a => ({
    name: a.name.trim(),
    type: ["cash","bank","wallet","other"].includes(a.type) ? a.type : "cash",
    color: /^#[0-9a-fA-F]{6}$/.test(a.color ?? "") ? a.color : "#3b82f6",
    initialBalance: a.initialBalance != null && !isNaN(Number(a.initialBalance))
      ? String(Number(a.initialBalance)) : "0",
    notes: a.notes || null,
  }));

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      await db.insert(accountsTable).values(batch);
      results.created += batch.length;
    } catch {
      for (const row of batch) {
        try { await db.insert(accountsTable).values(row); results.created++; }
        catch { results.skipped++; }
      }
    }
  }
  return res.json(results);
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

router.post("/accounts/transfer", async (req, res) => {
  const { fromAccountId, toAccountId, amount, date, notes } = req.body;
  if (!fromAccountId || !toAccountId || amount == null || !date)
    return res.status(400).json({ error: "fromAccountId, toAccountId, amount, date required" });
  if (Number(fromAccountId) === Number(toAccountId))
    return res.status(400).json({ error: "لا يمكن التحويل لنفس الحساب" });
  if (Number(amount) <= 0)
    return res.status(400).json({ error: "المبلغ يجب أن يكون أكبر من صفر" });

  const [fromAccount] = await db.select().from(accountsTable).where(eq(accountsTable.id, Number(fromAccountId))).limit(1);
  const [toAccount] = await db.select().from(accountsTable).where(eq(accountsTable.id, Number(toAccountId))).limit(1);
  if (!fromAccount || !toAccount) return res.status(404).json({ error: "الحساب غير موجود" });

  const transferRef = `transfer:${fromAccountId}-${toAccountId}-${Date.now()}`;

  const [outTxn] = await db.insert(accountTransactionsTable).values({
    accountId: Number(fromAccountId),
    direction: "out",
    amount: String(amount),
    description: `تحويل إلى ${toAccount.name}${notes ? ` — ${notes}` : ""}`,
    category: "تحويل بين حسابات",
    date,
    reference: transferRef,
  }).returning();

  const [inTxn] = await db.insert(accountTransactionsTable).values({
    accountId: Number(toAccountId),
    direction: "in",
    amount: String(amount),
    description: `تحويل من ${fromAccount.name}${notes ? ` — ${notes}` : ""}`,
    category: "تحويل بين حسابات",
    date,
    reference: transferRef,
  }).returning();

  return res.status(201).json({
    outTxn: { ...outTxn, amount: Number(outTxn.amount), createdAt: outTxn.createdAt.toISOString() },
    inTxn: { ...inTxn, amount: Number(inTxn.amount), createdAt: inTxn.createdAt.toISOString() },
  });
});

export default router;
