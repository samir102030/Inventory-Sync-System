import { drizzle } from "drizzle-orm/node-postgres";
import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * مخزن اتصالات منفصل للجلسات.
 *
 * السبب: كل طلب يحجز اتصالًا من `pool` طوال مدته (معاملة نطاق الشركة)، بينما
 * `express-session` يكتب/يحدّث صف الجلسة أثناء إنهاء نفس الطلب. لو شاركا نفس
 * المخزن، فكل طلب يحتاج اتصالين في وقت واحد — ومع التزامن يجلس الجميع في
 * انتظار اتصال لا يتحرر إلا بعد كتابة الجلسة. مخزن منفصل يقطع هذه الحلقة.
 */
export const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

const rootDb = drizzle(pool, { schema });

/** المعاملة كما تسلّمها drizzle إلى `db.transaction(tx => ...)`. */
export type ScopedDb = Parameters<Parameters<typeof rootDb.transaction>[0]>[0];

/** حاوية المعاملة الخاصة بالطلب الحالي. */
export const dbContext = new AsyncLocalStorage<ScopedDb>();

/**
 * وسيط: إن كنّا داخل طلب له معاملة وجّه الاستعلام إليها، وإلا استخدم
 * الاتصال العام (الهجرات وبدء التشغيل وتسجيل الدخول).
 *
 * الفائدة: المسارات تستورد `db` كما هي، فلا يتغير أي من الاستعلامات الـ296.
 */
export const db = new Proxy(rootDb, {
  get(target, prop) {
    const scoped: object = dbContext.getStore() ?? target;
    const value = Reflect.get(scoped, prop, scoped);
    return typeof value === "function" ? value.bind(scoped) : value;
  },
}) as typeof rootDb;

/** الاتصال العام دون أي نطاق شركة — للهجرات والسكربتات فقط. */
export { rootDb };

export * from "./schema";
