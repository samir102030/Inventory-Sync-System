import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

/**
 * جدول الجلسات الذي يستخدمه connect-pg-simple.
 *
 * كان موجودًا في قاعدة البيانات الحية لكن غير معرَّف في الكود ولا ينشئه أي
 * migration، فكان بناء قاعدة بيانات جديدة من الكود ينتج نظامًا لا يستطيع أحد
 * الدخول إليه. تعريفه هنا يجعل قاعدة البيانات قابلة لإعادة البناء بالكامل.
 *
 * الأعمدة يفرضها connect-pg-simple — لا تغيّر الأسماء ولا الأنواع.
 */
export const userSessionsTable = pgTable(
  "user_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_user_sessions_expire").on(table.expire),
  }),
);
