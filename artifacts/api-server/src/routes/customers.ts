import { Router } from "express";
import { db, customersTable, invoicesTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";

const router = Router();

router.get("/customers", async (req, res) => {
  const { search } = req.query;
  const rows = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      whatsapp: customersTable.whatsapp,
      email: customersTable.email,
      address: customersTable.address,
      taxNumber: customersTable.taxNumber,
      notes: customersTable.notes,
      createdAt: customersTable.createdAt,
      totalPurchases: sql<number>`COALESCE(SUM(${invoicesTable.total}::numeric), 0)`,
    })
    .from(customersTable)
    .leftJoin(invoicesTable, eq(invoicesTable.customerId, customersTable.id))
    .where(search ? ilike(customersTable.name, `%${search}%`) : undefined)
    .groupBy(customersTable.id)
    .orderBy(customersTable.name);

  return res.json(rows.map(r => ({
    ...r,
    totalPurchases: Number(r.totalPurchases),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/customers", async (req, res) => {
  const { name, phone, whatsapp, email, address, taxNumber, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [c] = await db.insert(customersTable).values({ name, phone, whatsapp, email, address, taxNumber, notes }).returning();
  return res.status(201).json({ ...c, totalPurchases: 0, createdAt: c.createdAt.toISOString() });
});

router.get("/customers/:id", async (req, res) => {
  const rows = await db.select().from(customersTable).where(eq(customersTable.id, Number(req.params.id))).limit(1);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const c = rows[0];
  return res.json({ ...c, totalPurchases: null, createdAt: c.createdAt.toISOString() });
});

router.patch("/customers/:id", async (req, res) => {
  const { name, phone, whatsapp, email, address, taxNumber, notes } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (whatsapp !== undefined) updates.whatsapp = whatsapp;
  if (email !== undefined) updates.email = email;
  if (address !== undefined) updates.address = address;
  if (taxNumber !== undefined) updates.taxNumber = taxNumber;
  if (notes !== undefined) updates.notes = notes;
  const [c] = await db.update(customersTable).set(updates).where(eq(customersTable.id, Number(req.params.id))).returning();
  if (!c) return res.status(404).json({ error: "Not found" });
  return res.json({ ...c, totalPurchases: null, createdAt: c.createdAt.toISOString() });
});

router.delete("/customers/:id", async (req, res) => {
  await db.delete(customersTable).where(eq(customersTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
