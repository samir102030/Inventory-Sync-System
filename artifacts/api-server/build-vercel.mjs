// يبني المشروع بصيغة Vercel Build Output API:
//
//   .vercel/output/
//     config.json                  ← التوجيه
//     static/                      ← الواجهة (Vite)
//     functions/api/index.func/    ← الـ API كله كملف واحد
//
// لماذا Build Output API وليس مجلد api/؟ لأن المشروع monorepo وحزم
// @workspace/* مكتوبة TypeScript خام؛ هنا esbuild يجمّع كل شيء في ملف واحد
// قبل أن يراه Vercel، فلا يتوقف النجاح على طريقة Vercel في ترجمة TS.
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(artifactDir, "../..");
const outRoot = path.join(root, ".vercel/output");
const funcDir = path.join(outRoot, "functions/api/index.func");
const staticDir = path.join(outRoot, "static");
const clientDist = path.join(root, "artifacts/store-system/dist/public");

// منطقة الـ function يجب أن تكون قرب قاعدة Neon، وإلا كل استعلام داخل المعاملة
// يدفع زمن ذهاب وإياب عبر المحيط. Render كان في frankfurt.
const region = process.env.VERCEL_FUNCTION_REGION ?? "fra1";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// 1) الهجرات — على الإنتاج فقط. معاينات الفروع (preview) تشارك متغيرات البيئة
// عادةً، ولا نريد أن يغيّر فرع تجريبي مخطط قاعدة الإنتاج.
if (process.env.VERCEL_ENV === "production") {
  console.log("[vercel-build] production: running db migrations");
  run("pnpm", ["run", "db:migrate"]);
} else {
  console.log(`[vercel-build] VERCEL_ENV=${process.env.VERCEL_ENV ?? "(unset)"}: skipping db migrations`);
}

// 2) الواجهة
run("pnpm", ["run", "build:client"]);
if (!fs.existsSync(clientDist)) {
  console.error(`Client build not found at ${clientDist}`);
  process.exit(1);
}

// 3) مخرجات Vercel
fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(funcDir, { recursive: true });
fs.cpSync(clientDist, staticDir, { recursive: true });

await esbuild({
  entryPoints: [path.join(artifactDir, "src/vercel.ts")],
  outfile: path.join(funcDir, "index.mjs"),
  platform: "node",
  target: "node22",
  bundle: true,
  format: "esm",
  logLevel: "info",
  sourcemap: "linked",
  // اختياري في pg ولا يوجد على Vercel؛ pg يتجاهله إن غاب.
  external: ["pg-native"],
  // حزم CJS (express وغيره) تُجمَّع داخل ESM، فتحتاج require وما شابه.
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
  },
});

fs.writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: false,
      maxDuration: 30,
      regions: [region],
    },
    null,
    2,
  ),
);
// type: module ضروري لأن الملف .mjs لكن بعض الأدوات تفحص package.json المجاور.
fs.writeFileSync(path.join(funcDir, "package.json"), JSON.stringify({ type: "module" }));

fs.writeFileSync(
  path.join(outRoot, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // ملفات الواجهة المبنية بأسماء hash تُخزَّن للأبد.
        {
          src: "/assets/(.*)",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        // أي شيء تحت /api يذهب للـ function.
        { src: "/api(?:/.*)?", dest: "/api/index" },
        // ثم الملفات الساكنة إن وُجدت.
        { handle: "filesystem" },
        // وأي مسار آخر هو صفحة من الواجهة (SPA).
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log(`[vercel-build] done -> ${path.relative(root, outRoot)} (function region: ${region})`);
