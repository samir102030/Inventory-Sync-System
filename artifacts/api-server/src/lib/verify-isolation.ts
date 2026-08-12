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

  /**
   * الرفض متدرّج عن قصد.
   *
   * بشركة واحدة لا يوجد من يتسرّب إليه، فإيقاف نظام يعمل عقوبة أكبر من
   * الخطر. بشركتين فأكثر يصبح الخلل تسريبًا فعليًا بين عملاء يدفعون، وعندها
   * التوقف أهون من العمل مكشوفًا.
   */
  const [companies] = (
    await rootDb.execute<{ count: string }>(
      sql`select count(*)::text as count from companies`,
    )
  ).rows;

  const companyCount = Number(companies?.count ?? 0);

  if (companyCount > 1) {
    logger.error(
      { problems, companyCount },
      "عزل بيانات الشركات غير مفعَّل ويوجد أكثر من شركة. رفض الإقلاع بدلًا من تسريب بيانات العملاء.",
    );
    throw new Error(`Company isolation is not enforced: ${problems.join(" | ")}`);
  }

  logger.error(
    { problems, companyCount },
    "⚠️ عزل بيانات الشركات غير مفعَّل. النظام يعمل لأن الشركة واحدة، لكن إضافة شركة ثانية ستمنع الإقلاع حتى يُصلَح هذا.",
  );
}
