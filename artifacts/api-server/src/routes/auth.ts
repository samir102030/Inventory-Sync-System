import { Router } from "express";
import bcrypt from "bcryptjs";
import { companiesTable, db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

type CompanyRef = { id: number; name: string } | null;

function serializeUser(
  user: typeof usersTable.$inferSelect,
  extra: { company?: CompanyRef; activeCompany?: CompanyRef } = {},
) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    email: user.email,
    phone: user.phone,
    status: user.status,
    loginMethod: "password",
    companyId: user.companyId,
    /** شركة المستخدم نفسه (فارغة لمالك النظام). */
    company: extra.company ?? null,
    /** الشركة التي يعمل داخلها الآن — للمالك بعد التبديل. */
    activeCompany: extra.activeCompany ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

async function loadCompany(id: number | null | undefined): Promise<CompanyRef> {
  if (!id) return null;
  const [company] = await db
    .select({ id: companiesTable.id, name: companiesTable.name })
    .from(companiesTable)
    .where(eq(companiesTable.id, id));
  return company ?? null;
}

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    /**
     * الحقل الواحد يقبل البريد أو اسم الدخول.
     *
     * الحسابات المسجَّلة ذاتيًا تعرف بريدها ولا تعرف اسم دخولها (يُشتق آليًا)،
     * والحسابات القديمة تعرف اسمها ولا بريد لها. حقل واحد يخدم الاثنين دون
     * أن نطلب من أحد تذكّر شيء جديد.
     */
    const identifier = String(username).trim();
    const column = identifier.includes("@") ? usersTable.email : usersTable.username;
    const value = identifier.includes("@") ? identifier.toLowerCase() : identifier;

    const users = await db.select().from(usersTable).where(eq(column, value)).limit(1);
    const user = users[0];

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status === "pending") {
      return res.status(403).json({
        error: "الحساب بانتظار موافقة الأدمن.",
        code: "PENDING_APPROVAL",
      });
    }

    if (user.status === "invited") {
      return res.status(403).json({
        error: "حسابك تمت الموافقة عليه. افتح بريدك وأدخل كود التفعيل لاختيار كلمة المرور.",
        code: "NEEDS_ACTIVATION",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({ error: "هذا الحساب موقوف." });
    }

    // شركة موقوفة تعني عميلًا توقف عن الدفع: البيانات محفوظة والدخول ممنوع.
    if (user.companyId) {
      const [company] = await db
        .select({ isActive: companiesTable.isActive })
        .from(companiesTable)
        .where(eq(companiesTable.id, user.companyId));

      if (company && !company.isActive) {
        return res.status(403).json({
          error: "اشتراك شركتك موقوف. تواصل مع مزوّد النظام.",
          code: "COMPANY_INACTIVE",
        });
      }
    }

    (req.session as any).userId = user.id;
    (req.session as any).role = user.role;
    // شركة المستخدم — مصدرها الجلسة على الخادم لا العميل.
    // NULL لمالك النظام: فوق الشركات كلها لا داخل واحدة.
    (req.session as any).companyId = user.companyId ?? null;
    (req.session as any).activeCompanyId = null;

    return res.json({
      user: serializeUser(user, { company: await loadCompany(user.companyId) }),
    });
  } catch (error) {
    req.log?.error({ err: error }, "Password login failed because the database was unavailable");
    return res.status(503).json({
      error: "تعذر الاتصال بقاعدة البيانات مؤقتاً. احتفظ بالصفحة مفتوحة وحاول مرة أخرى بعد لحظات.",
      code: "DATABASE_UNAVAILABLE",
    });
  }
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

  // الدور في الجلسة قد يكون قديمًا (غُيِّر في قاعدة البيانات بعد الدخول).
  // الجلسة هي مصدر الصلاحيات، فنبقيها متوافقة مع الحقيقة عند كل قراءة.
  (req.session as any).role = user.role;
  (req.session as any).companyId = user.companyId ?? null;

  return res.json(
    serializeUser(user, {
      company: await loadCompany(user.companyId),
      activeCompany: await loadCompany((req.session as any)?.activeCompanyId),
    }),
  );
});

export default router;
