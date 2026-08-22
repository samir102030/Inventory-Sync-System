import type { ErrorRequestHandler, RequestHandler } from "express";

/**
 * أخطاء الـ API تخرج JSON، لا صفحة HTML.
 *
 * بدون هذا الملف كان أي خطأ غير ملتقط في أي راوت يصل إلى معالج Express
 * الافتراضي، وهو يرد صفحة HTML كاملة. النتيجة على الشاشة كانت:
 *
 *   تعذّر الحفظ
 *   HTTP 500 : <!DOCTYPE html> <html lang="en"> … Internal Server Error …
 *
 * لأن `custom-fetch.ts` حين لا يجد JSON يضع جسم الرد الخام في نص الخطأ،
 * والتوست العام في `App.tsx` يعرضه كما هو. فالمستخدم يرى HTML ولا يرى السبب،
 * والسبب نفسه يضيع في السجل بلا معرّف يربطه بالضغطة التي أنتجته.
 *
 * ‏26 ملف راوت، أغلبها بلا `try/catch`، وExpress 5 يمرّر أي وعد مرفوض من أي
 * معالج async إلى هنا تلقائيًا. المعالجة هنا لا في كل راوت: راوتٌ يُكتب غدًا
 * يحصل عليها دون أن يتذكرها أحد.
 */

/**
 * علامة على `res.locals`: هذا الطلب انتهى بخطأ غير متوقع.
 *
 * يقرأها `company-scope.ts` قبل إغلاق معاملة الطلب فيُرجعها بدل حفظها.
 * بدونها كانت المعاملة تُحفظ دائمًا — حتى حين يفشل الراوت في منتصف كتابته —
 * فتبقى فاتورة بلا بنودها، أو منتج بلا حركته، في القاعدة إلى الأبد.
 */
export const SCOPE_ROLLBACK = "scopeRollback";

/** رموز أخطاء Postgres التي لها معنى للمستخدم، لا عطلٌ في الخادم. */
const PG_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  // القيمة مكررة — باركود موجود، أو اسم فريد داخل الشركة.
  "23505": { status: 409, code: "DUPLICATE", message: "القيمة موجودة من قبل. غيّرها ثم أعد المحاولة." },
  // الصف مرتبط بصف آخر — حذف منتج على فاتورة، أو قسم غير موجود.
  "23503": { status: 409, code: "IN_USE", message: "السجل مرتبط بسجل آخر، أو المرجع المختار غير موجود." },
  "23502": { status: 400, code: "MISSING_FIELD", message: "حقل مطلوب لم يُرسَل." },
  "23514": { status: 400, code: "CHECK_FAILED", message: "قيمة غير مقبولة في أحد الحقول." },
  // نص في مكان رقم: "" أو "abc" في عمود integer.
  "22P02": { status: 400, code: "BAD_VALUE", message: "قيمة غير صالحة في أحد الحقول الرقمية." },
  "22003": { status: 400, code: "OUT_OF_RANGE", message: "رقم أكبر مما يقبله الحقل." },
  "22001": { status: 400, code: "TOO_LONG", message: "نص أطول مما يقبله الحقل." },
  // RLS رفضت الصف: كتابة خارج نطاق الشركة الفعّالة.
  "42501": { status: 403, code: "OUT_OF_SCOPE", message: "هذه البيانات ليست ضمن نطاق الشركة الحالية." },
  "57014": { status: 503, code: "TIMEOUT", message: "الطلب استغرق وقتًا طويلًا. حاول مرة أخرى." },
  "53300": { status: 503, code: "BUSY", message: "الخادم مشغول مؤقتًا. حاول بعد لحظات." },
  "08006": { status: 503, code: "DB_DOWN", message: "تعذر الاتصال بقاعدة البيانات. حاول بعد لحظات." },
};

/**
 * انحراف المخطط: العمود أو الجدول غير موجود في قاعدة البيانات المنشورة.
 * دائمًا عطل نشر (هجرة لم تُشغَّل)، لا خطأ مستخدم — يُفصَل ليقرأ في السجل فورًا.
 */
const SCHEMA_DRIFT = new Set(["42703", "42P01", "42883"]);

function pgCodeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

/** مسار /api غير معروف يرد JSON، لا صفحة HTML ولا صفحة الواجهة. */
export const apiNotFound: RequestHandler = (req, res) => {
  res.status(404).json({
    error: `المسار غير موجود: ${req.method} ${req.baseUrl}${req.path}`,
    code: "NOT_FOUND",
  });
};

export const apiErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // الطلب فشل: لا تُحفظ كتابته مهما كان سبب الفشل. تُوضع قبل أي شيء آخر كي
  // تُوضع أيضًا حين يكون الرد قد بدأ ولا يمكن تغييره.
  res.locals[SCOPE_ROLLBACK] = true;

  // الرد بدأ فعلًا: لا يمكن استبداله. أغلقه ودع Express يسجّل.
  if (res.headersSent) return next(err);

  const requestId = String((req as { id?: unknown }).id ?? "");
  const pgCode = pgCodeOf(err);
  const known = pgCode ? PG_ERRORS[pgCode] : undefined;

  // أخطاء express.json قبل وصول الطلب إلى أي راوت.
  const bodyType = (err as { type?: string } | null)?.type;
  if (!known && bodyType === "entity.parse.failed") {
    req.log?.warn({ err, requestId }, "Malformed JSON body");
    res.status(400).json({ error: "جسم الطلب ليس JSON صالحًا.", code: "BAD_JSON", requestId });
    return;
  }
  if (!known && bodyType === "entity.too.large") {
    req.log?.warn({ err, requestId }, "Request body too large");
    res.status(413).json({ error: "حجم الطلب أكبر من المسموح.", code: "TOO_LARGE", requestId });
    return;
  }

  // السجل يحمل الخطأ كاملًا دائمًا — هو المكان الوحيد الذي يُقال فيه كل شيء.
  const logPayload = {
    err,
    requestId,
    method: req.method,
    url: req.originalUrl.split("?")[0],
    pgCode,
    constraint: (err as { constraint?: string } | null)?.constraint,
    table: (err as { table?: string } | null)?.table,
    column: (err as { column?: string } | null)?.column,
    detail: (err as { detail?: string } | null)?.detail,
  };

  if (known) {
    // خطأ مفهوم: يُسجَّل كتحذير لأنه ليس عطلًا في الخادم.
    req.log?.warn(logPayload, "Request rejected by the database");
    res.status(known.status).json({
      error: known.message,
      code: known.code,
      // اسم القيد يقول أي حقل بالضبط دون كشف أي بيانات.
      constraint: logPayload.constraint,
      requestId,
    });
    return;
  }

  if (pgCode && SCHEMA_DRIFT.has(pgCode)) {
    req.log?.error(logPayload, "Schema drift: the deployed database does not match the code");
    res.status(500).json({
      error: "المخطط المنشور لا يطابق الكود — هجرة لم تُشغَّل. راجع سجل الخادم.",
      code: "SCHEMA_DRIFT",
      requestId,
    });
    return;
  }

  req.log?.error(logPayload, "Unhandled error in an API route");
  res.status(500).json({
    error: "خطأ غير متوقع في الخادم. اذكر رقم الطلب عند الإبلاغ.",
    code: "INTERNAL",
    requestId,
  });
};
