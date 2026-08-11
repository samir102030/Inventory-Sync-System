import { Router, type IRouter } from "express";
import { db, companiesTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

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

  const [company] = await db
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

  return res.status(201).json(company);
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
 * لا حذف للشركات.
 *
 * حذف شركة يعني حذف بياناتها كلها — فواتير وعملاء وحسابات. الإيقاف
 * (`isActive: false`) يمنع الدخول ويُبقي البيانات، وهو ما يُحتاج فعليًا
 * عند توقف عميل عن الدفع.
 */
router.delete("/companies/:id", (_req, res) => {
  return res.status(405).json({
    error: "لا يمكن حذف شركة. أوقفها بدلًا من ذلك للحفاظ على بياناتها.",
    code: "USE_DEACTIVATE",
  });
});

export default router;
