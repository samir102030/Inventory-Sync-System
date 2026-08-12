import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * الرقم التالي لمستند (فاتورة، سند، أمر شراء...).
 *
 * ⚠️ لا تستخدم `COUNT(*) + 1`.
 *
 * العدّ يفترض أن الأرقام متصلة بلا فجوات، وهذا يسقط أول مرة يُحذف فيها
 * مستند: تبقى INV-00001 و INV-00003، فيعطي العدُّ 2+1 = INV-00003 — رقم
 * مستخدَم — فيصطدم بقيد التفرّد ويمنع إنشاء أي فاتورة جديدة نهائيًا.
 * حدث هذا فعلًا في الإنتاج.
 *
 * الحل: أكبر رقم مستخدَم + 1. الفجوات تبقى فجوات، والترقيم لا يتوقف.
 *
 * الترقيم مستقل لكل شركة تلقائيًا: سياسات RLS تحصر ما يراه هذا الاستعلام
 * في شركة الطلب، فلا يرى المستندَ رقمًا عند شركة أخرى.
 */
export async function nextDocumentNumber(
  table: string,
  column: string,
  prefix: string,
  padding = 5,
): Promise<string> {
  const result = await db.execute<{ max: number | string | null }>(
    sql`SELECT COALESCE(MAX(NULLIF(SUBSTRING(${sql.identifier(column)} FROM '[0-9]+$'), '')::int), 0) AS max
        FROM ${sql.identifier(table)}`,
  );

  const next = Number(result.rows[0]?.max ?? 0) + 1;
  return `${prefix}-${String(next).padStart(padding, "0")}`;
}
