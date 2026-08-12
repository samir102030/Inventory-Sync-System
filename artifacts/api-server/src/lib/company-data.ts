import { sql } from "drizzle-orm";
import { rootDb } from "@workspace/db";

/**
 * ترتيب حذف بيانات شركة، مشتقٌّ من قاعدة البيانات لا مكتوبٌ بيد.
 *
 * كانت القائمة مكتوبة في الكود، فسقط منها `rental_payments` و `jam3iyyat`
 * و `credit_card_transactions` وأمثالها: "إعادة الضبط الكامل" كانت تتركها
 * كما هي، فتبقى دفعات إيجار وجمعيات من قبل الإعادة. قائمةٌ مكتوبة بيد تُنسى
 * عند إضافة جدول جديد؛ هذه لا تُنسى.
 *
 * الترتيب طوبولوجي: الأبناء قبل الآباء، وإلا رفض المفتاح الأجنبي الحذف.
 */

let cached: string[] | null = null;

export async function companyDataDeletionOrder(): Promise<string[]> {
  if (cached) return cached;

  const { rows: tables } = await rootDb.execute<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'company_id'
  `);

  const { rows: links } = await rootDb.execute<{ child: string; parent: string }>(sql`
    SELECT tc.table_name AS child, ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name <> ccu.table_name
  `);

  const names = new Set(tables.map((t) => t.table_name));

  /** الجدول ⇒ الجداول التي يشير إليها ويجب أن تُحذف بعده. */
  const parents = new Map<string, Set<string>>();
  for (const name of names) parents.set(name, new Set());
  for (const { child, parent } of links) {
    if (names.has(child) && names.has(parent)) parents.get(child)!.add(parent);
  }

  const order: string[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();

  const visit = (name: string) => {
    if (done.has(name) || visiting.has(name)) return; // الدورة تُتجاهل، لا تُوقف
    visiting.add(name);
    for (const parent of parents.get(name) ?? []) visit(parent);
    visiting.delete(name);
    done.add(name);
    order.push(name);
  };

  for (const name of names) visit(name);

  // ‏visit يضع الآباء أولًا، والحذف يحتاج العكس.
  cached = order.reverse();
  return cached;
}

/**
 * يمسح بيانات الشركة الفعّالة.
 *
 * ‏DELETE لا TRUNCATE: الأخير لا يخضع لـ RLS إطلاقًا، فكانت ضغطة "إعادة
 * تعيين" من أدمن أي شركة تمسح بيانات الشركات كلها.
 *
 * `keep` لما ليس بيانات عمل: حسابات المستخدمين وإعدادات الفاتورة تبقى بعد
 * إعادة الضبط، فالمقصود مسح العمل لا إغلاق الشركة.
 */
export async function wipeCompanyData(
  db: { execute: (query: any) => Promise<unknown> },
  keep: string[] = ["users", "invoice_settings", "user_sessions"],
) {
  const order = await companyDataDeletionOrder();
  const kept = new Set(keep);

  for (const table of order) {
    if (kept.has(table)) continue;
    await db.execute(sql.raw(`DELETE FROM "${table}"`));
  }
}
