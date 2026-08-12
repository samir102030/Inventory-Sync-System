// يرفض التثبيت بغير pnpm، وينظّف أقفال المديرين الآخرين.
//
// كان هذا السطر `sh -c '...'` داخل package.json، وهو صدفة لا يعرفها cmd على
// ويندوز — فكان `pnpm install` يفشل بـ exit code 1 على جهاز المطوّر بعد أن
// يكون قد أنهى عمله فعلًا، وهو أسوأ أنواع الفشل: يبدو عطلًا وليس عطلًا.
//
// preinstall يعمل قبل وجود node_modules، فلا اعتماد هنا إلا على node نفسه.
import fs from "node:fs";

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  fs.rmSync(lockfile, { force: true });
}

const agent = process.env.npm_config_user_agent ?? "";

if (!agent.startsWith("pnpm/")) {
  console.error("Use pnpm instead. This workspace relies on pnpm catalogs and overrides.");
  process.exit(1);
}
