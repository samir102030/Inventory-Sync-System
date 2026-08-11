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
  "/customers",
  "/invoices",
  "/quotations",
  "/warehouses",
  "/settings/invoice",
];

/** استثناء: ملخص لوحة التحكم فقط، دون بقية التقارير. */
const CASHIER_READ_EXACT = ["/reports/summary"];

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
];

function cashierMayPass(method: string, path: string) {
  if (CASHIER_NEVER.some((p) => matches(path, p))) return false;

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
// ما يُشترط فيه الأدمن
// ---------------------------------------------------------------------------

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

  return res.status(403).json({
    error: "ليس لديك صلاحية للقيام بهذه العملية.",
    code: "FORBIDDEN",
  });
}
