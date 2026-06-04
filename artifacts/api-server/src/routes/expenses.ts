import { Router } from "express";
import { db, expensesTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

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
  const { description, amount, category, date, notes } = req.body;
  if (!description || amount == null || !category || !date) return res.status(400).json({ error: "description, amount, category, date required" });
  const [e] = await db.insert(expensesTable).values({ description, amount: String(amount), category, date, notes }).returning();
  return res.status(201).json({ ...e, amount: Number(e.amount), createdAt: e.createdAt.toISOString() });
});

router.patch("/expenses/:id", async (req, res) => {
  const { description, amount, category, date, notes } = req.body;
  const updates: Record<string, any> = {};
  if (description !== undefined) updates.description = description;
  if (amount !== undefined) updates.amount = String(amount);
  if (category !== undefined) updates.category = category;
  if (date !== undefined) updates.date = date;
  if (notes !== undefined) updates.notes = notes;
  const [e] = await db.update(expensesTable).set(updates).where(eq(expensesTable.id, Number(req.params.id))).returning();
  if (!e) return res.status(404).json({ error: "Not found" });
  return res.json({ ...e, amount: Number(e.amount), createdAt: e.createdAt.toISOString() });
});

router.delete("/expenses/:id", async (req, res) => {
  await db.delete(expensesTable).where(eq(expensesTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
