-- التسجيل الذاتي بكود تفعيل.
--
-- مساران:
--   موظف في شركة قائمة  ⇒ يكتب كود انضمام الشركة، فيصل طلبه لأدمن شركته.
--   عميل جديد           ⇒ يكتب اسم شركته بلا كود، فيصل طلبه لمالك النظام،
--                          وعند الموافقة تُنشأ الشركة ويصير هو أدمنها.
--
-- الحساب يولد موقوفًا بلا كلمة مرور. بعد الموافقة يُولَّد كود تفعيل يُرسَل
-- بالإيميل، ولا يُخزَّن الكود نفسه بل بصمته (bcrypt): من يقرأ قاعدة البيانات
-- لا يستطيع تفعيل حساب غيره.
--
-- مكتوبة يدويًا. آمنة وقابلة للتكرار.

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "join_code" text;
--> statement-breakpoint
-- كود لكل شركة قائمة. بلا حروف ملتبسة (0/O و 1/I) لأنه يُملى ويُكتب يدويًا.
UPDATE "companies"
SET "join_code" = upper(
  translate(
    substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 8),
    'abcdef', 'JKMNPQ'
  )
)
WHERE "join_code" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companies_join_code_unique" ON "companies" ("join_code");
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activation_code_hash" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activation_expires_at" timestamp with time zone;
--> statement-breakpoint
-- اسم الشركة الذي طلبه عميل جديد، قبل أن توجد الشركة فعلًا.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "requested_company_name" text;
--> statement-breakpoint
-- طلب بلا شركة (عميل جديد) لا يراه إلا مالك النظام، وسياسة RLS تفعل ذلك
-- وحدها: الصف بـ company_id فارغ لا يظهر تحت نطاق أي شركة.
CREATE INDEX IF NOT EXISTS "idx_users_status" ON "users" ("status");
