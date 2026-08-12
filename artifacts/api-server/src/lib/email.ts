import { logger } from "./logger";

/**
 * إرسال البريد عبر Brevo.
 *
 * استدعاء مباشر لواجهة REST بـ fetch، بلا مكتبة: تثبيت الحزم على جهاز
 * المطوّر (ويندوز) مصدر أعطال متكررة، والطلب هنا سطران.
 *
 * المفتاح في متغيرات البيئة لا في الكود — المستودع عام.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export function isEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

/**
 * يرسل ويعيد نجاحه. لا يرمي أبدًا: فشل البريد يجب ألا يُسقط عملية الموافقة،
 * فالأدمن يرى كود التفعيل أمامه على الشاشة ويستطيع تسليمه بنفسه.
 */
export async function sendEmail(options: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? "Nile Security System";

  if (!apiKey || !senderEmail) {
    logger.warn("BREVO_API_KEY/BREVO_SENDER_EMAIL not set; skipping email");
    return { sent: false, reason: "البريد غير مُعدّ على الخادم." };
  }

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: options.to, ...(options.toName ? { name: options.toName } : {}) }],
        subject: options.subject,
        htmlContent: options.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body }, "Brevo rejected the email");
      return { sent: false, reason: `Brevo رفض الإرسال (${response.status}).` };
    }

    return { sent: true };
  } catch (error) {
    logger.error({ err: error }, "Could not reach Brevo");
    return { sent: false, reason: "تعذر الاتصال بخدمة البريد." };
  }
}

/** قالب رسالة كود التفعيل. */
export function activationEmail(name: string, code: string, appUrl: string) {
  return {
    subject: "كود تفعيل حسابك",
    html: `
<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#1f2937">
  <p>أهلاً ${escapeHtml(name)}،</p>
  <p>تمت الموافقة على حسابك. استخدم الكود التالي لتفعيله واختيار كلمة المرور:</p>
  <p style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#1e40af;margin:24px 0">${escapeHtml(code)}</p>
  <p>الكود صالح لمدة ٧ أيام.</p>
  <p><a href="${escapeHtml(appUrl)}/login" style="color:#1e40af">افتح النظام</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
  <p style="font-size:12px;color:#6b7280">إذا لم تطلب هذا الحساب فتجاهل الرسالة.</p>
</div>`,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
