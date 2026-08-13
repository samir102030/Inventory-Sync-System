-- البراندات ودور المورّد.
--
-- المورّد (`vendor`) يضيف البراندات ويعدّلها ولا يحذفها. ما يضيفه يعمل فورًا
-- لكنه يبقى `pending` حتى يعتمده أدمن الشركة أو مالك النظام، وعندها يراه
-- الجميع.
--
-- ⚠️ الجدول جديد بعد هجرة العزل (0004)، فسياسات RLS لا تشمله تلقائيًا.
-- بدون الأسطر أدناه يكون هذا الجدول وحده مكشوفًا بين 33 جدولًا محميًا —
-- وهذا بالضبط ما يجعل "نصف عزل" أخطر من غيابه.
--
-- مكتوبة يدويًا. آمنة وقابلة للتكرار.

CREATE TABLE IF NOT EXISTS "brands" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_id" integer,
  "name" text NOT NULL,
  "description" text,
  "website" text,
  "approval_status" text DEFAULT 'approved' NOT NULL,
  "created_by" text,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "brands" ADD CONSTRAINT "brands_company_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_brands_company" ON "brands" ("company_id");
--> statement-breakpoint
-- الاسم فريد داخل الشركة لا عبر النظام: براند عند عميل لا يمنعه عند غيره.
CREATE UNIQUE INDEX IF NOT EXISTS "brands_company_name_unique"
  ON "brands" ("company_id", lower("name"));
--> statement-breakpoint
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "brands" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "brands";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "brands"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "brands" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
