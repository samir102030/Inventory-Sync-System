-- حقول إضافية للشركة: الرقم الضريبي وتاريخ انتهاء الاشتراك.
-- مكتوبة يدويًا (drizzle-kit لا يعمل على جهاز المستخدم). آمنة على القاعدة الحالية.

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "tax_number" text;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "subscription_ends_at" date;
