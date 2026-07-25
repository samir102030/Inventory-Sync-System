import { Router } from "express";
import { db, suppliersTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";

const router = Router();

router.get("/suppliers", async (req, res) => {
  const { search } = req.query;
  const rows = await db
    .select()
    .from(suppliersTable)
    .where(search ? ilike(suppliersTable.name, `%${search}%`) : undefined)
    .orderBy(suppliersTable.name);
  return res.json(rows.map(r => ({ ...r, openingBalance: Number(r.openingBalance ?? 0), createdAt: r.createdAt.toISOString() })));
});

router.post("/suppliers", async (req, res) => {
  const { name, phone, whatsapp, address, taxNumber, notes, openingBalance } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [s] = await db.insert(suppliersTable).values({
    name, phone, whatsapp, address, taxNumber, notes,
    openingBalance: openingBalance != null ? String(openingBalance) : "0",
  }).returning();
  return res.status(201).json({ ...s, openingBalance: Number(s.openingBalance ?? 0), createdAt: s.createdAt.toISOString() });
});

/* ── Bulk import ── */
router.post("/suppliers/bulk-import", async (req, res) => {
  const { suppliers } = req.body;
  if (!Array.isArray(suppliers) || !suppliers.length)
    return res.status(400).json({ error: "suppliers array required" });

  const results = { created: 0, skipped: 0 };

  const valid = suppliers.filter(s => s.name?.trim());
  results.skipped += suppliers.length - valid.length;

  const rows = valid.map(s => ({
    name: s.name.trim(),
    phone: s.phone || null,
    whatsapp: s.whatsapp || null,
    address: s.address || null,
    taxNumber: s.taxNumber || null,
    notes: s.notes || null,
    openingBalance: s.openingBalance != null && !isNaN(Number(s.openingBalance))
      ? String(Number(s.openingBalance))
      : "0",
  }));

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      await db.insert(suppliersTable).values(batch);
      results.created += batch.length;
    } catch {
      for (const row of batch) {
        try {
          await db.insert(suppliersTable).values(row);
          results.created++;
        } catch { results.skipped++; }
      }
    }
  }

  return res.json(results);
});

router.get("/suppliers/:id", async (req, res) => {
  const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, Number(req.params.id))).limit(1);
  if (!s) return res.status(404).json({ error: "Not found" });
  return res.json({ ...s, openingBalance: Number(s.openingBalance ?? 0), createdAt: s.createdAt.toISOString() });
});

router.patch("/suppliers/:id", async (req, res) => {
  const { name, phone, whatsapp, address, taxNumber, notes, openingBalance } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (whatsapp !== undefined) updates.whatsapp = whatsapp;
  if (address !== undefined) updates.address = address;
  if (taxNumber !== undefined) updates.taxNumber = taxNumber;
  if (notes !== undefined) updates.notes = notes;
  if (openingBalance !== undefined) updates.openingBalance = String(openingBalance);
  const [s] = await db.update(suppliersTable).set(updates).where(eq(suppliersTable.id, Number(req.params.id))).returning();
  if (!s) return res.status(404).json({ error: "Not found" });
  return res.json({ ...s, openingBalance: Number(s.openingBalance ?? 0), createdAt: s.createdAt.toISOString() });
});

router.delete("/suppliers/:id", async (req, res) => {
  await db.delete(suppliersTable).where(eq(suppliersTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
