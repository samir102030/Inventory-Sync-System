import { Router } from "express";
import { db, licensesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/licenses", async (_req, res) => {
  const rows = await db.select().from(licensesTable).orderBy(licensesTable.expiryDate);
  return res.json(rows.map(r => ({ ...r, cost: r.cost != null ? Number(r.cost) : null, createdAt: r.createdAt.toISOString() })));
});

router.post("/licenses", async (req, res) => {
  const { name, licenseKey, vendor, expiryDate, status, notes, cost } = req.body;
  if (!name || !licenseKey || !expiryDate) return res.status(400).json({ error: "name, licenseKey, expiryDate required" });
  const [l] = await db.insert(licensesTable).values({ name, licenseKey, vendor, expiryDate, status: status ?? "active", notes, cost: cost != null ? String(cost) : null }).returning();
  return res.status(201).json({ ...l, cost: l.cost != null ? Number(l.cost) : null, createdAt: l.createdAt.toISOString() });
});

router.patch("/licenses/:id", async (req, res) => {
  const { name, licenseKey, vendor, expiryDate, status, notes, cost } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (licenseKey !== undefined) updates.licenseKey = licenseKey;
  if (vendor !== undefined) updates.vendor = vendor;
  if (expiryDate !== undefined) updates.expiryDate = expiryDate;
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (cost !== undefined) updates.cost = cost != null ? String(cost) : null;
  const [l] = await db.update(licensesTable).set(updates).where(eq(licensesTable.id, Number(req.params.id))).returning();
  if (!l) return res.status(404).json({ error: "Not found" });
  return res.json({ ...l, cost: l.cost != null ? Number(l.cost) : null, createdAt: l.createdAt.toISOString() });
});

router.delete("/licenses/:id", async (req, res) => {
  await db.delete(licensesTable).where(eq(licensesTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
