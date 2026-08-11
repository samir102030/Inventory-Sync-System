-- الشركات + ربط المستخدمين بها + تسجيل جدول الجلسات.
--
-- مكتوبة يدويًا لأن drizzle-kit لا يعمل على جهاز المستخدم (ويندوز).
-- كل عبارة هنا آمنة على قاعدة البيانات الحالية: لا تحذف بيانات ولا تُسقط
-- أعمدة، وكل ما تضيفه إما جديد أو محمي بـ IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- جدول الجلسات: موجود بالفعل في قاعدة البيانات الحية لكنه لم يكن مسجّلًا في
-- أي migration. تسجيله هنا يجعل قاعدة البيانات قابلة لإعادة البناء بالكامل
-- من الكود. IF NOT EXISTS تجعلها بلا أثر على القاعدة الحالية.
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" USING btree ("expire");
--> statement-breakpoint

-- الشركة التي ينتمي إليها المستخدم. NULL = مالك النظام (فوق الشركات كلها).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id")
		ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
