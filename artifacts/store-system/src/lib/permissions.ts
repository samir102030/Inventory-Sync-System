/**
 * الصفحات المسموح بها لكل دور.
 *
 * هذه القائمة يجب أن تبقى متوافقة مع الصلاحيات في الخادم
 * (`artifacts/api-server/src/middlewares/require-auth.ts`).
 * الخادم هو الحماية الحقيقية؛ هذا الملف لإخفاء ما لا فائدة من عرضه فقط.
 */

/** المسارات التي يفتحها الكاشير. ما عداها ممنوع. */
export const CASHIER_PAGES = [
  "/pos",
  "/invoices",
  "/quotations",
  "/products",
  "/categories",
  "/customers",
  "/warehouses",
  "/stock-shortage",
  "/product-tracking",
];

export function canOpenPage(role: string | undefined, path: string): boolean {
  if (role === "admin") return true;
  if (role === "cashier") {
    return CASHIER_PAGES.some((p) => path === p || path.startsWith(p + "/"));
  }
  return false;
}

/** الصفحة التي يبدأ منها كل دور بعد تسجيل الدخول. */
export function homePathFor(role: string | undefined): string {
  return role === "cashier" ? "/pos" : "/dashboard";
}
