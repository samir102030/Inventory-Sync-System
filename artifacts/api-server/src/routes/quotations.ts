import { Router } from "express";
import { db, quotationsTable, quotationItemsTable, customersTable, productsTable, invoicesTable, invoiceItemsTable, invoiceSettingsTable, usersTable, accountTransactionsTable, categoriesTable } from "@workspace/db";
import { and, eq, ne, sql, desc } from "drizzle-orm";
import { nextDocumentNumber } from "../lib/document-number";

const router = Router();

// Derived from the highest number already issued, not from the row count.
// Counting rows reuses numbers after a deletion, which then collides with the
// UNIQUE constraint on quotation_number and blocks saving entirely.
async function generateQuotationNumber() {
  const [row] = await db
    .select({
      max: sql<number>`COALESCE(MAX(NULLIF(SUBSTRING(${quotationsTable.quotationNumber} FROM '[0-9]+$'), '')::int), 0)`,
    })
    .from(quotationsTable);
  const num = (Number(row?.max ?? 0) + 1).toString().padStart(5, "0");
  return `QUO-${num}`;
}

/**
 * حساب العرض: مجموع البنود بعد خصم كل بند، ثم الخصم العام، ثم الضريبة.
 *
 * الضريبة تُحسب من نسبة `invoice_settings.tax_rate` على الصافي بعد الخصم،
 * لا تُكتب مبلغًا يدويًا كما كان. العميل يستطيع تجاوزها بإرسال `tax` صراحةً
 * — بعض العروض تُسعَّر بمبلغ ضريبة متفق عليه.
 */
async function priceQuotation(items: any[], discount: unknown, tax: unknown) {
  const lines = items.map((i: any) => {
    const quantity = Number(i.quantity) || 0;
    const unitPrice = Number(i.unitPrice) || 0;
    const lineDiscount = Number(i.discount ?? 0) || 0;
    return { ...i, quantity, unitPrice, discount: lineDiscount, total: quantity * unitPrice - lineDiscount };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const discountAmount = Number(discount ?? 0) || 0;
  const net = subtotal - discountAmount;

  let taxAmount: number;
  if (tax === undefined || tax === null || tax === "") {
    const [settings] = await db
      .select({ rate: invoiceSettingsTable.taxRate, showTax: invoiceSettingsTable.showTax })
      .from(invoiceSettingsTable)
      .limit(1);
    const rate = settings?.showTax ? Number(settings.rate ?? 0) : 0;
    taxAmount = Math.round(net * (rate / 100) * 100) / 100;
  } else {
    taxAmount = Number(tax) || 0;
  }

  return { lines, subtotal, discountAmount, taxAmount, total: net + taxAmount };
}

/**
 * من أنشأ المستند.
 *
 * كان يقرأ `req.session.user?.username` وهذا الحقل لا يُضبط إطلاقًا — الجلسة
 * تحفظ `userId` و `role` فقط — فكان `created_by` فارغًا في كل عرض سعر.
 */
async function currentUserName(req: any): Promise<string | null> {
  const userId = (req.session as any)?.userId;
  if (!userId) return null;
  const [user] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.name ?? null;
}

/** القسم الذي تنزل فيه المنتجات المُنشأة تلقائيًا. يُنشأ مرة واحدة. */
const AUTO_CATEGORY = "غير مصنف";

async function ensureAutoCategory(): Promise<number> {
  const [existing] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(sql`lower(trim(${categoriesTable.name})) = ${AUTO_CATEGORY}`)
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(categoriesTable)
    .values({ name: AUTO_CATEGORY, description: "أصناف أُنشئت تلقائيًا عند تحويل عرض سعر" })
    .returning({ id: categoriesTable.id });
  return created.id;
}

/**
 * البند المكتوب بالإيد يصير منتجًا في الكتالوج.
 *
 * عروض الأسعار تُكتب بنودها بالإيد قبل أن يُدخَل الصنف الكتالوج، فكان
 * التحويل يُرفض كاملًا ويُطلب من صاحبه أن يُدخِل عشرين صنفًا يدويًا قبل أن
 * يفوتر بيعة تمّت. الإنشاء هنا يزيل هذه الخطوة.
 *
 * المطابقة بالاسم أولًا: صنف موجود لا يُكرَّر، ولو تكرر الاسم داخل العرض
 * نفسه أُنشئ مرة واحدة وارتبط البندان به.
 *
 * المخزون الابتدائي = الكمية المباعة، لأن الخصم التالي يُنزله إلى صفر —
 * وصفرٌ أصدق من سالبٍ لصنف لم يُسجَّل أصلًا. والتكلفة تبدأ صفرًا لأننا لا
 * نعرفها؛ صاحبها يكتبها، وحتى يكتبها يظهر ربح الفاتورة أعلى من حقيقته.
 */
async function findOrCreateProduct(
  name: string,
  unitPrice: string,
  quantity: string,
  cache: Map<string, number>,
): Promise<number> {
  const key = String(name ?? "").trim().toLowerCase();

  const cached = cache.get(key);
  if (cached) return cached;

  const [existing] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(sql`lower(trim(${productsTable.name})) = ${key}`)
    .limit(1);

  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const categoryId = await ensureAutoCategory();
  const openingStock = Math.max(0, Math.round(Number(quantity) || 0));

  const [created] = await db
    .insert(productsTable)
    .values({
      name: String(name).trim(),
      price: String(unitPrice ?? 0),
      costPrice: null,
      categoryId,
      stock: openingStock,
      minStock: 5,
      unit: "قطعة",
    })
    .returning({ id: productsTable.id });

  cache.set(key, created.id);
  return created.id;
}

function formatQuotation(q: any, customerName?: string | null) {
  return {
    id: q.id,
    quotationNumber: q.quotationNumber,
    customerId: q.customerId ?? null,
    customerName: customerName ?? q.customerName ?? null,
    subtotal: Number(q.subtotal),
    discount: Number(q.discount),
    tax: Number(q.tax),
    total: Number(q.total),
    status: q.status,
    notes: q.notes ?? null,
    validUntil: q.validUntil ?? null,
    createdBy: q.createdBy ?? null,
    createdAt: q.createdAt instanceof Date ? q.createdAt.toISOString() : q.createdAt,
  };
}

router.get("/quotations", async (req, res) => {
  const rows = await db
    .select({
      id: quotationsTable.id,
      quotationNumber: quotationsTable.quotationNumber,
      customerId: quotationsTable.customerId,
      customerName: customersTable.name,
      subtotal: quotationsTable.subtotal,
      discount: quotationsTable.discount,
      tax: quotationsTable.tax,
      total: quotationsTable.total,
      status: quotationsTable.status,
      notes: quotationsTable.notes,
      validUntil: quotationsTable.validUntil,
      createdBy: quotationsTable.createdBy,
      createdAt: quotationsTable.createdAt,
    })
    .from(quotationsTable)
    .leftJoin(customersTable, eq(quotationsTable.customerId, customersTable.id))
    .orderBy(desc(quotationsTable.createdAt));

  res.json(rows.map(r => formatQuotation(r, r.customerName)));
});

router.get("/quotations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [q] = await db
    .select({
      id: quotationsTable.id,
      quotationNumber: quotationsTable.quotationNumber,
      customerId: quotationsTable.customerId,
      customerName: customersTable.name,
      subtotal: quotationsTable.subtotal,
      discount: quotationsTable.discount,
      tax: quotationsTable.tax,
      total: quotationsTable.total,
      status: quotationsTable.status,
      notes: quotationsTable.notes,
      validUntil: quotationsTable.validUntil,
      createdBy: quotationsTable.createdBy,
      createdAt: quotationsTable.createdAt,
    })
    .from(quotationsTable)
    .leftJoin(customersTable, eq(quotationsTable.customerId, customersTable.id))
    .where(eq(quotationsTable.id, id));

  if (!q) return res.status(404).json({ error: "not found" });

  const items = await db
    .select()
    .from(quotationItemsTable)
    .where(eq(quotationItemsTable.quotationId, id));

  return res.json({
    ...formatQuotation(q, q.customerName),
    items: items.map(i => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discount: Number(i.discount ?? 0),
      total: Number(i.total),
    })),
  });
});

router.post("/quotations", async (req, res) => {
  const { customerId, customerName, items = [], discount = 0, tax, notes, validUntil } = req.body;
  const quotationNumber = await generateQuotationNumber();

  const priced = await priceQuotation(items, discount, tax);

  const [quotation] = await db.insert(quotationsTable).values({
    quotationNumber,
    customerId: customerId || null,
    customerName: customerName || null,
    subtotal: String(priced.subtotal),
    discount: String(priced.discountAmount),
    tax: String(priced.taxAmount),
    total: String(priced.total),
    status: "draft",
    notes: notes || null,
    validUntil: validUntil || null,
    createdBy: await currentUserName(req),
  }).returning();

  if (priced.lines.length > 0) {
    await db.insert(quotationItemsTable).values(
      priced.lines.map((i: any) => ({
        quotationId: quotation.id,
        productId: i.productId || null,
        productName: i.productName,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        discount: String(i.discount),
        total: String(i.total),
      }))
    );
  }

  return res.json({ ...formatQuotation(quotation), items: priced.lines });
});

router.put("/quotations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { customerId, customerName, items = [], discount = 0, tax, notes, validUntil, status } = req.body;

  /**
   * العرض المحوَّل لا يُعدَّل، وحالته لا تُمحى.
   *
   * كان هذا المسار يكتب `status: status || "draft"` وفورم التعديل لا يرسل
   * `status` إطلاقًا، فكل تعديل يُنزل العرض إلى `draft` — بما فيه عرضٌ
   * حُوِّل إلى فاتورة. وذلك يعيد تسليح حارس التحويل، فيُحوَّل العرض مرة
   * أخرى: فاتورة مكررة، ومخزون يُخصم مرتين لبيعة واحدة. الطريق إليه ضغطتان
   * من القائمة.
   *
   * الرفض قبل أي كتابة عمدًا: الرد المقصود بـ 4xx لا يُرجع معاملة الطلب.
   */
  const [existing] = await db
    .select({ status: quotationsTable.status })
    .from(quotationsTable)
    .where(eq(quotationsTable.id, id));

  if (!existing) return res.status(404).json({ error: "العرض غير موجود." });

  if (existing.status === "converted") {
    return res.status(409).json({
      error: "لا يمكن تعديل عرض حُوِّل إلى فاتورة. عدّل الفاتورة نفسها، أو أنشئ عرضًا جديدًا.",
      code: "ALREADY_CONVERTED",
    });
  }

  const priced = await priceQuotation(items, discount, tax);

  const [updated] = await db.update(quotationsTable).set({
    customerId: customerId || null,
    customerName: customerName || null,
    subtotal: String(priced.subtotal),
    discount: String(priced.discountAmount),
    tax: String(priced.taxAmount),
    total: String(priced.total),
    // ?? لا || : الحالة تبقى كما هي حين لا يرسلها المُعدِّل، ولا ترجع إلى المسودة.
    status: status ?? existing.status,
    notes: notes || null,
    validUntil: validUntil || null,
  }).where(eq(quotationsTable.id, id)).returning();

  if (!updated) return res.status(404).json({ error: "not found" });

  await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
  if (priced.lines.length > 0) {
    await db.insert(quotationItemsTable).values(
      priced.lines.map((i: any) => ({
        quotationId: id,
        productId: i.productId || null,
        productName: i.productName,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice),
        discount: String(i.discount),
        total: String(i.total),
      }))
    );
  }

  return res.json({ ...formatQuotation(updated), items: priced.lines });
});

/**
 * الحالات التي يجوز لأحد أن يكتبها.
 *
 * `converted` غائبة عمدًا: لا تُكتب إلا من مسار التحويل ومعها فاتورة. وبدون
 * هذه القائمة كان المسار يكتب أي نص يصل إليه — فيُعاد عرضٌ محوَّل إلى
 * `accepted` ثم يُحوَّل ثانية (فاتورة مكررة ومخزون مخصوم مرتين)، أو تُكتب
 * `converted` بالإيد بلا فاتورة خلفها فيختفي زر التحويل عن العرض إلى الأبد.
 */
const QUOTATION_STATUSES = new Set(["draft", "sent", "accepted", "rejected", "expired"]);

router.patch("/quotations/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!QUOTATION_STATUSES.has(status)) {
    return res.status(400).json({ error: "حالة غير معروفة لعرض السعر.", code: "BAD_STATUS" });
  }

  // التحديث المشروط: العرض المحوَّل لا تتغير حالته مهما كان الطالب.
  const [updated] = await db
    .update(quotationsTable)
    .set({ status })
    .where(and(eq(quotationsTable.id, id), ne(quotationsTable.status, "converted")))
    .returning();

  if (!updated) {
    const [exists] = await db
      .select({ id: quotationsTable.id })
      .from(quotationsTable)
      .where(eq(quotationsTable.id, id));
    if (!exists) return res.status(404).json({ error: "العرض غير موجود." });
    return res.status(409).json({
      error: "لا يمكن تغيير حالة عرض حُوِّل إلى فاتورة.",
      code: "ALREADY_CONVERTED",
    });
  }

  return res.json(formatQuotation(updated));
});

router.delete("/quotations/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(quotationsTable).where(eq(quotationsTable.id, id));
  res.json({ ok: true });
});

/**
 * تحويل عرض سعر إلى فاتورة.
 *
 * الفاتورة الناتجة يجب أن تكون فاتورة كاملة لا هيكلًا يشبهها. كانت هنا
 * تُبنى بالإيد فتخرج ناقصة في ستة أوجه: لا تخصم مخزونًا، ولا تحمل سعر
 * تكلفة، ولا باركود، ولا حالة اعتماد، ولا حركة خزنة، ولا تعرف مشروعها.
 * كل ما يفعله `POST /invoices` يُفعل هنا.
 *
 * أخطرها كان المخزون: `PATCH /invoices/:id` يُرجع الكميات إلى المخزون عند
 * الإلغاء، مستنتجًا من وجود سطور الفاتورة أنها خُصمت. فكانت فاتورة محوَّلة
 * ثم ملغاة تخلق بضاعة من العدم — بضغطتين من قائمة الحالة.
 *
 * والمستخدم يختار: مسودة (لم تُقبض بعد) أو مدفوعة (تمّت). المخزون يخرج في
 * الحالتين — كما في البيع المباشر تمامًا — لأن "مسودة" تعني أن النقود لم
 * تُقبض، لا أن البضاعة لم تخرج.
 */
router.post("/quotations/:id/convert", async (req, res) => {
  const id = Number(req.params.id);
  const { status, paymentMethod, accountId } = (req.body ?? {}) as {
    status?: string;
    paymentMethod?: string;
    accountId?: number | string | null;
  };

  const invoiceStatus = status === "paid" ? "paid" : "draft";
  const method = paymentMethod || "cash";
  const account = accountId ? Number(accountId) : null;

  const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!q) return res.status(404).json({ error: "العرض غير موجود." });

  if (q.status === "converted") {
    return res.status(409).json({
      error: "هذا العرض محوَّل إلى فاتورة بالفعل. افتح الفواتير للاطلاع عليها.",
      code: "ALREADY_CONVERTED",
    });
  }

  const items = await db.select().from(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));
  if (items.length === 0) {
    return res.status(400).json({ error: "لا يمكن تحويل عرض بلا بنود.", code: "EMPTY_QUOTATION" });
  }

  // البيع الآجل دَينٌ على أحد: بلا عميل لا يُقيَّد في أي حساب. نفس شرط POST /invoices.
  if (method === "credit" && !q.customerId) {
    return res.status(400).json({
      error: "البيع الآجل يحتاج عميلًا. افتح العرض واختر العميل أولًا.",
      code: "CREDIT_NEEDS_CUSTOMER",
    });
  }

  /**
   * تحقق للقراءة وحدها قبل الحجز.
   *
   * كل ما بعد الحجز كتابة، و`return` برفض لا يُرجع معاملة الطلب — فيبقى
   * العرض محجوزًا بلا فاتورة. لذلك كل ما قد يرفض الطلب يقع هنا.
   */
  for (const item of items) {
    if (!item.productId) continue;
    const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
    if (!product) {
      return res.status(400).json({
        error: `المنتج المرتبط بالبند "${item.productName}" لم يعد موجودًا. افتح العرض وصحّح البند.`,
        code: "PRODUCT_GONE",
      });
    }
  }

  /**
   * حجز العرض قبل أي كتابة.
   *
   * التحديث المشروط يقرأ ويكتب في خطوة واحدة، فطلبان متزامنان لا يمرّان
   * معًا: الثاني لا يجد صفًا فيرتد. الفحص المنفصل أعلاه لرسالة مفهومة،
   * وهذا السطر هو المنع الفعلي. وكل ما بعده داخل معاملة الطلب نفسها،
   * فإن فشل شيء رجع الحجز معه.
   */
  const [claimed] = await db
    .update(quotationsTable)
    .set({ status: "converted" })
    .where(and(eq(quotationsTable.id, id), ne(quotationsTable.status, "converted")))
    .returning({ id: quotationsTable.id });

  if (!claimed) {
    return res.status(409).json({
      error: "هذا العرض محوَّل إلى فاتورة بالفعل.",
      code: "ALREADY_CONVERTED",
    });
  }

  /**
   * السطور تُبنى بعد الحجز لأن بناءها قد يُنشئ منتجات — كتابةٌ لا يصح أن
   * تقع لطلب سيرتد. وكل هذا داخل معاملة الطلب، فإن فشل شيء بعده رجع معه.
   */
  const productCache = new Map<string, number>();
  let createdProducts = 0;

  const lines: Array<{
    productId: number;
    productName: string;
    barcode: string | null;
    costPrice: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    total: string;
  }> = [];

  for (const item of items) {
    let productId = item.productId ?? null;

    if (productId == null) {
      const before = productCache.size;
      productId = await findOrCreateProduct(item.productName, item.unitPrice, item.quantity, productCache);
      if (productCache.size > before) createdProducts++;
    }

    const [product] = await db
      .select({ barcode: productsTable.barcode, costPrice: productsTable.costPrice })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    lines.push({
      productId,
      productName: item.productName,
      barcode: product?.barcode ?? null,
      costPrice: String(product?.costPrice ?? 0),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      // خصم البند ينتقل مع البند: بدونه ترتفع الفاتورة عن العرض المتفق عليه.
      discount: item.discount ?? "0",
      total: item.total,
    });
  }

  const settings = await db.select().from(invoiceSettingsTable).limit(1);
  const prefix = settings[0]?.invoicePrefix ?? "INV";
  const invoiceNumber = await nextDocumentNumber("invoices", "invoice_number", prefix);

  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNumber,
    customerId: q.customerId,
    accountId: account,
    // العرض المربوط بمشروع تصير فاتورته مربوطة به، وإلا بقي إيراد المشروع صفرًا.
    projectId: q.projectId ?? null,
    subtotal: q.subtotal,
    discount: q.discount,
    tax: q.tax,
    total: q.total,
    paymentMethod: method,
    status: invoiceStatus,
    notes: q.notes,
    createdBy: await currentUserName(req),
    /**
     * فاتورة الكاشير تنتظر مراجعة الأدمن — كما في `POST /invoices`.
     *
     * بدون هذا السطر كان الكاشير يكتب عرضًا ويحوّله فتخرج الفاتورة معتمدة
     * تلقائيًا ولا تدخل طابور المراجعة، فتصير المراجعة كلها اسمًا بلا معنى.
     */
    approvalStatus: (req.session as any)?.role === "cashier" ? "pending" : "approved",
  }).returning();

  await db.insert(invoiceItemsTable).values(
    lines.map((l) => ({
      invoiceId: invoice.id,
      productId: l.productId,
      productName: l.productName,
      barcode: l.barcode,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      costPrice: l.costPrice,
      discount: l.discount,
      total: l.total,
    }))
  );

  // كل سطر صار له منتج — المُنشأ حديثًا مخزونه الابتدائي = الكمية، فينزل هنا إلى صفر.
  for (const l of lines) {
    await db
      .update(productsTable)
      .set({ stock: sql`${productsTable.stock} - ${l.quantity}` })
      .where(eq(productsTable.id, l.productId));
  }

  // النقدية تدخل الخزنة عند "مدفوعة" فقط، والآجل دَين لا نقد.
  const total = Number(q.total);
  if (invoiceStatus === "paid" && account && method !== "credit" && total > 0) {
    await db.insert(accountTransactionsTable).values({
      accountId: account,
      direction: "in",
      amount: String(total),
      description: `فاتورة مبيعات رقم ${invoiceNumber} (من عرض ${q.quotationNumber})`,
      category: "مبيعات",
      date: new Date().toISOString().slice(0, 10),
      reference: `invoice:${invoice.id}`,
    });
  }

  return res.json({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    createdProducts,
  });
});

export default router;
