import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, customersTable, productsTable, invoiceSettingsTable, invoiceReturnsTable, invoiceReturnItemsTable, accountTransactionsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { nextDocumentNumber } from "../lib/document-number";

const router = Router();

function formatInvoice(inv: any, customerName?: string | null, customerWhatsapp?: string | null) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerId: inv.customerId ?? null,
    customerName: customerName ?? null,
    customerWhatsapp: customerWhatsapp ?? null,
    accountId: inv.accountId ?? null,
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    tax: Number(inv.tax),
    total: Number(inv.total),
    paymentMethod: inv.paymentMethod,
    status: inv.status,
    isTaxable: Number(inv.isTaxable ?? 0),
    notes: inv.notes ?? null,
    createdBy: inv.createdBy ?? null,
    approvalStatus: inv.approvalStatus ?? "approved",
    approvedBy: inv.approvedBy ?? null,
    approvedAt: inv.approvedAt instanceof Date ? inv.approvedAt.toISOString() : (inv.approvedAt ?? null),
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
  };
}

async function generateInvoiceNumber() {
  const settings = await db.select().from(invoiceSettingsTable).limit(1);
  const prefix = settings[0]?.invoicePrefix ?? "INV";
  return nextDocumentNumber("invoices", "invoice_number", prefix);
}

async function generateReturnNumber(_invoiceNumber: string) {
  return nextDocumentNumber("invoice_returns", "return_number", "RET");
}

router.get("/invoices/tax-ledger", async (req, res) => {
  const { from, to } = req.query;
  const conditions = [sql`${invoicesTable.tax}::numeric > 0`];
  if (from) conditions.push(gte(sql`${invoicesTable.createdAt}::date`, sql`${String(from)}::date`));
  if (to) conditions.push(lte(sql`${invoicesTable.createdAt}::date`, sql`${String(to)}::date`));

  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerName: customersTable.name,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(and(...conditions))
    .orderBy(sql`${invoicesTable.createdAt} DESC`);

  const invoices = rows.map(r => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    customerName: r.customerName ?? null,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    tax: Number(r.tax),
    total: Number(r.total),
    paymentMethod: r.paymentMethod,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    taxRate: Number(r.subtotal) > 0 ? Math.round((Number(r.tax) / Number(r.subtotal)) * 100) : 0,
  }));

  const totalTax = invoices.reduce((s, r) => s + r.tax, 0);
  const totalSubtotal = invoices.reduce((s, r) => s + r.subtotal, 0);
  const totalAmount = invoices.reduce((s, r) => s + r.total, 0);

  return res.json({ invoices, totalTax, totalSubtotal, totalAmount, count: invoices.length });
});

router.get("/invoices", async (req, res) => {
  const { startDate, endDate, customerId, status } = req.query;
  const conditions = [];
  if (startDate) conditions.push(gte(sql`${invoicesTable.createdAt}::date`, sql`${String(startDate)}::date`));
  if (endDate) conditions.push(lte(sql`${invoicesTable.createdAt}::date`, sql`${String(endDate)}::date`));
  if (customerId) conditions.push(eq(invoicesTable.customerId, Number(customerId)));
  if (status) conditions.push(eq(invoicesTable.status, String(status)));
  // ‏?approval=pending تستخدمه صفحة المراجعة.
  if (req.query.approval) {
    conditions.push(eq(invoicesTable.approvalStatus, String(req.query.approval)));
  }

  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      customerWhatsapp: customersTable.whatsapp,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      status: invoicesTable.status,
      notes: invoicesTable.notes,
      createdBy: invoicesTable.createdBy,
      approvalStatus: invoicesTable.approvalStatus,
      approvedBy: invoicesTable.approvedBy,
      approvedAt: invoicesTable.approvedAt,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${invoicesTable.createdAt} DESC`);

  return res.json(rows.map(r => formatInvoice(r, r.customerName, r.customerWhatsapp)));
});

router.post("/invoices", async (req, res) => {
  const { customerId, accountId, items, discount, tax, paymentMethod, status, notes, isTaxable } = req.body;
  if (!items?.length || !paymentMethod) return res.status(400).json({ error: "items and paymentMethod required" });
  if (paymentMethod === "credit" && !customerId) return res.status(400).json({ error: "customerId is required for credit sales" });

  const invoiceNumber = await generateInvoiceNumber();

  // كان الاستعلام هنا يُنفَّذ ونتيجته تُهمَل، فيبقى `created_by` فارغًا دائمًا.
  const userId = (req.session as any)?.userId;
  let createdBy: string | null = null;
  if (userId) {
    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    createdBy = user?.name ?? null;
  }

  let subtotal = 0;
  const resolvedItems: Array<{ productId: number; productName: string; barcode: string | null; quantity: number; unitPrice: number; costPrice: number; discount: number; total: number }> = [];

  for (const item of items) {
    const products = await db.select().from(productsTable).where(eq(productsTable.id, Number(item.productId))).limit(1);
    const product = products[0];
    if (!product) return res.status(400).json({ error: `Product ${item.productId} not found` });
    const qty = Number(item.quantity);
    const price = Number(item.unitPrice);
    const cost = Number(product.costPrice ?? 0);
    const itemDiscount = Number(item.discount ?? 0);
    const itemTotal = qty * price - itemDiscount;
    subtotal += itemTotal;
    resolvedItems.push({ productId: product.id, productName: product.name, barcode: product.barcode ?? null, quantity: qty, unitPrice: price, costPrice: cost, discount: itemDiscount, total: itemTotal });
  }

  const discountAmt = Number(discount ?? 0);
  const taxAmt = Number(tax ?? 0);
  const total = subtotal - discountAmt + taxAmt;

  const [inv] = await db.insert(invoicesTable).values({
    invoiceNumber,
    customerId: customerId ? Number(customerId) : null,
    accountId: accountId ? Number(accountId) : null,
    subtotal: String(subtotal),
    discount: String(discountAmt),
    tax: String(taxAmt),
    total: String(total),
    paymentMethod,
    status: status ?? "paid",
    notes,
    createdBy,
    // فاتورة الكاشير تنتظر مراجعة الأدمن؛ وما ينشئه الأدمن معتمد بحكم من أنشأه.
    approvalStatus: (req.session as any)?.role === "cashier" ? "pending" : "approved",
  }).returning();

  for (const item of resolvedItems) {
    await db.insert(invoiceItemsTable).values({
      invoiceId: inv.id,
      productId: item.productId,
      productName: item.productName,
      barcode: item.barcode,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      costPrice: String(item.costPrice),
      discount: String(item.discount),
      total: String(item.total),
    });
    await db.update(productsTable).set({ stock: sql`${productsTable.stock} - ${item.quantity}` }).where(eq(productsTable.id, item.productId));
  }

  if (accountId && paymentMethod !== "credit" && (inv.status === "paid" || !status) && total > 0) {
    await db.insert(accountTransactionsTable).values({
      accountId: Number(accountId),
      direction: "in",
      amount: String(total),
      description: `فاتورة مبيعات رقم ${invoiceNumber}`,
      category: "مبيعات",
      date: new Date().toISOString().slice(0, 10),
      reference: `invoice:${inv.id}`,
    });
  }

  let customerName = null;
  let customerWhatsapp = null;
  if (customerId) {
    const custs = await db.select().from(customersTable).where(eq(customersTable.id, Number(customerId))).limit(1);
    customerName = custs[0]?.name ?? null;
    customerWhatsapp = custs[0]?.whatsapp ?? null;
  }

  return res.status(201).json(formatInvoice(inv, customerName, customerWhatsapp));
});

router.get("/invoices/:id", async (req, res) => {
  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      customerWhatsapp: customersTable.whatsapp,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      status: invoicesTable.status,
      notes: invoicesTable.notes,
      createdBy: invoicesTable.createdBy,
      approvalStatus: invoicesTable.approvalStatus,
      approvedBy: invoicesTable.approvedBy,
      approvedAt: invoicesTable.approvedAt,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(eq(invoicesTable.id, Number(req.params.id))).limit(1);

  if (!rows[0]) return res.status(404).json({ error: "Not found" });

  const itemRows = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, Number(req.params.id)));

  const items = itemRows.map(i => ({
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    barcode: i.barcode ?? null,
    quantity: Number(i.quantity),
    unitPrice: Number(i.unitPrice),
    costPrice: Number(i.costPrice ?? 0),
    discount: Number(i.discount),
    total: Number(i.total),
  }));

  return res.json({ ...formatInvoice(rows[0], rows[0].customerName, rows[0].customerWhatsapp), items });
});

/**
 * ما تمسكه الفاتورة من كل منتج الآن.
 *
 * لا "ما بِيع فيها" ولا "ما حدث لها": كم قطعةً من كل صنف ما زالت خارج
 * الرصيد بسببها في هذه اللحظة. الملغاة تمسك صفرًا، وما أُرجع منها عاد
 * فلا يُحسب، والسطر بلا منتج لا مخزون له.
 *
 * هذه الدالة هي كل ما تحتاجه الحركة: يكفي حساب المسكة قبل التعديل وبعده
 * وتحريك الفرق. الإلغاء والإرجاع من الإلغاء وتعديل الكميات وحذف سطر —
 * كلها حالة واحدة من هذه القاعدة، بدل فرعٍ لكل حدث يُنسى أحدها فيه.
 */
function invoiceFootprint(
  lines: Array<{ productId: number | null; quantity: number }>,
  returnedByProductId: Map<number, number>,
  status: string,
): Map<number, number> {
  const held = new Map<number, number>();
  if (status === "cancelled") return held;

  for (const line of lines) {
    if (line.productId == null) continue;
    held.set(line.productId, (held.get(line.productId) ?? 0) + line.quantity);
  }
  for (const [productId, qty] of returnedByProductId) {
    if (!held.has(productId)) continue;
    held.set(productId, held.get(productId)! - qty);
  }
  for (const [productId, qty] of held) {
    if (qty <= 0) held.delete(productId);
  }
  return held;
}

/**
 * حركات الخزنة تُبنى من حال الفاتورة الآن، لا تُرقَّع بما جرى لها.
 *
 * ثلاثة أعطال كانت في الترقيع: الإلغاء يمحو حركة الدخول ويترك حركات
 * المرتجع خارجةً — فالخزنة تخسر قيمة الرد بلا بيعةٍ تقابلها؛ ونزول الحالة
 * من "مدفوعة" إلى "مسودة" يترك الدخول قائمًا فتظل الخزنة تعدّ نقدًا لفاتورة
 * لم تُقبض؛ وإحياء فاتورة قديمة كان يؤرّخ دخلها باليوم، فيقع في شهرٍ
 * والتقارير تقرؤه في شهر آخر لأنها تؤرّخ بتاريخ إنشاء الفاتورة.
 *
 * البناء من جديد يجعل الحالات الثلاث حالةً واحدة، والتواريخ تبقى تواريخها.
 */
async function reconcileInvoiceLedger(inv: {
  id: number;
  invoiceNumber: string;
  accountId: number | null;
  paymentMethod: string;
  status: string;
  createdAt: Date | string;
  total: number;
}) {
  const returns = await db.select().from(invoiceReturnsTable).where(eq(invoiceReturnsTable.invoiceId, inv.id));

  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `invoice:${inv.id}`));
  for (const ret of returns) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `invoice-return:${ret.id}`));
  }

  if (inv.status === "cancelled") return;
  if (!inv.accountId || inv.paymentMethod === "credit") return;

  // النقد يدخل حين تُقبض الفاتورة. المسودة لم تُقبض بعد.
  const cashReceived = inv.status === "paid" || inv.status === "partial_return" || inv.status === "returned";
  if (!cashReceived) return;

  const asDate = (value: Date | string) =>
    (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);

  if (inv.total > 0) {
    await db.insert(accountTransactionsTable).values({
      accountId: inv.accountId,
      direction: "in",
      amount: String(inv.total),
      description: `فاتورة مبيعات رقم ${inv.invoiceNumber}`,
      category: "مبيعات",
      date: asDate(inv.createdAt),
      reference: `invoice:${inv.id}`,
    });
  }

  for (const ret of returns) {
    if (Number(ret.total) <= 0) continue;
    await db.insert(accountTransactionsTable).values({
      accountId: inv.accountId,
      direction: "out",
      amount: String(Number(ret.total)),
      description: `مرتجع فاتورة رقم ${inv.invoiceNumber} (${ret.returnNumber})`,
      category: "مرتجعات",
      date: asDate(ret.createdAt),
      reference: `invoice-return:${ret.id}`,
    });
  }
}

/**
 * تعديل فاتورة — بنودها وحالتها وكل ما فيها.
 *
 * لا حالة تُمنع: الملغاة تُعدَّل وتُحيا، والمدفوعة يُعاد كتابة بنودها. ما
 * كان يمنع ذلك ليس قاعدةً محاسبية بل غياب الحساب: كان المسار لا يمس
 * البنود إطلاقًا، ولا يعيد حساب المجموع الفرعي، ويحرّك المخزون بفرعٍ واحد
 * للإلغاء بلا عكسٍ له.
 *
 * ⚠️ الترتيب مقصود: كل تحقق يسبق كل كتابة. الرد المقصود بـ 4xx لا يُرجع
 * معاملة الطلب، فما يُكتب قبله يبقى.
 */
router.patch("/invoices/:id", async (req, res) => {
  const { status, notes, discount, tax, paymentMethod, customerId, accountId, items } = req.body;
  const id = Number(req.params.id);

  const invRows = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
  if (!invRows[0]) return res.status(404).json({ error: "الفاتورة غير موجودة." });
  const inv = invRows[0];

  const oldRows = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  const returned = await returnedByProduct(id);

  type ResolvedLine = {
    productId: number | null;
    productName: string;
    barcode: string | null;
    quantity: number;
    unitPrice: number;
    costPrice: string;
    discount: number;
    total: number;
  };

  const oldLines: ResolvedLine[] = oldRows.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    barcode: r.barcode ?? null,
    quantity: Number(r.quantity),
    unitPrice: Number(r.unitPrice),
    costPrice: String(r.costPrice ?? 0),
    discount: Number(r.discount ?? 0),
    total: Number(r.total),
  }));

  // ── تحقق: البنود الواردة، بلا كتابة ──────────────────────────────────────
  let newLines: ResolvedLine[] | null = null;

  if (items !== undefined) {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "الفاتورة لا تكون بلا بنود.", code: "EMPTY_INVOICE" });
    }

    newLines = [];
    for (const raw of items) {
      const quantity = Number(raw?.quantity);
      const unitPrice = Number(raw?.unitPrice);
      const lineDiscount = Number(raw?.discount ?? 0) || 0;

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ error: `كمية غير صالحة في البند "${raw?.productName ?? ""}".`, code: "BAD_QUANTITY" });
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({ error: `سعر غير صالح في البند "${raw?.productName ?? ""}".`, code: "BAD_PRICE" });
      }

      const productId = raw?.productId != null && raw.productId !== "" ? Number(raw.productId) : null;
      const existing = raw?.id != null ? oldRows.find((o) => o.id === Number(raw.id)) : undefined;

      let productName = String(raw?.productName ?? "").trim();
      let barcode: string | null = null;
      /**
       * سعر التكلفة لقطة وقت البيع لا سعر اليوم: السطر القائم يحتفظ بتكلفته
       * الأصلية ما دام منتجه هو هو، والسطر الجديد يأخذ تكلفة منتجه الآن.
       * غير ذلك يُعاد كتابة ربح فواتير قديمة كلما تغيّرت تكلفة صنف.
       */
      let costPrice = "0";

      if (productId != null) {
        const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
        if (!product) {
          return res.status(400).json({ error: `المنتج المختار في البند "${productName}" غير موجود.`, code: "PRODUCT_GONE" });
        }
        productName = productName || product.name;
        barcode = product.barcode ?? null;
        costPrice = existing && existing.productId === productId ? String(existing.costPrice ?? 0) : String(product.costPrice ?? 0);
      } else {
        if (!productName) {
          return res.status(400).json({ error: "بندٌ بلا اسم ولا منتج.", code: "BAD_LINE" });
        }
        costPrice = existing ? String(existing.costPrice ?? 0) : "0";
      }

      newLines.push({
        productId,
        productName,
        barcode,
        quantity,
        unitPrice,
        costPrice,
        discount: lineDiscount,
        total: quantity * unitPrice - lineDiscount,
      });
    }
  }

  /**
   * إجمالي كمية الصنف في الفاتورة لا ينزل عمّا أُرجع منه.
   *
   * المرتجع يقول: خرجت هذه الكمية ثم عادت. فإن حُذف سطرها أو غُيّر صنفه،
   * صارت الفاتورة تدّعي أنها لم تُخرجها قط بينما الرد قد سُجّل ورُدّ إلى
   * الرصيد فعلًا. وحساب المسكة يقصّ السالب عند الصفر، فيبتلع التناقض بصمت
   * ويعيد إلى المخزون ما لا يزال في يد العميل.
   *
   * الفحص يدور على ما أُرجع لا على ما أُرسل: السطر المحذوف لا يزوره أحد.
   */
  if (newLines) {
    const submittedByProduct = new Map<number, number>();
    for (const line of newLines) {
      if (line.productId == null) continue;
      submittedByProduct.set(line.productId, (submittedByProduct.get(line.productId) ?? 0) + line.quantity);
    }

    for (const [productId, returnedQty] of returned) {
      const submitted = submittedByProduct.get(productId) ?? 0;
      if (submitted < returnedQty) {
        const name =
          oldRows.find((r) => r.productId === productId)?.productName ?? `#${productId}`;
        return res.status(409).json({
          error: `لا يمكن إنزال كمية "${name}" إلى ${submitted} — أُرجع منها ${returnedQty} من قبل. ألغِ المرتجع أولًا، أو أبقِ الكمية ${returnedQty} فأكثر.`,
          code: "LINES_BELOW_RETURNS",
          productName: name,
          returned: returnedQty,
          submitted,
        });
      }
    }
  }

  const effectiveLines = newLines ?? oldLines;
  const newStatus = status !== undefined ? String(status) : inv.status;
  const finalPaymentMethod = paymentMethod !== undefined ? String(paymentMethod) : inv.paymentMethod;
  const finalAccountId =
    accountId !== undefined ? (accountId ? Number(accountId) : null) : inv.accountId;

  // ── المال: المجموع الفرعي من البنود دائمًا، لا من الصف المحفوظ ───────────
  const newSubtotal = effectiveLines.reduce((sum, l) => sum + l.total, 0);
  const newDiscount = discount !== undefined ? Number(discount) : Number(inv.discount);

  /**
   * الخصم لا يتخطى قيمة ما فيه.
   *
   * كان الخصم يُقرأ كما هو ويُطرح من مجموعٍ صار المُعدِّل قادرًا على تصغيره:
   * بنود بـ100 وخصمٌ قديم بـ200 يعطيان إجماليًا سالبًا، ويصير على العميل
   * دَينٌ بالسالب في أرصدة الآجل. التحقق قبل أي كتابة.
   */
  if (newDiscount > newSubtotal) {
    return res.status(400).json({
      error: `الخصم ${newDiscount.toFixed(2)} ج.م أكبر من قيمة البنود ${newSubtotal.toFixed(2)} ج.م. عدّل الخصم أو البنود.`,
      code: "DISCOUNT_EXCEEDS_SUBTOTAL",
    });
  }

  /**
   * الضريبة مبلغ لا نسبة في هذا المخطط. فإن تغيّرت البنود ولم يرسل المُعدِّل
   * مبلغًا، حملنا النسبة السابقة على الأساس الجديد — تركُ المبلغ كما هو
   * يغيّر النسبة ضمنًا وبصمت، وهو أسوأ الاحتمالات في إقرار ضريبي.
   *
   * والأساس هو الصافي بعد الخصم لا المجموع الفرعي: هكذا تُحسب الضريبة في
   * هذا النظام أصلًا (`priceQuotation` في راوت عروض الأسعار)، والنسبة
   * المستخرجة من قسمةٍ على المجموع تكون أصغر من الحقيقية بقدر الخصم.
   */
  const priorNet = Number(inv.subtotal) - Number(inv.discount);
  const priorRate = priorNet > 0 ? Number(inv.tax) / priorNet : 0;
  const newTax =
    tax !== undefined
      ? Number(tax)
      : newLines
        ? Math.round((newSubtotal - newDiscount) * priorRate * 100) / 100
        : Number(inv.tax);

  const newTotal = newSubtotal - newDiscount + newTax;

  // ── المخزون: فرق المسكة قبل وبعد ────────────────────────────────────────
  const before = invoiceFootprint(oldLines, returned, inv.status);
  const after = invoiceFootprint(effectiveLines, returned, newStatus);

  const productIds = new Set<number>([...before.keys(), ...after.keys()]);
  const stockDeltas: Array<{ productId: number; delta: number }> = [];
  for (const productId of productIds) {
    // موجب ⇒ يخرج من الرصيد، سالب ⇒ يعود إليه.
    const delta = (after.get(productId) ?? 0) - (before.get(productId) ?? 0);
    if (delta !== 0) stockDeltas.push({ productId, delta });
  }

  // ── كتابة ───────────────────────────────────────────────────────────────
  const updates: Record<string, any> = {
    subtotal: String(newSubtotal),
    discount: String(newDiscount),
    tax: String(newTax),
    total: String(newTotal),
  };
  if (notes !== undefined) updates.notes = notes;
  if (paymentMethod !== undefined) updates.paymentMethod = finalPaymentMethod;
  if (customerId !== undefined) updates.customerId = customerId ? Number(customerId) : null;
  if (accountId !== undefined) updates.accountId = finalAccountId;
  if (status !== undefined) updates.status = newStatus;

  if (newLines) {
    await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    await db.insert(invoiceItemsTable).values(
      newLines.map((l) => ({
        invoiceId: id,
        productId: l.productId,
        productName: l.productName,
        barcode: l.barcode,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPrice),
        costPrice: l.costPrice,
        discount: String(l.discount),
        total: String(l.total),
      })),
    );
  }

  for (const { productId, delta } of stockDeltas) {
    await db
      .update(productsTable)
      .set({ stock: sql`${productsTable.stock} - ${delta}` })
      .where(eq(productsTable.id, productId));
  }

  const [updated] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, id)).returning();

  await reconcileInvoiceLedger({
    id: updated.id,
    invoiceNumber: updated.invoiceNumber,
    accountId: updated.accountId,
    paymentMethod: updated.paymentMethod,
    status: updated.status,
    createdAt: updated.createdAt,
    total: Number(updated.total),
  });

  let customerName = null;
  if (updated.customerId) {
    const custs = await db.select().from(customersTable).where(eq(customersTable.id, updated.customerId)).limit(1);
    customerName = custs[0]?.name ?? null;
  }
  return res.json(formatInvoice(updated, customerName));
});

/**
 * اعتماد فاتورة راجعها الأدمن.
 *
 * لا شيء يتحرك هنا: المخزون والخزينة تحرّكا لحظة البيع. هذه علامة تدقيق —
 * "رأيتها ووافقت" — واسم من وافق محفوظ معها.
 *
 * ممنوع على الكاشير في `require-auth.ts`؛ بدونه كان `POST /invoices/:id/approve`
 * يقع تحت سماحه بـ `POST /invoices` فيعتمد فواتير نفسه.
 */
router.post("/invoices/:id/approve", async (req, res) => {
  const userId = (req.session as any)?.userId;
  let approver: string | null = null;
  if (userId) {
    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
    approver = user?.name ?? null;
  }

  const [updated] = await db
    .update(invoicesTable)
    .set({ approvalStatus: "approved", approvedBy: approver, approvedAt: new Date() })
    .where(eq(invoicesTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "الفاتورة غير موجودة." });
  return res.json(formatInvoice(updated));
});

router.get("/invoices/:id/returns", async (req, res) => {
  const returns = await db
    .select()
    .from(invoiceReturnsTable)
    .where(eq(invoiceReturnsTable.invoiceId, Number(req.params.id)))
    .orderBy(sql`${invoiceReturnsTable.createdAt} DESC`);

  const result = [];
  for (const ret of returns) {
    const items = await db.select().from(invoiceReturnItemsTable).where(eq(invoiceReturnItemsTable.returnId, ret.id));
    result.push({
      ...ret,
      total: Number(ret.total),
      createdAt: ret.createdAt.toISOString(),
      items: items.map(i => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), total: Number(i.total) })),
    });
  }
  return res.json(result);
});

/**
 * ما أُرجع فعلًا من كل منتج في هذه الفاتورة، عبر كل مرتجعاتها.
 *
 * الكمية المتبقية للإرجاع ليست كمية البند، بل كميته ناقص ما رجع منه من قبل.
 * وبدون هذا الفرق كان المسار يقبل إرجاع البند كاملًا مرة بعد مرة — كل مرة
 * تضيف كميته إلى المخزون — فبضاعة تُباع مرة تُرَد ثلاثًا وتُخلق من العدم.
 */
async function returnedByProduct(invoiceId: number): Promise<Map<number, number>> {
  const rows = await db
    .select({
      productId: invoiceReturnItemsTable.productId,
      qty: sql<number>`COALESCE(SUM(${invoiceReturnItemsTable.quantity}::numeric), 0)`,
    })
    .from(invoiceReturnItemsTable)
    .innerJoin(invoiceReturnsTable, eq(invoiceReturnsTable.id, invoiceReturnItemsTable.returnId))
    .where(eq(invoiceReturnsTable.invoiceId, invoiceId))
    .groupBy(invoiceReturnItemsTable.productId);

  const map = new Map<number, number>();
  for (const r of rows) if (r.productId != null) map.set(r.productId, Number(r.qty));
  return map;
}

router.post("/invoices/:id/return", async (req, res) => {
  const { reason, items, accountId: overrideAccountId } = req.body;
  if (!items?.length) return res.status(400).json({ error: "items required" });

  const invRows = await db.select().from(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id))).limit(1);
  if (!invRows[0]) return res.status(404).json({ error: "Invoice not found" });
  const inv = invRows[0];

  const originalItems = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, inv.id));

  const alreadyReturned = await returnedByProduct(inv.id);

  /**
   * ما يمكن رده هو ما تمسكه الفاتورة الآن — لا "ما بِيع ناقص ما رُد".
   *
   * الفرق يظهر على الملغاة: مبيعها عشرة ومرتجعها صفر، فالحساب القديم يقبل
   * رد ثلاثة منها. المخزون لا يتحرك ساعتها (الملغاة تمسك صفرًا) فيبدو
   * الأمر سليمًا — حتى تُحيا الفاتورة، فتقرأ سطورها عشرة ناقص مرتجعًا
   * ثلاثة وتخصم سبعة، بينما العشرة كلها خرجت فعلًا. ثلاث قطع تُخلق من
   * العدم في اللحظة التي وُجدت هذه الميزة من أجلها.
   *
   * على المدفوعة والمرتجعة جزئيًا هذا الرقم مطابق للحساب القديم تمامًا.
   */
  const heldNow = invoiceFootprint(
    originalItems.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
    alreadyReturned,
    inv.status,
  );

  if (inv.status === "cancelled") {
    return res.status(409).json({
      error: "الفاتورة ملغاة — لا شيء منها في يد العميل ليُرد. أعِد تفعيلها أولًا إن كان البيع قائمًا.",
      code: "INVOICE_CANCELLED",
    });
  }
  /** ما يُطلب إرجاعه في هذا الطلب نفسه — منتج مكرر في الطلب لا يتخطى السقف مرتين. */
  const takenNow = new Map<number, number>();

  let returnTotal = 0;
  const returnItems: Array<{ productId: number; productName: string; quantity: number; unitPrice: number; total: number }> = [];

  for (const retItem of items) {
    const original = originalItems.find(o => o.productId != null && o.productId === Number(retItem.productId));
    if (!original) return res.status(400).json({ error: `Item not found in invoice` });
    // المرتجع حركة مخزون قبل أن يكون حركة مال: بندٌ بلا منتج لا يُرد.
    if (original.productId == null) {
      return res.status(400).json({
        error: `البند "${original.productName}" ليس منتجًا من المخزن، فلا يمكن إرجاعه.`,
        code: "ITEM_NOT_STOCKED",
      });
    }
    const qty = Number(retItem.quantity);
    if (qty <= 0) continue;

    const remaining = (heldNow.get(original.productId) ?? 0) - (takenNow.get(original.productId) ?? 0);

    if (qty > remaining) {
      return res.status(400).json({
        error:
          remaining <= 0
            ? `"${original.productName}" أُرجع بالكامل من قبل، فلا يبقى منه شيء للإرجاع.`
            : `لا يمكن إرجاع ${qty} من "${original.productName}" — المتبقي للإرجاع ${remaining} فقط.`,
        code: "RETURN_EXCEEDS_REMAINING",
        productName: original.productName,
        remaining: Math.max(0, remaining),
      });
    }

    takenNow.set(original.productId, (takenNow.get(original.productId) ?? 0) + qty);

    const price = Number(original.unitPrice);
    const itemTotal = qty * price;
    returnTotal += itemTotal;
    returnItems.push({ productId: original.productId, productName: original.productName, quantity: qty, unitPrice: price, total: itemTotal });
  }

  if (returnItems.length === 0) return res.status(400).json({ error: "No valid items to return" });

  const returnNumber = await generateReturnNumber(inv.invoiceNumber);

  const [ret] = await db.insert(invoiceReturnsTable).values({
    returnNumber,
    invoiceId: inv.id,
    reason: reason ?? null,
    total: String(returnTotal),
  }).returning();

  for (const item of returnItems) {
    await db.insert(invoiceReturnItemsTable).values({
      returnId: ret.id,
      productId: item.productId,
      productName: item.productName,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      total: String(item.total),
    });
    await db.update(productsTable).set({ stock: sql`${productsTable.stock} + ${item.quantity}` }).where(eq(productsTable.id, item.productId));
  }

  const allOriginalQty = originalItems.reduce((s, i) => s + Number(i.quantity), 0);
  const allReturnedQty = returnItems.reduce((s, i) => s + i.quantity, 0);
  const totalReturnedRows = await db.select({ cnt: sql<number>`COUNT(*)` }).from(invoiceReturnItemsTable)
    .innerJoin(invoiceReturnsTable, eq(invoiceReturnsTable.id, invoiceReturnItemsTable.returnId))
    .where(eq(invoiceReturnsTable.invoiceId, inv.id));
  const totalReturnedQtyRows = await db.select({ total: sql<number>`SUM(${invoiceReturnItemsTable.quantity}::numeric)` })
    .from(invoiceReturnItemsTable)
    .innerJoin(invoiceReturnsTable, eq(invoiceReturnsTable.id, invoiceReturnItemsTable.returnId))
    .where(eq(invoiceReturnsTable.invoiceId, inv.id));
  const totalReturnedQty = Number(totalReturnedQtyRows[0]?.total ?? 0);

  const newStatus = totalReturnedQty >= allOriginalQty ? "returned" : "partial_return";
  await db.update(invoicesTable).set({ status: newStatus }).where(eq(invoicesTable.id, inv.id));

  const effectiveAccountId = overrideAccountId && overrideAccountId !== "none" ? Number(overrideAccountId) : inv.accountId;
  if (effectiveAccountId) {
    await db.insert(accountTransactionsTable).values({
      accountId: effectiveAccountId,
      direction: "out",
      amount: String(returnTotal),
      description: `مرتجع فاتورة رقم ${inv.invoiceNumber} (${returnNumber})`,
      category: "مرتجعات",
      date: new Date().toISOString().slice(0, 10),
      reference: `invoice-return:${ret.id}`,
    });
  }

  return res.status(201).json({
    ...ret,
    total: Number(ret.total),
    createdAt: ret.createdAt.toISOString(),
    items: returnItems,
  });
});

/**
 * حذف فاتورة يعيد إلى المخزون ما لا تزال تمسكه.
 *
 * كان الحذف يمحو الفاتورة وسطورها ولا يمس المخزون إطلاقًا، بينما الإلغاء
 * يرده. فبضاعة فاتورة محذوفة تختفي من الرصيد بلا أثر يفسرها — والفرق بين
 * زرين متجاورين كان الفرق بين رصيد صحيح ورصيد ناقص إلى الأبد.
 *
 * "ما تمسكه" لا "ما بِيع فيها": الملغاة ردت مخزونها فلا تمسك شيئًا، وما
 * أُرجع منها رُد بالفعل فلا يُرد مرتين. والسطر بلا منتج لا مخزون له.
 *
 * ومرتجعاتها تُحذف قبلها: `invoice_returns.invoice_id` بلا `cascade`، فكان
 * حذف فاتورة عليها مرتجع يسقط على مخالفة مفتاح أجنبي بعد أن يكون قد محا
 * حركات خزنتها.
 */
router.delete("/invoices/:id", async (req, res) => {
  const id = Number(req.params.id);

  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
  if (!inv) return res.status(404).json({ error: "الفاتورة غير موجودة." });

  if (inv.status !== "cancelled") {
    const lines = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    const returned = await returnedByProduct(id);

    const held = new Map<number, number>();
    for (const line of lines) {
      if (line.productId == null) continue;
      held.set(line.productId, (held.get(line.productId) ?? 0) + Number(line.quantity));
    }
    for (const [productId, qty] of returned) {
      held.set(productId, (held.get(productId) ?? 0) - qty);
    }

    for (const [productId, qty] of held) {
      if (qty <= 0) continue;
      await db
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} + ${qty}` })
        .where(eq(productsTable.id, productId));
    }
  }

  const returns = await db.select().from(invoiceReturnsTable).where(eq(invoiceReturnsTable.invoiceId, id));
  for (const ret of returns) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `invoice-return:${ret.id}`));
  }
  // بنود المرتجع تسقط مع مرتجعها بـ cascade؛ المرتجع نفسه لا يسقط مع الفاتورة.
  await db.delete(invoiceReturnsTable).where(eq(invoiceReturnsTable.invoiceId, id));

  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `invoice:${id}`));
  await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  return res.json({ ok: true });
});

export default router;
