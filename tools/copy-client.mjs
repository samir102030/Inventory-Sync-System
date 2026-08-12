// ينسخ بناء الواجهة إلى مجلد السيرفر ليقدّمها Express من نفس الـ origin.
//
// كان هذا السطر `rm -rf ... && cp -r ...` داخل package.json، وهي أوامر لينكس
// لا يعرفها cmd على ويندوز — فكان `build:deploy` يفشل على جهاز المطوّر بينما
// ينجح على Render. النسخة بـ node تعمل على الاثنين.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const from = path.join(root, "artifacts/store-system/dist/public");
const to = path.join(root, "artifacts/api-server/dist/client");

if (!fs.existsSync(from)) {
  console.error(`Client build not found at ${from}. Run build:client first.`);
  process.exit(1);
}

fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });

console.log(`Copied client build -> ${path.relative(root, to)}`);
