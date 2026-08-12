-- عمود الشركة في كل الجداول.
--
-- هذه الهجرة تضيف الأعمدة فقط ولا تغيّر أي سلوك: كل القيم تبدأ NULL والنظام
-- يعمل كما هو. العزل الفعلي (Row Level Security) يأتي في هجرة لاحقة.
--
-- العمود موجود في كل جدول حتى الجداول التابعة (بنود الفواتير مثلًا)، رغم أن
-- انتماءها يمكن استنتاجه من الأب. السبب: الفلترة المباشرة أقل عرضة للخطأ من
-- الفلترة عبر وصلة، ولا نريد أن يعتمد أمان البيانات على تذكّر كتابة JOIN.
--
-- مكتوبة يدويًا (drizzle-kit لا يعمل على جهاز المستخدم). آمنة وقابلة للتكرار.

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "account_transactions" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "banks" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "credit_cards" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "credit_card_transactions" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "salary_payments" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "invoice_settings" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "invoice_returns" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "invoice_return_items" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "jam3iyyat" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "jam3iyya_payments" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "rental_payments" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "receipt_vouchers" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "payment_vouchers" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "warehouse_stock" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "warehouse_transfers" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint
ALTER TABLE "warehouse_transfer_items" ADD COLUMN IF NOT EXISTS "company_id" integer;
--> statement-breakpoint

-- فهارس تسريع الفلترة، ومفاتيح أجنبية تمنع ربط صف بشركة غير موجودة.
DO $$ BEGIN
	ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_accounts_company" ON "accounts" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_account_transactions_company" ON "account_transactions" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "banks" ADD CONSTRAINT "banks_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_banks_company" ON "banks" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_categories_company" ON "categories" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credit_cards_company" ON "credit_cards" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "credit_card_transactions" ADD CONSTRAINT "credit_card_transactions_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credit_card_transactions_company" ON "credit_card_transactions" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_company" ON "customers" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_employees_company" ON "employees" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_salary_payments_company" ON "salary_payments" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expenses_company" ON "expenses" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_settings_company" ON "invoice_settings" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoices_company" ON "invoices" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_items_company" ON "invoice_items" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "invoice_returns" ADD CONSTRAINT "invoice_returns_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_returns_company" ON "invoice_returns" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "invoice_return_items" ADD CONSTRAINT "invoice_return_items_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_return_items_company" ON "invoice_return_items" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "jam3iyyat" ADD CONSTRAINT "jam3iyyat_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jam3iyyat_company" ON "jam3iyyat" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "jam3iyya_payments" ADD CONSTRAINT "jam3iyya_payments_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jam3iyya_payments_company" ON "jam3iyya_payments" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "licenses" ADD CONSTRAINT "licenses_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_licenses_company" ON "licenses" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "products" ADD CONSTRAINT "products_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_company" ON "products" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_company" ON "projects" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "purchases" ADD CONSTRAINT "purchases_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchases_company" ON "purchases" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_items_company" ON "purchase_items" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "quotations" ADD CONSTRAINT "quotations_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotations_company" ON "quotations" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quotation_items_company" ON "quotation_items" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "rental_payments" ADD CONSTRAINT "rental_payments_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rental_payments_company" ON "rental_payments" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_suppliers_company" ON "suppliers" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "receipt_vouchers" ADD CONSTRAINT "receipt_vouchers_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_receipt_vouchers_company" ON "receipt_vouchers" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_vouchers_company" ON "payment_vouchers" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_warehouses_company" ON "warehouses" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_warehouse_stock_company" ON "warehouse_stock" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_warehouse_transfers_company" ON "warehouse_transfers" ("company_id");
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "warehouse_transfer_items" ADD CONSTRAINT "warehouse_transfer_items_company_id_fk"
		FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_warehouse_transfer_items_company" ON "warehouse_transfer_items" ("company_id");
