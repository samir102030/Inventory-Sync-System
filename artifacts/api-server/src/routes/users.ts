import { Router } from "express";
import bcrypt from "bcryptjs";
import { companiesTable, db, rootDb, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureJoinCode, issueActivationCode } from "./signup";
import { activationEmail, sendEmail } from "../lib/email";

const router = Router();

/**
 * الشركة المطلوبة لمستخدم جديد أو منقول.
 *
 * مالك النظام وحده يختار الشركة صراحةً. أدمن الشركة لا يُسمح له بذلك: عمود
 * `company_id` يتعبّأ تلقائيًا من نطاق طلبه، وسياسة RLS ترفض أي محاولة
 * لوضع مستخدم في شركة أخرى — فالتجاهل هنا ليس ثغرة بل تبسيط.
 */
function requestedCompanyId(req: any): number | null | undefined {
  if ((req.session as any)?.role !== "owner") return undefined;
  const raw = req.body?.companyId;
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : undefined;
}

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

function serializeUser(
  user: typeof usersTable.$inferSelect,
  companyName: string | null = null,
) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    email: user.email,
    phone: user.phone,
    status: user.status,
    companyId: user.companyId,
    companyName,
    /** طلب عميل جديد: الشركة لم تُنشأ بعد، وهذا اسمها المطلوب. */
    requestedCompanyName: user.requestedCompanyName,
    createdAt: user.createdAt.toISOString(),
  };
}

/** اسم الشركة لعرضه في الجدول. الأدمن يرى شركته وحدها فيكفيه استعلام واحد. */
async function companyNames(ids: Array<number | null>) {
  const names = new Map<number, string>();
  for (const id of new Set(ids.filter((v): v is number => typeof v === "number"))) {
    const [company] = await db
      .select({ name: companiesTable.name })
      .from(companiesTable)
      .where(eq(companiesTable.id, id));
    if (company) names.set(id, company.name);
  }
  return names;
}

router.get("/users", async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  const names = await companyNames(users.map((u) => u.companyId));
  return res.json(
    users.map((u) => serializeUser(u, u.companyId ? names.get(u.companyId) ?? null : null)),
  );
});

router.post("/users", async (req, res) => {
  const { username, password, name, role, phone, email } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: "username, password, name required" });
  }
  if (rejectOwnerEscalation(req, res, role)) return;

  const companyId = requestedCompanyId(req);
  if ((req.session as any)?.role === "owner" && role !== "owner" && !companyId) {
    return res.status(400).json({
      error: "اختر الشركة التي ينتمي إليها المستخدم.",
      code: "COMPANY_REQUIRED",
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      passwordHash,
      name,
      role: role || "cashier",
      phone,
      email: email || null,
      status: "active",
      // عند التجاهل يتولى العمود قيمته الافتراضية: شركة المستخدم الحالي.
      ...(companyId === undefined ? {} : { companyId }),
    })
    .returning();
  return res.status(201).json(serializeUser(user));
});

/**
 * طلبات التسجيل — صندوق وارد على مستوى النظام.
 *
 * مالك النظام يرى كل الطلبات مهما كانت الشركة التي بدّل إليها: الموافقة دورُ
 * مالكٍ لا دور شخص داخل شركة. بدون هذا كان طلب عميل جديد (بلا شركة) يختفي
 * لحظة تبديله إلى أي شركة، وتردّ الموافقة بـ "الطلب غير موجود".
 *
 * أدمن الشركة يرى طلبات شركته وحدها، وسياسة RLS تكفله.
 */
function requestReader(req: any) {
  return (req.session as any)?.role === "owner" ? rootDb : db;
}

router.get("/users/requests", async (req, res) => {
  const rows = await requestReader(req)
    .select()
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  const pending = rows.filter((u) => u.status === "pending" || u.status === "invited");
  const names = await companyNames(pending.map((u) => u.companyId));

  return res.json(
    pending.map((u) => serializeUser(u, u.companyId ? names.get(u.companyId) ?? null : null)),
  );
});

/**
 * الموافقة على طلب تسجيل.
 *
 * أدمن الشركة يوافق على موظفيه؛ مالك النظام وحده يوافق على عميل جديد —
 * وسياسة RLS تفرض ذلك من نفسها: طلب العميل الجديد بلا شركة، فلا يظهر
 * لأدمن أي شركة أصلًا.
 *
 * عند الموافقة على عميل جديد تُنشأ شركته ويصير أدمنها.
 *
 * الكود يُرجَع في الرد ليراه الأدمن على الشاشة. هذا مقصود: لو تعثّر البريد
 * (Brevo، أو بريد خاطئ) لا تتوقف العملية — الأدمن يسلّمه بنفسه.
 */
router.post("/users/:id/approve", async (req, res) => {
  const targetId = Number(req.params.id);
  const isOwner = (req.session as any)?.role === "owner";
  const role = req.body?.role === "admin" || req.body?.role === "cashier" ? req.body.role : "cashier";

  const [target] = await requestReader(req)
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetId));

  if (!target) return res.status(404).json({ error: "الطلب غير موجود." });
  if (target.status === "active") {
    return res.status(409).json({ error: "هذا الحساب مفعَّل بالفعل.", code: "ALREADY_ACTIVE" });
  }
  if (!target.email) {
    return res.status(400).json({ error: "الطلب بلا بريد إلكتروني.", code: "NO_EMAIL" });
  }

  let companyId = target.companyId;

  if (!companyId) {
    // عميل جديد: لا شركة له بعد. مالك النظام وحده يفتح شركة.
    if (!isOwner) {
      return res.status(403).json({
        error: "الموافقة على عميل جديد لمالك النظام وحده.",
        code: "OWNER_REQUIRED",
      });
    }

    const [company] = await rootDb
      .insert(companiesTable)
      .values({ name: target.requestedCompanyName ?? target.name, isActive: true })
      .returning({ id: companiesTable.id });

    companyId = company.id;
    await ensureJoinCode(companyId);
  }

  await rootDb
    .update(usersTable)
    .set({ role, companyId, requestedCompanyName: null })
    .where(eq(usersTable.id, targetId));

  const { code, expiresAt } = await issueActivationCode(targetId);

  const appUrl = process.env.APP_URL ?? `${req.protocol}://${req.get("host")}`;
  const message = activationEmail(target.name, code, appUrl);
  const delivery = await sendEmail({
    to: target.email,
    toName: target.name,
    subject: message.subject,
    html: message.html,
  });

  return res.json({
    ok: true,
    activationCode: code,
    expiresAt: expiresAt.toISOString(),
    emailSent: delivery.sent,
    emailError: delivery.reason ?? null,
  });
});

/** رفض طلب: يُحذف الصف بالكامل، فلا يبقى حساب معطّل بلا سبب. */
router.post("/users/:id/reject", async (req, res) => {
  const [target] = await requestReader(req)
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, Number(req.params.id)));
  if (!target) return res.status(404).json({ error: "الطلب غير موجود." });
  if (target.status === "active") {
    return res.status(409).json({ error: "لا يُرفض حساب مفعَّل. أوقفه بدلًا من ذلك." });
  }

  await rootDb.delete(usersTable).where(eq(usersTable.id, target.id));
  return res.json({ ok: true });
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

  // نقل مستخدم من شركة لأخرى — للمالك وحده، وسياسة RLS تحرس الباقي.
  const companyId = requestedCompanyId(req);
  if (companyId !== undefined) updates.companyId = companyId;

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
