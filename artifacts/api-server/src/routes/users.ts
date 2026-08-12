import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * لا يمنح دور `owner` إلا مالك نظام. بدون هذا الفحص يستطيع أي أدمن شركة
 * أن ينشئ لنفسه حساب مالك ويرى بيانات الشركات كلها.
 */
function rejectOwnerEscalation(req: any, res: any, requestedRole: unknown): boolean {
  if (requestedRole !== "owner") return false;
  if ((req.session as any)?.role === "owner") return false;
  res.status(403).json({
    error: "لا يمكن منح دور مالك النظام.",
    code: "OWNER_ROLE_FORBIDDEN",
  });
  return true;
}

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
  if (rejectOwnerEscalation(req, res, role)) return;
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
  if (rejectOwnerEscalation(req, res, role)) return;

  const targetId = Number(req.params.id);
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!target) return res.status(404).json({ error: "Not found" });

  /**
   * لا يُنزَّل مالك النظام إلا بيد مالك.
   *
   * بدون هذا الفحص كان أي حفظ من شاشة إدارة المستخدمين يعيد دور المالك إلى
   * `admin`، لأن قائمة الأدوار في الواجهة لا تحتوي "مالك" أصلًا فترسل القيمة
   * الافتراضية. حدث هذا فعلًا وأفقد المالك صلاحياته دون أن يلمس أحد الدور.
   */
  if (target.role === "owner" && role && role !== "owner") {
    if ((req.session as any)?.role !== "owner") {
      return res.status(403).json({
        error: "لا يمكن تغيير دور مالك النظام.",
        code: "OWNER_ROLE_PROTECTED",
      });
    }
  }

  /** حماية إضافية: لا يُحذف/يُعطَّل آخر مالك في النظام. */
  if (target.role === "owner" && status && status !== "active") {
    const owners = await db.select().from(usersTable).where(eq(usersTable.role, "owner"));
    if (owners.length <= 1) {
      return res.status(409).json({
        error: "لا يمكن إيقاف المالك الوحيد للنظام.",
        code: "LAST_OWNER",
      });
    }
  }

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
  const targetId = Number(req.params.id);
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!target) return res.json({ ok: true });

  if (target.role === "owner") {
    if ((req.session as any)?.role !== "owner") {
      return res.status(403).json({
        error: "لا يمكن حذف مالك النظام.",
        code: "OWNER_PROTECTED",
      });
    }
    const owners = await db.select().from(usersTable).where(eq(usersTable.role, "owner"));
    if (owners.length <= 1) {
      return res.status(409).json({
        error: "لا يمكن حذف المالك الوحيد للنظام.",
        code: "LAST_OWNER",
      });
    }
  }

  await db.delete(usersTable).where(eq(usersTable.id, targetId));
  return res.json({ ok: true });
});

export default router;
