import app from "./app";
import { logger } from "./lib/logger";
import { verifyCompanyIsolation } from "./lib/verify-isolation";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// فحص تشخيصي: يكتب في السجلات إن كان عزل الشركات مفروضًا فعلًا.
// لا يمنع الإقلاع — عطلٌ في أداة التشخيص نفسها يجب ألا يُسقط الخدمة.
try {
  await verifyCompanyIsolation();
} catch (err) {
  logger.error({ err }, "Company isolation check could not run");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
