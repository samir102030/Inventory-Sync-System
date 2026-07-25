import { Router } from "express";
import { db, banksTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";

const router = Router();

router.get("/banks", async (req, res) => {
  const { search } = req.query;
  const rows = await db
    .select()
    .from(banksTable)
    .where(search ? ilike(banksTable.name, `%${search}%`) : undefined)
    .orderBy(banksTable.name);
  return res.json(rows.map(r => ({
    ...r,
    balance: Number(r.balance ?? 0),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/banks", async (req, res) => {
  const { name, accountNumber, accountName, branch, balance, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [b] = await db.insert(banksTable).values({
    name,
    accountNumber: accountNumber || null,
    accountName: accountName || null,
    branch: branch || null,
    balance: balance != null ? String(balance) : "0",
    notes: notes || null,
  }).returning();
  return res.status(201).json({ ...b, balance: Number(b.balance ?? 0), createdAt: b.createdAt.toISOString() });
});

/* ── Bulk import ── */
router.post("/banks/bulk-import", async (req, res) => {
  const { banks } = req.body;
  if (!Array.isArray(banks) || !banks.length)
    return res.status(400).json({ error: "banks array required" });

  const results = { created: 0, skipped: 0 };

  const valid = banks.filter(b => b.name?.trim());
  results.skipped += banks.length - valid.length;

  const rows = valid.map(b => ({
    name: b.name.trim(),
    accountNumber: b.accountNumber || null,
    accountName: b.accountName || null,
    branch: b.branch || null,
    balance: b.balance != null && !isNaN(Number(b.balance))
      ? String(Number(b.balance))
      : "0",
    notes: b.notes || null,
  }));

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      await db.insert(banksTable).values(batch);
      results.created += batch.length;
    } catch {
      for (const row of batch) {
        try {
          await db.insert(banksTable).values(row);
          results.created++;
        } catch { results.skipped++; }
      }
    }
  }

  return res.json(results);
});

router.get("/banks/:id", async (req, res) => {
  const [b] = await db.select().from(banksTable).where(eq(banksTable.id, Number(req.params.id))).limit(1);
  if (!b) return res.status(404).json({ error: "Not found" });
  return res.json({ ...b, balance: Number(b.balance ?? 0), createdAt: b.createdAt.toISOString() });
});

router.patch("/banks/:id", async (req, res) => {
  const { name, accountNumber, accountName, branch, balance, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (accountNumber !== undefined) updates.accountNumber = accountNumber;
  if (accountName !== undefined) updates.accountName = accountName;
  if (branch !== undefined) updates.branch = branch;
  if (balance !== undefined) updates.balance = String(balance);
  if (notes !== undefined) updates.notes = notes;
  const [b] = await db.update(banksTable).set(updates).where(eq(banksTable.id, Number(req.params.id))).returning();
  if (!b) return res.status(404).json({ error: "Not found" });
  return res.json({ ...b, balance: Number(b.balance ?? 0), createdAt: b.createdAt.toISOString() });
});

router.delete("/banks/:id", async (req, res) => {
  await db.delete(banksTable).where(eq(banksTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
