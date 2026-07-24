import { Router } from "express";
import { db, jam3iyyatTable, jam3iyyaPaymentsTable, accountTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

/* ── Jam3iyyat (savings clubs) ── */

router.get("/jam3iyyat", async (_req, res) => {
  const rows = await db.select().from(jam3iyyatTable).orderBy(jam3iyyatTable.startDate);
  return res.json(rows.map(r => ({ ...r, amountPerMember: Number(r.amountPerMember), createdAt: r.createdAt.toISOString() })));
});

router.post("/jam3iyyat", async (req, res) => {
  const { name, totalMembers, amountPerMember, myTurn, startDate, notes } = req.body;
  if (!name || !totalMembers || amountPerMember == null || !myTurn || !startDate)
    return res.status(400).json({ error: "name, totalMembers, amountPerMember, myTurn, startDate required" });

  const [j] = await db.insert(jam3iyyatTable).values({
    name, totalMembers: Number(totalMembers),
    amountPerMember: String(amountPerMember),
    myTurn: Number(myTurn),
    startDate, notes,
  }).returning();

  return res.status(201).json({ ...j, amountPerMember: Number(j.amountPerMember), createdAt: j.createdAt.toISOString() });
});

router.patch("/jam3iyyat/:id", async (req, res) => {
  const { name, totalMembers, amountPerMember, myTurn, startDate, notes } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (totalMembers !== undefined) updates.totalMembers = Number(totalMembers);
  if (amountPerMember !== undefined) updates.amountPerMember = String(amountPerMember);
  if (myTurn !== undefined) updates.myTurn = Number(myTurn);
  if (startDate !== undefined) updates.startDate = startDate;
  if (notes !== undefined) updates.notes = notes;

  const [j] = await db.update(jam3iyyatTable).set(updates).where(eq(jam3iyyatTable.id, Number(req.params.id))).returning();
  if (!j) return res.status(404).json({ error: "Not found" });
  return res.json({ ...j, amountPerMember: Number(j.amountPerMember), createdAt: j.createdAt.toISOString() });
});

router.delete("/jam3iyyat/:id", async (req, res) => {
  const id = Number(req.params.id);
  const payments = await db.select().from(jam3iyyaPaymentsTable).where(eq(jam3iyyaPaymentsTable.jam3iyyaId, id));
  for (const p of payments) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `jam3iyya_payment:${p.id}`));
  }
  await db.delete(jam3iyyaPaymentsTable).where(eq(jam3iyyaPaymentsTable.jam3iyyaId, id));
  await db.delete(jam3iyyatTable).where(eq(jam3iyyatTable.id, id));
  return res.json({ ok: true });
});

/* ── Payments per jam3iyya ── */

router.get("/jam3iyyat/:id/payments", async (req, res) => {
  const rows = await db.select().from(jam3iyyaPaymentsTable)
    .where(eq(jam3iyyaPaymentsTable.jam3iyyaId, Number(req.params.id)))
    .orderBy(jam3iyyaPaymentsTable.month);
  return res.json(rows.map(r => ({ ...r, amount: Number(r.amount), createdAt: r.createdAt.toISOString() })));
});

router.post("/jam3iyyat/:id/payments", async (req, res) => {
  const jam3iyyaId = Number(req.params.id);
  const { month, amount, accountId, notes } = req.body;
  if (!month || amount == null) return res.status(400).json({ error: "month, amount required" });

  const jam3iyya = await db.select().from(jam3iyyatTable).where(eq(jam3iyyatTable.id, jam3iyyaId)).limit(1);
  if (!jam3iyya[0]) return res.status(404).json({ error: "Jam3iyya not found" });

  const [p] = await db.insert(jam3iyyaPaymentsTable).values({
    jam3iyyaId,
    month,
    amount: String(amount),
    accountId: accountId ? Number(accountId) : null,
    notes,
  }).returning();

  if (p.accountId) {
    await db.insert(accountTransactionsTable).values({
      accountId: p.accountId,
      direction: "out",
      amount: String(amount),
      description: `جمعية: ${jam3iyya[0].name} — ${month}`,
      category: "جمعيات",
      date: `${month}-01`,
      reference: `jam3iyya_payment:${p.id}`,
    });
  }

  return res.status(201).json({ ...p, amount: Number(p.amount), createdAt: p.createdAt.toISOString() });
});

router.delete("/jam3iyyat/payments/:id", async (req, res) => {
  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `jam3iyya_payment:${req.params.id}`));
  await db.delete(jam3iyyaPaymentsTable).where(eq(jam3iyyaPaymentsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
