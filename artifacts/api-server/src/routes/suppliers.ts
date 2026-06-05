import { Router } from "express";
import { db, suppliersTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";

const router = Router();

router.get("/suppliers", async (req, res) => {
  const { search } = req.query;
  const rows = await db
    .select()
    .from(suppliersTable)
    .where(search ? ilike(suppliersTable.name, `%${search}%`) : undefined)
    .orderBy(suppliersTable.name);
  return res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/suppliers", async (req, res) => {
  const { name, phone, whatsapp, address, taxNumber, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [s] = await db.insert(suppliersTable).values({ name, phone, whatsapp, address, taxNumber, notes }).returning();
  return res.status(201).json({ ...s, createdAt: s.createdAt.toISOString() });
});

router.get("/suppliers/:id", async (req, res) => {
  const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, Number(req.params.id))).limit(1);
  if (!s) return res.status(404).json({ error: "Not found" });
  return res.json({ ...s, createdAt: s.createdAt.toISOString() });
});

router.patch("/suppliers/:id", async (req, res) => {
  const { name, phone, whatsapp, address, taxNumber, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (whatsapp !== undefined) updates.whatsapp = whatsapp;
  if (address !== undefined) updates.address = address;
  if (taxNumber !== undefined) updates.taxNumber = taxNumber;
  if (notes !== undefined) updates.notes = notes;
  const [s] = await db.update(suppliersTable).set(updates).where(eq(suppliersTable.id, Number(req.params.id))).returning();
  if (!s) return res.status(404).json({ error: "Not found" });
  return res.json({ ...s, createdAt: s.createdAt.toISOString() });
});

router.delete("/suppliers/:id", async (req, res) => {
  await db.delete(suppliersTable).where(eq(suppliersTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
