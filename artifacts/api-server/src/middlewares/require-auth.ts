import type { Request, Response, NextFunction } from "express";

/**
 * حماية الـ API + صلاحيات الأدوار.
 *
 * الجلسة تخزّن userId و role (انظر routes/auth.ts).
 *
 * القاعدة: الكاشير مسموح له بما هو مذكور هنا فقط. أي مسار جديد يُضاف
 * للمشروع مستقبلًا يكون ممنوعًا على الكاشير تلقائيًا حتى يُسمح به صراحة.
 */

/** أي طلب بدون جلسة يُرفض بـ 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") return next();

  const userId = (req.session as any)?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
  }

  return next();
}

function matches(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + "/");
}

// ---------------------------------------------------------------------------
// ما يُسمح به للكاشير
// ---------------------------------------------------------------------------

/** قراءة فقط. */
const CASHIER_READ = [
  "/auth",
  "/products",
  "/categories",
  // البراندات جزء من الكتالوج. الراوت يعرض للكاشير المعتمد منها وحده.
  "/brands",
  "/customers",
  "/invoices",
  "/quotations",
  "/warehouses",
  "/warehouse-transfers",
  "/settings/invoice",
];

/**
 * مسارات بعينها يحتاجها الكاشير، دون فتح ما حولها.
 *
 * `/accounts` تحديدًا: نقطة البيع وصفحة الفواتير تحتاجان قائمة الخزائن
 * لتحديد أين تدخل النقدية. القائمة فقط — لا الحركات ولا التعديل.
 */
const CASHIER_READ_EXACT = ["/accounts"];

/** كتابة: البيع وإنشاء العملاء وعروض الأسعار. */
const CASHIER_WRITE: Array<{ method: string; prefix: string }> = [
  { method: "POST", prefix: "/invoices" }, // يشمل المرتجعات
  { method: "POST", prefix: "/customers" },
  { method: "POST", prefix: "/quotations" },
  { method: "PUT", prefix: "/quotations" },
  { method: "PATCH", prefix: "/quotations" },
  { method: "PATCH", prefix: "/customers" },
];

/**
 * عمليات جماعية خطيرة. ممنوعة على الكاشير مهما بدت مطابِقة للقواعد أعلاه،
 * لأن `POST /customers` مثلًا يشمل `POST /customers/bulk-import`.
 */
const CASHIER_NEVER = [
  "/products/delete-all",
  "/products/bulk-delete",
  "/products/import",
  "/customers/bulk-import",
  /**
   * تتبع المنتج يعرض تكلفة الشراء وهامش الربح لكل صنف. الصفحة مخفية عن
   * الكاشير في الواجهة، وهذا السطر يمنعه من المسار نفسه — الإخفاء وحده
   * ليس منعًا.
   */
  "/products/tracking",
];

/**
 * الكاشير لا يعتمد فاتورة — ولا فاتورة نفسه.
 *
 * `POST /invoices` مسموح له (وهو البيع)، و `/invoices/:id/approve` يقع تحته
 * بالمطابقة بالبادئة، فلولا هذا الفحص لاعتمد ما ينشئه ولأصبحت المراجعة اسمًا
 * بلا معنى. التحقق بالنمط لأن الرقم في وسط المسار.
 */
const CASHIER_NEVER_PATTERNS = [/^\/invoices\/\d+\/approve$/];

function cashierMayPass(method: string, path: string) {
  if (CASHIER_NEVER.some((p) => matches(path, p))) return false;
  if (CASHIER_NEVER_PATTERNS.some((pattern) => pattern.test(path))) return false;

  if (method === "GET") {
    return (
      CASHIER_READ_EXACT.includes(path) ||
      CASHIER_READ.some((p) => matches(path, p))
    );
  }

  if (method === "POST" && path === "/auth/logout") return true;

  return CASHIER_WRITE.some(
    (rule) => rule.method === method && matches(path, rule.prefix),
  );
}

// ---------------------------------------------------------------------------
// المورّد: البراندات وحدها
// ---------------------------------------------------------------------------

/**
 * المورّد يضيف البراندات ويعدّلها. لا يحذف، ولا يعتمد ما يضيفه.
 *
 * قائمة سماح لا قائمة منع: مسار جديد يُضاف للمشروع غدًا يكون ممنوعًا عليه
 * تلقائيًا حتى يُسمح به صراحةً.
 */
function vendorMayPass(method: string, path: string) {
  if (/^\/brands\/\d+\/approve$/.test(path)) return false;
  if (method === "DELETE") return false;

  if (method === "GET") return matches(path, "/auth") || matches(path, "/brands");
  if (method === "POST" && path === "/auth/logout") return true;

  return (method === "POST" || method === "PATCH") && matches(path, "/brands");
}

// ---------------------------------------------------------------------------
// ما يُشترط فيه الأدمن
// ---------------------------------------------------------------------------

/** مسارات لا يفتحها إلا مالك النظام. */
const OWNER_ONLY_PREFIXES = ["/companies"];

/** مسارات لا يفتحها إلا الأدمن مهما كان نوع الطلب. */
const ADMIN_ONLY_PREFIXES = ["/backup", "/users"];

/** مسارات يقرأها الجميع لكن لا يعدّلها إلا الأدمن. */
const ADMIN_WRITE_PREFIXES = ["/settings"];

/**
 * حارس الصلاحيات.
 *
 * الأدمن: كل شيء.
 * الكاشير: القائمة المسموحة أعلاه فقط.
 * أي دور آخر: ممنوع، حتى تُعرَّف صلاحياته صراحة.
 */
export function requireRolePermissions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "OPTIONS") return next();

  const role = (req.session as any)?.role;
  const path = req.path;
  const method = req.method;

  const isOwnerOnly = OWNER_ONLY_PREFIXES.some((p) => matches(path, p));

  if (role === "owner") return next();

  if (isOwnerOnly) {
    return res.status(403).json({
      error: "هذه الصفحة لمالك النظام فقط.",
      code: "OWNER_REQUIRED",
    });
  }

  if (role === "admin") return next();

  const isAdminOnly = ADMIN_ONLY_PREFIXES.some((p) => matches(path, p));
  const isAdminWrite =
    method !== "GET" && ADMIN_WRITE_PREFIXES.some((p) => matches(path, p));

  if (isAdminOnly || isAdminWrite) {
    return res.status(403).json({
      error: "هذه العملية متاحة لحساب الأدمن فقط.",
      code: "ADMIN_REQUIRED",
    });
  }

  if (role === "cashier" && cashierMayPass(method, path)) return next();
  if (role === "vendor" && vendorMayPass(method, path)) return next();

  return res.status(403).json({
    error: "ليس لديك صلاحية للقيام بهذه العملية.",
    code: "FORBIDDEN",
  });
}
