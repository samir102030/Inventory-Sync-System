import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/categories", async (_req, res) => {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  return res.json(cats.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/categories", async (req, res) => {
  const { name, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [cat] = await db.insert(categoriesTable).values({ name, description, icon }).returning();
  return res.status(201).json({ ...cat, createdAt: cat.createdAt.toISOString() });
});

router.patch("/categories/:id", async (req, res) => {
  const { name, description, icon } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (icon !== undefined) updates.icon = icon;
  const [cat] = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, Number(req.params.id))).returning();
  if (!cat) return res.status(404).json({ error: "Not found" });
  return res.json({ ...cat, createdAt: cat.createdAt.toISOString() });
});

router.delete("/categories/:id", async (req, res) => {
  await db.delete(categoriesTable).where(eq(categoriesTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
