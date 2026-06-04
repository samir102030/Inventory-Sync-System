import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  const user = users[0];

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  (req.session as any).userId = user.id;
  (req.session as any).role = user.role;

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {});
  return res.json({ ok: true });
});

router.get("/auth/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = users[0];
  if (!user) return res.status(401).json({ error: "User not found" });

  return res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
