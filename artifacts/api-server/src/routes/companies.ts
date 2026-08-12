import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { db, companiesTable, rootDb, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { ensureJoinCode, issueActivationCode } from "./signup";
import { companyDataDeletionOrder } from "../lib/company-data";
import { activationEmail, sendEmail } from "../lib/email";

/**
 * إدارة الشركات — لمالك النظام وحده.
 *
 * الحماية نفسها مفروضة في `middlewares/require-auth.ts` (OWNER_ONLY_PREFIXES)،
 * وهذا الملف لا يعتمد عليها وحدها: كل معالج هنا يفترض أن المستدعي مالك.
 */

const router: IRouter = Router();

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

router.get("/companies", async (_req, res) => {
  // عدد المستخدمين لكل شركة — مفيد لمعرفة الشركات المُعطَّلة فعليًا.
  const rows = await db
    .select({
      id: companiesTable.id,
      name: companiesTable.name,
      phone: companiesTable.phone,
      email: companiesTable.email,
      address: companiesTable.address,
      taxNumber: companiesTable.taxNumber,
      subscriptionEndsAt: companiesTable.subscriptionEndsAt,
      notes: companiesTable.notes,
      /** يُملى على الموظف الجديد ليصل طلب تسجيله إلى أدمن هذه الشركة. */
      joinCode: companiesTable.joinCode,
      isActive: companiesTable.isActive,
      createdAt: companiesTable.createdAt,
      userCount: sql<number>`(
        SELECT COUNT(*) FROM ${usersTable} WHERE ${usersTable.companyId} = ${companiesTable.id}
      )`,
    })
    .from(companiesTable)
    .orderBy(companiesTable.name);

  return res.json(rows);
});

router.get("/companies/:id", async (req, res) => {
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, Number(req.params.id)));

  if (!company) return res.status(404).json({ error: "الشركة غير موجودة." });
  return res.json(company);
});

router.post("/companies", async (req, res) => {
  const name = clean(req.body?.name);
  if (!name) {
    return res.status(400).json({ error: "اسم الشركة مطلوب." });
  }

  /**
   * ‏rootDb لا db، وكل ما بعده كذلك.
   *
   * إنشاء شركة فعلٌ خارج نطاق أي شركة بطبيعته. لو كُتب الصف داخل معاملة
   * الطلب، لما رآه أي اتصال آخر قبل انتهائها — وكان توليد كود الانضمام يفشل
   * ثم يسقط الطلب كله بـ 500. ولو كُتب حساب المدير داخلها لرفضته سياسة RLS
   * حين يكون المالك مبدَّلًا إلى شركة أخرى.
   *
   * المسار للمالك وحده (`OWNER_ONLY_PREFIXES`)، فتجاوز النطاق هنا مقصود.
   */
  const [company] = await rootDb
    .insert(companiesTable)
    .values({
      name,
      phone: clean(req.body?.phone),
      email: clean(req.body?.email),
      address: clean(req.body?.address),
      taxNumber: clean(req.body?.taxNumber),
      subscriptionEndsAt: clean(req.body?.subscriptionEndsAt),
      notes: clean(req.body?.notes),
      isActive: req.body?.isActive !== false,
    })
    .returning();

  // كل شركة تحتاج كود انضمام من لحظة إنشائها ليسجّل موظفوها بأنفسهم.
  const joinCode = await ensureJoinCode(company.id);

  /**
   * أدمن الشركة يُنشأ معها في نفس الخطوة.
   *
   * بيع النظام لعميل جديد فعلٌ واحد: شركة وشخص يدخل إليها. فصلهما كان يعني
   * إنشاء الشركة ثم الذهاب لشاشة أخرى وتذكّر اختيارها من قائمة — خطوة تُنسى
   * فتبقى شركة لا يستطيع أحد دخولها.
   *
   * الحساب يولد بلا كلمة مرور، تمامًا كالمسجّل ذاتيًا: كود التفعيل يُرسَل
   * بالبريد وصاحبه وحده يختار كلمته.
   */
  const adminName = clean(req.body?.adminName);
  const adminEmail = clean(req.body?.adminEmail)?.toLowerCase() ?? null;

  if (!adminName || !adminEmail) {
    return res.status(201).json({ ...company, joinCode, admin: null });
  }

  const [taken] = await rootDb
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, adminEmail));

  if (taken) {
    // الشركة أُنشئت فعلًا؛ نقولها صراحةً بدل التراجع عنها بصمت.
    return res.status(201).json({
      ...company,
      joinCode,
      admin: null,
      adminError: "هذا البريد مستخدم لحساب آخر. الشركة أُنشئت، أضف مديرها من الإعدادات.",
    });
  }

  const base = adminEmail.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 20) || "admin";

  const [admin] = await rootDb
    .insert(usersTable)
    .values({
      username: `${base}_${randomBytes(3).toString("hex")}`,
      name: adminName,
      email: adminEmail,
      phone: clean(req.body?.adminPhone),
      role: "admin",
      status: "pending",
      passwordHash: null,
      companyId: company.id,
    })
    .returning({ id: usersTable.id });

  const { code, expiresAt } = await issueActivationCode(admin.id);

  const appUrl = process.env.APP_URL ?? `${req.protocol}://${req.get("host")}`;
  const message = activationEmail(adminName, code, appUrl);
  const delivery = await sendEmail({
    to: adminEmail,
    toName: adminName,
    subject: message.subject,
    html: message.html,
  });

  return res.status(201).json({
    ...company,
    joinCode,
    admin: {
      name: adminName,
      email: adminEmail,
      activationCode: code,
      expiresAt: expiresAt.toISOString(),
      emailSent: delivery.sent,
      emailError: delivery.reason ?? null,
    },
  });
});

router.patch("/companies/:id", async (req, res) => {
  const updates: Record<string, unknown> = {};

  if (req.body?.name !== undefined) {
    const name = clean(req.body.name);
    if (!name) return res.status(400).json({ error: "اسم الشركة مطلوب." });
    updates.name = name;
  }
  for (const field of ["phone", "email", "address", "taxNumber", "subscriptionEndsAt", "notes"]) {
    if (req.body?.[field] !== undefined) updates[field] = clean(req.body[field]);
  }
  if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "لا يوجد ما يُعدَّل." });
  }

  const [company] = await db
    .update(companiesTable)
    .set(updates)
    .where(eq(companiesTable.id, Number(req.params.id)))
    .returning();

  if (!company) return res.status(404).json({ error: "الشركة غير موجودة." });
  return res.json(company);
});

/**
 * تبديل الشركة الفعّالة — لمالك النظام وحده.
 *
 * الشركة المختارة تُحفظ في الجلسة على الخادم، لا يرسلها العميل مع كل طلب:
 * لو كان العميل هو من يحدد شركته، لكفى تعديل طلب واحد لرؤية شركة أخرى.
 *
 * بعد التبديل يرى المالك بيانات تلك الشركة وحدها، كأنه أدمن داخلها.
 */
router.post("/companies/:id/switch", async (req, res) => {
  const id = Number(req.params.id);

  const [company] = await db
    .select({ id: companiesTable.id, name: companiesTable.name })
    .from(companiesTable)
    .where(eq(companiesTable.id, id));

  if (!company) return res.status(404).json({ error: "الشركة غير موجودة." });

  (req.session as any).activeCompanyId = company.id;
  return res.json({ activeCompany: company });
});

/** العودة إلى رؤية كل الشركات. */
router.post("/companies/switch/clear", (req, res) => {
  (req.session as any).activeCompanyId = null;
  return res.json({ activeCompany: null });
});

/**
 * حذف شركة — إن كانت فارغة وحدها.
 *
 * الحاجة الحقيقية هي إزالة شركة أُنشئت بالخطأ أو للتجربة، لا التخلص من عميل.
 * لذلك يُفحص أولًا: إن كان فيها أي بيانات عمل — فاتورة واحدة تكفي — يُرفض
 * الحذف ويُقال ما فيها بالضبط. عميلٌ توقف عن الدفع يُوقَف لا يُحذف؛ الإيقاف
 * يمنع الدخول ويُبقي كل شيء.
 *
 * ما يُحذف مع الشركة: حسابات مستخدميها وإعدادات فاتورتها. هذه ليست بيانات
 * عمل، ولا معنى لبقائها بعد شركة لم يعد لها وجود.
 */

/** جداول لا يمنع محتواها الحذف: تُنشأ تلقائيًا ولا تحمل عمل أحد. */
const NOT_BUSINESS_DATA = new Set(["users", "invoice_settings"]);

router.delete("/companies/:id", async (req, res) => {
  const id = Number(req.params.id);

  const [company] = await rootDb
    .select({ id: companiesTable.id, name: companiesTable.name })
    .from(companiesTable)
    .where(eq(companiesTable.id, id));

  if (!company) return res.status(404).json({ error: "الشركة غير موجودة." });

  // الجداول وترتيبها من القاعدة لا من قائمة مكتوبة: قائمة تُنسى عند إضافة
  // جدول جديد، فتُحذف شركة وفيها بيانات.
  const counted = await companyDataDeletionOrder();
  const countSql = counted
    .map((t) => `SELECT '${t}' AS name, count(*)::int AS rows FROM "${t}" WHERE company_id = ${id}`)
    .join(" UNION ALL ");

  const { rows: counts } = await rootDb.execute<{ name: string; rows: number }>(sql.raw(countSql));

  const holding = counts.filter((c) => c.rows > 0 && !NOT_BUSINESS_DATA.has(c.name));

  if (holding.length > 0) {
    return res.status(409).json({
      error: `لا يمكن حذف "${company.name}" لأن فيها بيانات. أوقفها بدلًا من ذلك للحفاظ عليها.`,
      code: "COMPANY_NOT_EMPTY",
      holding: holding.map((c) => ({ table: c.name, rows: c.rows })),
    });
  }

  const userCount = counts.find((c) => c.name === "users")?.rows ?? 0;

  // الأبناء أولًا: الصفوف التلقائية ثم الشركة.
  for (const table of counted) {
    await rootDb.execute(sql.raw(`DELETE FROM "${table}" WHERE company_id = ${id}`));
  }
  await rootDb.delete(companiesTable).where(eq(companiesTable.id, id));

  return res.json({ ok: true, deletedUsers: userCount });
});

export default router;
