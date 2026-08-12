import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { companiesTable, rootDb, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

/**
 * التسجيل الذاتي — مسارات عامة (قبل بوابة المصادقة).
 *
 * مساران يلتقيان في نفس الجدول:
 *   موظف في شركة قائمة ⇒ يكتب كود انضمام الشركة، فيُربط بها فورًا ويصل
 *                        طلبه لأدمنها.
 *   عميل جديد          ⇒ يكتب اسم شركته بلا كود، فيبقى بلا شركة ويصل طلبه
 *                        لمالك النظام وحده — وسياسة RLS تفعل ذلك وحدها،
 *                        فالصف بلا شركة لا يظهر تحت نطاق أي شركة.
 *
 * الحساب يولد بلا كلمة مرور و `status = 'pending'`، فلا يفتح شيئًا:
 * `auth/login` يرفض كل من ليس `active`.
 *
 * ⚠️ هذه المسارات مفتوحة للعالم، فتستخدم `rootDb` عمدًا: لا جلسة هنا ولا
 * نطاق شركة، ولا يجوز أن تعتمد على أيٍّ منهما.
 */

const router: IRouter = Router();

/** حروف بلا التباس: لا 0/O ولا 1/I/L — الكود يُملى ويُكتب يدويًا. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * حدّ بسيط للطلبات لكل عنوان.
 *
 * بدونه يستطيع أي أحد ملء جدول المستخدمين بطلبات وهمية، أو تخمين أكواد
 * التفعيل بالتكرار. في الذاكرة يكفي هنا: الخدمة نسخة واحدة.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

/** هل تجاوز هذا العنوان حدّه؟ لا يعدّ المحاولة — `countFailure` يفعل. */
function overLimit(key: string, max: number) {
  const entry = attempts.get(key);
  return Boolean(entry && Date.now() <= entry.resetAt && entry.count >= max);
}

/**
 * يعدّ محاولة فاشلة فقط.
 *
 * عدّ المحاولات الناجحة يعاقب الاستخدام الصحيح: مكتب يفعّل حسابات موظفيه في
 * يوم واحد يخرج من عنوان إنترنت واحد، فيُقفل عليه بعد العاشر. الذي يُراد
 * منعه هو تخمين الكود، والتخمين فاشل بطبيعته.
 */
function countFailure(key: string, windowMs: number) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) attempts.set(key, { count: 1, resetAt: now + windowMs });
  else entry.count += 1;
}

// ---------------------------------------------------------------------------

router.post("/auth/signup", async (req, res) => {
  // 20 لا 5: موظفو مكتب واحد يخرجون من عنوان إنترنت واحد، فحدٌّ ضيق يقفل
  // على شركة كاملة تسجّل موظفيها في يوم واحد.
  if (!rateLimit(`signup:${req.ip}`, 20, 60 * 60 * 1000)) {
    return res.status(429).json({
      error: "محاولات كثيرة. جرّب بعد ساعة.",
      code: "TOO_MANY_REQUESTS",
    });
  }

  const name = clean(req.body?.name);
  const email = clean(req.body?.email)?.toLowerCase() ?? null;
  const phone = clean(req.body?.phone);
  const joinCode = clean(req.body?.joinCode)?.toUpperCase() ?? null;
  const companyName = clean(req.body?.companyName);

  if (!name) return res.status(400).json({ error: "الاسم مطلوب." });
  if (!email || !isEmail(email)) {
    return res.status(400).json({ error: "أدخل بريدًا إلكترونيًا صحيحًا." });
  }
  if (!joinCode && !companyName) {
    return res.status(400).json({
      error: "أدخل كود الشركة إن كنت موظفًا بها، أو اكتب اسم شركتك إن كنت عميلًا جديدًا.",
      code: "COMPANY_REQUIRED",
    });
  }

  let companyId: number | null = null;

  if (joinCode) {
    const [company] = await rootDb
      .select({ id: companiesTable.id, isActive: companiesTable.isActive })
      .from(companiesTable)
      .where(eq(companiesTable.joinCode, joinCode));

    if (!company) {
      return res.status(400).json({ error: "كود الشركة غير صحيح.", code: "BAD_JOIN_CODE" });
    }
    if (!company.isActive) {
      return res.status(403).json({ error: "هذه الشركة موقوفة حاليًا.", code: "COMPANY_INACTIVE" });
    }
    companyId = company.id;
  }

  const [existing] = await rootDb
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existing) {
    // لا نكشف أن البريد مسجَّل: ذلك يحوّل الشاشة إلى أداة لمعرفة من له حساب.
    return res.status(202).json({ ok: true });
  }

  /** اسم الدخول مشتق من البريد ومضمون التفرّد؛ الدخول نفسه سيكون بالبريد. */
  const base = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 20) || "user";
  const username = `${base}_${crypto.randomBytes(3).toString("hex")}`;

  await rootDb.insert(usersTable).values({
    username,
    name,
    email,
    phone,
    role: "cashier",
    status: "pending",
    passwordHash: null,
    companyId,
    requestedCompanyName: companyId ? null : companyName,
  });

  return res.status(202).json({ ok: true });
});

// ---------------------------------------------------------------------------

router.post("/auth/activate", async (req, res) => {
  const limitKey = `activate:${req.ip}`;
  const WINDOW = 15 * 60 * 1000;

  if (overLimit(limitKey, 10)) {
    return res.status(429).json({
      error: "محاولات كثيرة. جرّب بعد ربع ساعة.",
      code: "TOO_MANY_REQUESTS",
    });
  }

  const email = clean(req.body?.email)?.toLowerCase() ?? null;
  const code = clean(req.body?.code)?.toUpperCase() ?? null;
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !code) return res.status(400).json({ error: "البريد والكود مطلوبان." });
  if (password.length < 8) {
    return res.status(400).json({ error: "كلمة المرور يجب ألا تقل عن ٨ أحرف." });
  }

  const [user] = await rootDb.select().from(usersTable).where(eq(usersTable.email, email));

  const invalid = () => {
    countFailure(limitKey, WINDOW);
    return res.status(400).json({ error: "الكود غير صحيح أو منتهي.", code: "BAD_CODE" });
  };

  if (!user || !user.activationCodeHash || user.status !== "invited") return invalid();
  if (user.activationExpiresAt && user.activationExpiresAt.getTime() < Date.now()) {
    return invalid();
  }
  if (!(await bcrypt.compare(code, user.activationCodeHash))) return invalid();

  await rootDb
    .update(usersTable)
    .set({
      passwordHash: await bcrypt.hash(password, 10),
      status: "active",
      activationCodeHash: null,
      activationExpiresAt: null,
    })
    .where(eq(usersTable.id, user.id));

  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------

/**
 * توليد كود تفعيل جديد لمستخدم موافَق عليه.
 *
 * يُستدعى من مسار الموافقة (`routes/users.ts`). الكود يُرجَع نصًّا مرة واحدة
 * ليراه الأدمن على الشاشة، ولا يُخزَّن إلا مبصومًا.
 */
export async function issueActivationCode(userId: number) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await rootDb
    .update(usersTable)
    .set({
      status: "invited",
      activationCodeHash: await bcrypt.hash(code, 10),
      activationExpiresAt: expiresAt,
    })
    .where(eq(usersTable.id, userId));

  return { code, expiresAt };
}

/** كود انضمام جديد لشركة لا تملك واحدًا بعد. */
export async function ensureJoinCode(companyId: number) {
  const [company] = await rootDb
    .select({ joinCode: companiesTable.joinCode })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));

  if (company?.joinCode) return company.joinCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(8);
    const updated = await rootDb
      .update(companiesTable)
      .set({ joinCode: code })
      .where(sql`${companiesTable.id} = ${companyId} AND ${companiesTable.joinCode} IS NULL`)
      .returning({ joinCode: companiesTable.joinCode });

    if (updated[0]?.joinCode) return updated[0].joinCode;
  }

  throw new Error("Could not allocate a join code");
}

export default router;
