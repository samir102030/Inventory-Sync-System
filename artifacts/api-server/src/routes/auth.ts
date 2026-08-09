import { Router } from "express";
import bcrypt from "bcryptjs";
import { getAuth, clerkClient } from "@clerk/express";
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

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    const user = users[0];

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ error: "الحساب بانتظار موافقة الأدمن" });
    }

    (req.session as any).userId = user.id;
    (req.session as any).role = user.role;

    return res.json({ user: serializeUser(user) });
  } catch (error) {
    req.log?.error({ err: error }, "Password login failed because the database was unavailable");
    return res.status(503).json({
      error: "تعذر الاتصال بقاعدة البيانات مؤقتاً. احتفظ بالصفحة مفتوحة وحاول مرة أخرى بعد لحظات.",
      code: "DATABASE_UNAVAILABLE",
    });
  }
});

router.post("/auth/google-sync", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email || "مستخدم جوجل";

  if (!email) {
    return res.status(400).json({ error: "لا يوجد بريد إلكتروني مرتبط بحساب جوجل" });
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId)).limit(1);

  if (!user) {
    [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user && !user.clerkUserId) {
      [user] = await db.update(usersTable).set({ clerkUserId }).where(eq(usersTable.id, user.id)).returning();
    }
  }

  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({
        username: email,
        passwordHash: null,
        name,
        role: "cashier",
        email,
        clerkUserId,
        status: "pending",
      })
      .returning();
  }

  if (user.status !== "active") {
    return res.json({ status: "pending", user: serializeUser(user) });
  }

  (req.session as any).userId = user.id;
  (req.session as any).role = user.role;

  return res.json({ status: "approved", user: serializeUser(user) });
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

  return res.json(serializeUser(user));
});

export default router;
