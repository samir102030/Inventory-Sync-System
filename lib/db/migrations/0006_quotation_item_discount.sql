-- خصم على مستوى البند في عروض الأسعار.
--
-- كان الخصم رقمًا واحدًا على العرض كله، فلا يمكن إعطاء تخفيض على صنف بعينه.
-- `invoice_items` فيه العمود بالفعل بنفس النوع، وهذا يطابقه.
--
-- مكتوبة يدويًا. آمنة وقابلة للتكرار.

ALTER TABLE "quotation_items"
  ADD COLUMN IF NOT EXISTS "discount" numeric(12, 2) NOT NULL DEFAULT '0';
