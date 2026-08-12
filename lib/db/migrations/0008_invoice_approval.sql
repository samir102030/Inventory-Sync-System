-- موافقة الأدمن على فواتير الكاشير.
--
-- الكاشير يبيع، والأدمن يراجع. الفاتورة التي ينشئها كاشير تولد `pending`
-- وتظهر في صفحة مراجعة لا يفتحها إلا الأدمن، يصححها إن أخطأ ثم يعتمدها.
--
-- المخزون والخزينة يتحركان لحظة البيع لا لحظة الموافقة: الزبون أخذ البضاعة
-- ودفع فعلًا، فتأجيل ذلك يجعل المخزون كاذبًا حتى يمر الأدمن. الموافقة تدقيق
-- لا حجز.
--
-- الافتراضي `approved` عن قصد: كل الفواتير القائمة اعتُمدت بالفعل بحكم
-- وجودها، ولا معنى لأن يستيقظ الأدمن على مئات ينتظرن موافقته.
--
-- مكتوبة يدويًا. آمنة وقابلة للتكرار.

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "approval_status" text NOT NULL DEFAULT 'approved';
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "approved_by" text;
--> statement-breakpoint
ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoices_approval" ON "invoices" ("approval_status");
