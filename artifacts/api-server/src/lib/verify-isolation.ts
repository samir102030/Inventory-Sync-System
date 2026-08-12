import { sql } from "drizzle-orm";
import { rootDb } from "@workspace/db";
import { logger } from "./logger";

/**
 * يتحقق عند الإقلاع أن عزل الشركات مفروض فعلًا من قاعدة البيانات.
 *
 * لماذا؟ لأن RLS يُتجاوَز صامتًا في حالتين لا أثر لهما في الكود:
 *   1. الاتصال بحساب superuser أو حساب له BYPASSRLS.
 *   2. جدول أُضيف لاحقًا دون ENABLE/FORCE ROW LEVEL SECURITY.
 *
 * في الحالتين يعمل النظام بشكل طبيعي تمامًا ويرى كل عميل بيانات الآخرين.
 * "نصف عزل" أخطر من غيابه لأنه يمنح ثقة زائفة، فالأفضل أن يرفض النظام
 * الإقلاع على أن يعمل مكشوفًا.
 */
export async function verifyCompanyIsolation() {
  // شركة لا وجود لها: أي صف يظهر تحت نطاقها يعني أن RLS غير مفروض.
  const IMPOSSIBLE_COMPANY = "-1";

  const problems: string[] = [];

  // 1) هل الحساب يتجاوز RLS من الأصل؟
  const [role] = (
    await rootDb.execute<{ superuser: boolean; bypassrls: boolean }>(
      sql`select rolsuper as superuser, rolbypassrls as bypassrls
          from pg_roles where rolname = current_user`,
    )
  ).rows;

  if (role?.superuser) problems.push("حساب قاعدة البيانات superuser");
  if (role?.bypassrls) problems.push("حساب قاعدة البيانات له BYPASSRLS");

  // 2) هل كل جدول فيه company_id محميّ فعلًا؟
  const unprotected = (
    await rootDb.execute<{ table_name: string }>(sql`
      select c.relname as table_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join information_schema.columns col
        on col.table_name = c.relname
       and col.table_schema = n.nspname
       and col.column_name = 'company_id'
      where n.nspname = 'public'
        and c.relkind = 'r'
        and (c.relrowsecurity = false or c.relforcerowsecurity = false)
    `)
  ).rows;

  if (unprotected.length > 0) {
    problems.push(`جداول بلا RLS: ${unprotected.map((r) => r.table_name).join(", ")}`);
  }

  // 3) الاختبار الحاسم: هل تختفي الصفوف فعلًا تحت نطاق شركة وهمية؟
  await rootDb.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.company_id', ${IMPOSSIBLE_COMPANY}, true)`,
    );
    const [visible] = (
      await tx.execute<{ count: string }>(sql`select count(*)::text as count from products`)
    ).rows;

    if (Number(visible?.count ?? 0) > 0) {
      problems.push("صفوف مرئية تحت نطاق شركة غير موجودة — RLS غير فعّال");
    }
  });

  if (problems.length === 0) {
    logger.info("Company isolation verified: row level security is enforced");
    return;
  }

  const [companies] = (
    await rootDb.execute<{ count: string }>(
      sql`select count(*)::text as count from companies`,
    )
  ).rows;

  /**
   * تحذير لا رفض.
   *
   * كان الرفض هو السلوك عند وجود أكثر من شركة، لكن نظامًا لا يقوم لا يمكن
   * تشخيصه: لا نعرف حتى ما الذي فشل. التحذير يُبقي الخدمة حية ويكتب السبب
   * بالحرف في السجلات، فيُصلَح السبب بدل الاكتفاء بإسقاط الخدمة.
   *
   * ⚠️ هذا لا يعني أن الأمر هيّن: ما دام هذا السطر يظهر في السجلات فبيانات
   * الشركات ليست معزولة، ولا يُعطى النظام لعميل ثانٍ قبل اختفائه.
   */
  logger.error(
    { problems, companyCount: Number(companies?.count ?? 0) },
    "⚠️ عزل بيانات الشركات غير مفعَّل — لا تُسلّم النظام لعميل ثانٍ قبل إصلاح هذا.",
  );
}
