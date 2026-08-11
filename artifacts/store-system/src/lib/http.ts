/**
 * قراءة رد الشبكة بأمان.
 *
 * المشكلة التي يعالجها هذا الملف: أغلب الصفحات كانت تكتب
 * `fetch(url).then(r => r.json())` دون فحص حالة الرد. عند رفض الخادم
 * (401 أو 403) كان جسم الرفض `{ error, code }` يُسلَّم للصفحة كأنه بيانات
 * صحيحة، فتحاول الصفحة تنفيذ `.filter()` على كائن وليس مصفوفة، فينهار
 * التطبيق كله وتظهر شاشة بيضاء.
 *
 * الحل: نرمي خطأً حقيقيًا، فيلتقطه React Query ويعرض حالة الخطأ بهدوء.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

function messageFor(status: number, body: any): string {
  if (body && typeof body.error === "string" && body.error.trim() !== "") {
    return body.error;
  }
  if (status === 401) return "انتهت الجلسة. سجّل الدخول من جديد.";
  if (status === 403) return "ليس لديك صلاحية لعرض هذه البيانات.";
  if (status === 404) return "غير موجود.";
  if (status >= 500) return "الخادم غير متاح مؤقتاً. حاول بعد لحظات.";
  return `تعذر تنفيذ الطلب (${status}).`;
}

/**
 * تُستخدم بدلاً من `r => r.json()` مباشرة:
 *
 *   fetch(url, { credentials: "include" }).then(jsonOrThrow)
 */
export async function jsonOrThrow(response: Response): Promise<any> {
  let body: any = null;

  try {
    const text = await response.text();
    body = text.trim() === "" ? null : JSON.parse(text);
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new HttpError(response.status, messageFor(response.status, body), body?.code);
  }

  return body;
}
