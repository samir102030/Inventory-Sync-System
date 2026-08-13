import { Router, type IRouter } from "express";
import { brandsTable, db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * البراندات.
 *
 * المورّد (`vendor`) يضيف ويعدّل ولا يحذف. ما يلمسه يعود `pending` حتى يعتمده
 * أدمن أو مالك — بما في ذلك تعديله لبراند معتمد، وإلا لأمكنه تغيير براند
 * مقبول إلى أي شيء بعد الموافقة عليه.
 *
 * المعتمَد يراه الجميع؛ ما ينتظر يراه من يصنعه ومن يعتمده فقط.
 */

const router: IRouter = Router();

const isReviewer = (req: any) => ["admin", "owner"].includes((req.session as any)?.role);

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function currentUserName(req: any): Promise<string | null> {
  const userId = (req.session as any)?.userId;
  if (!userId) return null;
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.name ?? null;
}

function serialize(brand: typeof brandsTable.$inferSelect) {
  return {
    id: brand.id,
    name: brand.name,
    description: brand.description,
    website: brand.website,
    approvalStatus: brand.approvalStatus,
    createdBy: brand.createdBy,
    approvedBy: brand.approvedBy,
    approvedAt: brand.approvedAt?.toISOString() ?? null,
    createdAt: brand.createdAt.toISOString(),
  };
}

router.get("/brands", async (req, res) => {
  const rows = await db.select().from(brandsTable).orderBy(brandsTable.name);

  // الكاشير وغيره يرون المعتمد وحده؛ المورّد يرى ما صنعه وهو ينتظر، والمراجع
  // يرى كل شيء لأنه من سيقرر.
  const role = (req.session as any)?.role;
  const visible =
    isReviewer(req) || role === "vendor"
      ? rows
      : rows.filter((b) => b.approvalStatus === "approved");

  return res.json(visible.map(serialize));
});

router.post("/brands", async (req, res) => {
  const name = clean(req.body?.name);
  if (!name) return res.status(400).json({ error: "اسم البراند مطلوب." });

  const author = await currentUserName(req);

  const [brand] = await db
    .insert(brandsTable)
    .values({
      name,
      description: clean(req.body?.description),
      website: clean(req.body?.website),
      createdBy: author,
      // ما يضيفه مراجع معتمد بحكم من أضافه.
      approvalStatus: isReviewer(req) ? "approved" : "pending",
      ...(isReviewer(req) ? { approvedBy: author, approvedAt: new Date() } : {}),
    })
    .returning();

  return res.status(201).json(serialize(brand));
});

router.patch("/brands/:id", async (req, res) => {
  const updates: Record<string, unknown> = {};

  if (req.body?.name !== undefined) {
    const name = clean(req.body.name);
    if (!name) return res.status(400).json({ error: "اسم البراند مطلوب." });
    updates.name = name;
  }
  for (const field of ["description", "website"]) {
    if (req.body?.[field] !== undefined) updates[field] = clean(req.body[field]);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "لا يوجد ما يُعدَّل." });
  }

  // تعديل المورّد يعيد البراند إلى الانتظار: وإلا لأصبحت الموافقة بابًا
  // يُفتح مرة ثم يُغيَّر ما خلفه.
  if (!isReviewer(req)) {
    updates.approvalStatus = "pending";
    updates.approvedBy = null;
    updates.approvedAt = null;
  }

  const [brand] = await db
    .update(brandsTable)
    .set(updates)
    .where(eq(brandsTable.id, Number(req.params.id)))
    .returning();

  if (!brand) return res.status(404).json({ error: "البراند غير موجود." });
  return res.json(serialize(brand));
});

router.post("/brands/:id/approve", async (req, res) => {
  const [brand] = await db
    .update(brandsTable)
    .set({
      approvalStatus: "approved",
      approvedBy: await currentUserName(req),
      approvedAt: new Date(),
    })
    .where(eq(brandsTable.id, Number(req.params.id)))
    .returning();

  if (!brand) return res.status(404).json({ error: "البراند غير موجود." });
  return res.json(serialize(brand));
});

/** الحذف للمراجع وحده — المورّد ممنوع منه في `require-auth.ts` أيضًا. */
router.delete("/brands/:id", async (req, res) => {
  if (!isReviewer(req)) {
    return res.status(403).json({
      error: "حذف البراندات ليس من صلاحياتك.",
      code: "DELETE_FORBIDDEN",
    });
  }

  await db.delete(brandsTable).where(eq(brandsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
