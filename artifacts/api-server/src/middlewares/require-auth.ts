import type { Request, Response, NextFunction } from "express";

/**
 * حماية الـ API.
 *
 * قبل هذا الملف كانت كل مسارات /api مفتوحة لأي شخص يعرف الرابط:
 * شاشة الدخول كانت تحمي الواجهة فقط، لا البيانات.
 *
 * الجلسة تخزّن userId و role (انظر routes/auth.ts).
 */

/** أي طلب بدون جلسة يُرفض بـ 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // طلبات preflight الخاصة بـ CORS لا تحمل كوكيز.
  if (req.method === "OPTIONS") return next();

  const userId = (req.session as any)?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
  }

  return next();
}

/** مسارات لا يفتحها إلا الأدمن مهما كان نوع الطلب. */
const ADMIN_ONLY_PREFIXES = ["/backup", "/users"];

/** مسارات يقرأها الجميع لكن لا يعدّلها إلا الأدمن. */
const ADMIN_WRITE_PREFIXES = ["/settings"];

function matches(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + "/");
}

/**
 * حارس الدور. يمرّ على كل الطلبات لكنه لا يتدخل إلا في المسارات الحساسة:
 * تفريغ قاعدة البيانات ومسحها واستعادتها، وإدارة المستخدمين، وتعديل الإعدادات.
 */
export function requireAdminForSensitivePaths(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "OPTIONS") return next();

  const path = req.path;
  const isAdminOnly = ADMIN_ONLY_PREFIXES.some((prefix) => matches(path, prefix));
  const isAdminWrite =
    req.method !== "GET" &&
    ADMIN_WRITE_PREFIXES.some((prefix) => matches(path, prefix));

  if (!isAdminOnly && !isAdminWrite) return next();

  const role = (req.session as any)?.role;

  if (role !== "admin") {
    return res.status(403).json({
      error: "هذه العملية متاحة لحساب الأدمن فقط.",
      code: "ADMIN_REQUIRED",
    });
  }

  return next();
}
