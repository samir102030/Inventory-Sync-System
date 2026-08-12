import type { Request, Response, NextFunction } from "express";
import { eq, sql } from "drizzle-orm";
import { db, dbContext, rootDb, usersTable } from "@workspace/db";

/**
 * نطاق الشركة لكل طلب.
 *
 * يفتح معاملة واحدة للطلب، يضع فيها هوية الشركة الفعّالة، ثم يشغّل بقية
 * الطلب داخلها. سياسات RLS في قاعدة البيانات تقرأ هذه الهوية وتمنع أي صف
 * لا يخص الشركة — فحتى لو نسي راوتٌ الفلترة، القاعدة نفسها ترفض.
 *
 * ⚠️ لماذا `set_config(..., true)` وليس `SET`؟
 * Neon يشغّل PgBouncer في وضع transaction: الاتصال يعود إلى المخزن بعد كل
 * معاملة ويُسلَّم لطلب آخر. `SET` العادي يترك القيمة على الاتصال فيرثها
 * الطلب التالي — أي أن عميلًا يقرأ بيانات عميل آخر. المعامل الثالث `true`
 * يجعلها محلية للمعاملة، فتُمسح مع نهايتها.
 * https://neon.com/guides/test-rls-on-neon-branches
 */

/** أقصى مدة تبقى فيها المعاملة مفتوحة إن لم يُنهِ المسار استجابته. */
const MAX_REQUEST_MS = 30_000;

/**
 * الشركة الفعّالة للطلب، كنص:
 *   ''      ⇒ بلا تقييد (مالك النظام قبل التبديل).
 *   '<رقم>' ⇒ هذه الشركة وحدها.
 *   '0'     ⇒ لا شيء (مستخدم غير مالك بلا شركة — فشل مغلق لا مفتوح).
 */
async function resolveCompanyValue(req: Request): Promise<string> {
  const session = req.session as any;

  if (session.role === "owner") {
    // المالك يرى الكل، إلا إن بدّل إلى شركة بعينها.
    return session.activeCompanyId ? String(session.activeCompanyId) : "";
  }

  if (session.companyId === undefined) {
    // جلسة قديمة أنشئت قبل تخزين الشركة. اقرأها مرة واحدة واحفظها.
    // rootDb لا db: هذا الاستعلام يسبق المعاملة ويجب ألا يخضع لأي نطاق.
    const rows = await rootDb
      .select({ companyId: usersTable.companyId })
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);

    session.companyId = rows[0]?.companyId ?? null;
  }

  return session.companyId ? String(session.companyId) : "0";
}

/**
 * مسارات يستخدمها المالك وهو يرى كل الشركات، فلا تُمنع عليه.
 * ما عداها ممنوع عليه تعديله قبل أن يختار شركة (انظر أدناه).
 */
const OWNER_GLOBAL_PREFIXES = ["/companies", "/users", "/auth"];

export function companyScope(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") return next();

  void (async () => {
    let companyValue: string;

    try {
      companyValue = await resolveCompanyValue(req);
    } catch (error) {
      return next(error);
    }

    /**
     * المالك بلا شركة مختارة لا يكتب بيانات.
     *
     * السبب: العمود `company_id` يتعبّأ تلقائيًا من نطاق الطلب، ونطاقه هنا
     * فارغ — فالصف يولد بلا شركة، ولا يراه أحد بعد ذلك أبدًا. أوضح أن نطلب
     * منه اختيار الشركة أولًا من أن ننتج بيانات يتيمة بصمت.
     */
    const isWrite = req.method !== "GET" && req.method !== "HEAD";
    const isGlobalPath = OWNER_GLOBAL_PREFIXES.some(
      (p) => req.path === p || req.path.startsWith(p + "/"),
    );

    if (companyValue === "" && isWrite && !isGlobalPath) {
      return res.status(409).json({
        error: "اختر شركة أولًا من الزر أسفل القائمة الجانبية، ثم أعد المحاولة.",
        code: "COMPANY_NOT_SELECTED",
      });
    }

    try {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`select set_config('app.company_id', ${companyValue}, true)`,
        );

        // المعاملة تبقى مفتوحة حتى تنتهي الاستجابة، ثم تُغلق (commit).
        await new Promise<void>((resolve) => {
          let settled = false;

          const done = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
          };

          const timer = setTimeout(() => {
            req.log?.error(
              { url: req.originalUrl },
              "Request never finished; closing its transaction to free the connection",
            );
            done();
          }, MAX_REQUEST_MS);

          res.once("finish", done);
          res.once("close", done);

          dbContext.run(tx, () => {
            try {
              next();
            } catch (error) {
              done();
              next(error);
            }
          });
        });
      });
    } catch (error) {
      req.log?.error({ err: error }, "Company scope transaction failed");

      if (!res.headersSent) {
        res.status(500).json({
          error: "تعذر تنفيذ الطلب. حاول مرة أخرى.",
          code: "SCOPE_FAILED",
        });
      }
    }
  })();
}
