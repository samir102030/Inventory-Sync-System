-- عزل بيانات الشركات على مستوى قاعدة البيانات (Row Level Security).
--
-- لماذا هنا وليس في الاستعلامات؟ المشروع فيه 296 استعلامًا في 26 ملف راوت.
-- أمانٌ يعتمد على تذكّر كتابة فلتر في كل استعلام جديد يسقط أول مرة يُنسى فيها
-- واحد. هنا ترفض قاعدة البيانات نفسها الصف — فشلٌ مغلق لا مفتوح.
--
-- كيف تعرف القاعدة الشركة؟ من متغيّر `app.company_id` الذي يضعه ميدلوير
-- `company-scope.ts` داخل معاملة كل طلب عبر set_config(..., true).
-- المعامل الثالث `true` أساسي: Neon يشغّل PgBouncer في وضع transaction،
-- فالقيمة المضبوطة بـ SET العادي تبقى على الاتصال ويرثها الطلب التالي.
--
-- FORCE ROW LEVEL SECURITY: بدونها يتجاوز مالك الجداول السياسات تمامًا،
-- والتطبيق يتصل بحساب المالك. (البديل — دور Postgres منفصل — أُجّل.)
--
-- القيمة الفارغة/غير المضبوطة تعني "بلا تقييد": يحتاجها مالك النظام قبل
-- التبديل، وتحتاجها الهجرات وتسجيل الدخول. القيمة '0' تعني "لا شيء".
--
-- مكتوبة يدويًا. آمنة وقابلة للتكرار.

CREATE OR REPLACE FUNCTION app_current_company() RETURNS integer
  LANGUAGE sql
  STABLE
  AS $$ SELECT nullif(current_setting('app.company_id', true), '')::integer $$;

--> statement-breakpoint
ALTER TABLE "account_transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "account_transactions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "account_transactions";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "account_transactions"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "account_transactions" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "accounts";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "accounts"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "banks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "banks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "banks";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "banks"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "banks" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "categories";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "categories"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "credit_card_transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "credit_card_transactions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "credit_card_transactions";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "credit_card_transactions"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "credit_card_transactions" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "credit_cards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "credit_cards" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "credit_cards";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "credit_cards"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "credit_cards" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "customers";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "customers"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "employees";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "employees"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "expenses";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "expenses"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invoice_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "invoice_items";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "invoice_items"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "invoice_return_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invoice_return_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "invoice_return_items";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "invoice_return_items"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "invoice_return_items" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "invoice_returns" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invoice_returns" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "invoice_returns";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "invoice_returns"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "invoice_returns" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "invoice_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invoice_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "invoice_settings";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "invoice_settings"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "invoice_settings" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "invoices";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "invoices"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "jam3iyya_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jam3iyya_payments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "jam3iyya_payments";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "jam3iyya_payments"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "jam3iyya_payments" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "jam3iyyat" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "jam3iyyat" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "jam3iyyat";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "jam3iyyat"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "jam3iyyat" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "licenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "licenses" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "licenses";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "licenses"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "licenses" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "payment_vouchers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payment_vouchers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "payment_vouchers";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "payment_vouchers"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "payment_vouchers" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "products";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "products"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "projects";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "projects"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "purchase_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "purchase_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "purchase_items";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "purchase_items"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "purchases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "purchases" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "purchases";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "purchases"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "purchases" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "quotation_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotation_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "quotation_items";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "quotation_items"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "quotation_items" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "quotations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "quotations";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "quotations"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "quotations" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "receipt_vouchers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "receipt_vouchers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "receipt_vouchers";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "receipt_vouchers"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "receipt_vouchers" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "rental_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "rental_payments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "rental_payments";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "rental_payments"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "rental_payments" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "salary_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "salary_payments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "salary_payments";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "salary_payments"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "salary_payments" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "suppliers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "suppliers";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "suppliers"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "users";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "users"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "warehouse_stock" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "warehouse_stock" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "warehouse_stock";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "warehouse_stock"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "warehouse_stock" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "warehouse_transfer_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "warehouse_transfer_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "warehouse_transfer_items";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "warehouse_transfer_items"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "warehouse_transfer_items" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "warehouse_transfers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "warehouse_transfers";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "warehouse_transfers"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "warehouses" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "company_isolation" ON "warehouses";
--> statement-breakpoint
CREATE POLICY "company_isolation" ON "warehouses"
  USING (app_current_company() IS NULL OR "company_id" = app_current_company())
  WITH CHECK (app_current_company() IS NULL OR "company_id" = app_current_company());
--> statement-breakpoint
ALTER TABLE "warehouses" ALTER COLUMN "company_id" SET DEFAULT app_current_company();
--> statement-breakpoint
-- ترقيم مستقل لكل شركة ------------------------------------------------------
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoice_number_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_company_invoice_number_unique"
  ON "invoices" ("company_id", "invoice_number");
--> statement-breakpoint
ALTER TABLE "quotations" DROP CONSTRAINT IF EXISTS "quotations_quotation_number_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quotations_company_quotation_number_unique"
  ON "quotations" ("company_id", "quotation_number");
--> statement-breakpoint
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_purchase_number_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchases_company_purchase_number_unique"
  ON "purchases" ("company_id", "purchase_number");
--> statement-breakpoint
ALTER TABLE "invoice_returns" DROP CONSTRAINT IF EXISTS "invoice_returns_return_number_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_returns_company_return_number_unique"
  ON "invoice_returns" ("company_id", "return_number");
--> statement-breakpoint
ALTER TABLE "receipt_vouchers" DROP CONSTRAINT IF EXISTS "receipt_vouchers_voucher_number_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "receipt_vouchers_company_voucher_number_unique"
  ON "receipt_vouchers" ("company_id", "voucher_number");
--> statement-breakpoint
ALTER TABLE "payment_vouchers" DROP CONSTRAINT IF EXISTS "payment_vouchers_voucher_number_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_vouchers_company_voucher_number_unique"
  ON "payment_vouchers" ("company_id", "voucher_number");
