import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/users", async (req, res) => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    name: usersTable.name,
    role: usersTable.role,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.name);

  return res.json(users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })));
});

router.post("/users", async (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: "username, password, name required" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ username, passwordHash, name, role: role || "cashier" }).returning();
  return res.status(201).json({
    id: user.id, username: user.username, name: user.name, role: user.role, createdAt: user.createdAt.toISOString(),
  });
});

router.get("/users/:id", async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  if (!user) return res.status(404).json({ error: "Not found" });
  return res.json({ id: user.id, username: user.username, name: user.name, role: user.role, createdAt: user.createdAt.toISOString() });
});

router.patch("/users/:id", async (req, res) => {
  const { username, password, name, role } = req.body;
  const updates: Record<string, any> = {};
  if (username) updates.username = username;
  if (name) updates.name = name;
  if (role) updates.role = role;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, Number(req.params.id))).returning();
  if (!user) return res.status(404).json({ error: "Not found" });
  return res.json({ id: user.id, username: user.username, name: user.name, role: user.role, createdAt: user.createdAt.toISOString() });
});

router.delete("/users/:id", async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
