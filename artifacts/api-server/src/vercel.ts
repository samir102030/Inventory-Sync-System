// نقطة دخول Vercel: نفس تطبيق Express لكن بلا app.listen.
//
// Vercel يستدعي هذه الدالة لكل طلب. التطبيق نفسه (app.ts) لم يتغير، فكل
// الميدلوير وعزل الشركات (RLS) والجلسات تعمل كما هي على Render.
import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { verifyCompanyIsolation } from "./lib/verify-isolation";

// الفحص التشخيصي يعمل مرة لكل instance دون أن يؤخر أي طلب، ولا يمنع الخدمة
// إن فشل (نفس سلوكه على Render).
verifyCompanyIsolation().catch((err) => {
  logger.error({ err }, "Company isolation check could not run");
});

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as never, res as never);
}
