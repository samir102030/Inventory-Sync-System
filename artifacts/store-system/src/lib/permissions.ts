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
  // ‏/product-tracking ليست هنا: تعرض تكلفة الشراء وهامش الربح لكل صنف،
  // والخادم يرفضها للكاشير. إبقاؤها في القائمة كان يعرض له صفحة تفشل بـ 403.
];

/** المورّد لا يفتح غير البراندات. */
export const VENDOR_PAGES = ["/brands"];

/** صفحات لا يفتحها إلا مالك النظام. */
export const OWNER_PAGES = ["/companies"];

export function canOpenPage(role: string | undefined, path: string): boolean {
  const ownerOnly = OWNER_PAGES.some((p) => path === p || path.startsWith(p + "/"));
  if (role === "owner") return true;
  if (ownerOnly) return false;
  if (role === "admin") return true;
  if (role === "cashier") {
    return CASHIER_PAGES.some((p) => path === p || path.startsWith(p + "/"));
  }
  if (role === "vendor") {
    return VENDOR_PAGES.some((p) => path === p || path.startsWith(p + "/"));
  }
  return false;
}

/** الصفحة التي يبدأ منها كل دور بعد تسجيل الدخول. */
export function homePathFor(role: string | undefined): string {
  if (role === "cashier") return "/pos";
  if (role === "vendor") return "/brands";
  return "/dashboard";
}
