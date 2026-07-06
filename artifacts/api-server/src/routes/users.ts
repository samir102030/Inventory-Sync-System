import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    email: user.email,
    phone: user.phone,
    status: user.status,
    loginMethod: user.clerkUserId ? "google" : "password",
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/users", async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  return res.json(users.map(serializeUser));
});

router.post("/users", async (req, res) => {
  const { username, password, name, role, phone } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: "username, password, name required" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ username, passwordHash, name, role: role || "cashier", phone, status: "active" })
    .returning();
  return res.status(201).json(serializeUser(user));
});

router.get("/users/:id", async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  if (!user) return res.status(404).json({ error: "Not found" });
  return res.json(serializeUser(user));
});

router.patch("/users/:id", async (req, res) => {
  const { username, password, name, role, phone, status } = req.body;
  const updates: Record<string, any> = {};
  if (username) updates.username = username;
  if (name) updates.name = name;
  if (role) updates.role = role;
  if (phone !== undefined) updates.phone = phone;
  if (status) updates.status = status;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, Number(req.params.id))).returning();
  if (!user) return res.status(404).json({ error: "Not found" });
  return res.json(serializeUser(user));
});

router.delete("/users/:id", async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
