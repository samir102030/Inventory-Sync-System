import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable, categoriesTable, customersTable, suppliersTable,
  invoicesTable, invoiceItemsTable, invoiceReturnsTable, invoiceReturnItemsTable,
  expensesTable, licensesTable, quotationsTable, quotationItemsTable,
  purchasesTable, purchaseItemsTable, accountsTable, accountTransactionsTable,
  receiptVouchersTable, paymentVouchersTable, employeesTable, salaryPaymentsTable,
  warehousesTable, warehouseStockTable, warehouseTransfersTable, warehouseTransferItemsTable,
  projectsTable, usersTable, invoiceSettingsTable,
} from "@workspace/db";
import { getTableColumns, sql } from "drizzle-orm";

const router = Router();

/**
 * النسخ الاحتياطي — بيانات شركة واحدة.
 *
 * القراءة والحذف والإدراج كلها تمر بسياسات RLS، فما يُصدَّر وما يُمسح هو
 * صفوف الشركة الفعّالة وحدها. لهذا لا يوجد هنا أي `WHERE company_id = ...`:
 * الفلترة في قاعدة البيانات لا في هذا الملف.
 *
 * ⚠️ TRUNCATE ممنوع هنا. TRUNCATE لا يخضع لـ RLS إطلاقًا — كان أدمن أي شركة
 * يستطيع بضغطة "إعادة تعيين" أن يمسح بيانات كل الشركات. DELETE يخضع لها.
 */

/* ─── الترتيب الآمن للحذف: الأبناء أولًا ─── */
const DELETE_ORDER = [
  "warehouse_transfer_items", "warehouse_transfers", "warehouse_stock", "warehouses",
  "invoice_return_items", "invoice_returns", "invoice_items", "invoices",
  "quotation_items", "quotations", "purchase_items", "purchases",
  "account_transactions", "receipt_vouchers", "payment_vouchers",
  "salary_payments", "employees", "expenses", "licenses", "projects",
  "products", "categories", "customers", "suppliers", "accounts",
];

async function wipeCompanyData() {
  for (const table of DELETE_ORDER) {
    await db.execute(sql.raw(`DELETE FROM "${table}"`));
  }
}

/* ─── FULL BACKUP ─── */
router.get("/backup/export", async (_req, res) => {
  const [
    products, categories, customers, suppliers,
    invoices, invoiceItems, invoiceReturns, invoiceReturnItems,
    expenses, licenses, quotations, quotationItems,
    purchases, purchaseItems, accounts, accountTransactions,
    receiptVouchers, paymentVouchers, employees, salaryPayments,
    warehouses, warehouseStock, warehouseTransfers, warehouseTransferItems,
    projects, users, invoiceSettings,
  ] = await Promise.all([
    db.select().from(productsTable),
    db.select().from(categoriesTable),
    db.select().from(customersTable),
    db.select().from(suppliersTable),
    db.select().from(invoicesTable),
    db.select().from(invoiceItemsTable),
    db.select().from(invoiceReturnsTable),
    db.select().from(invoiceReturnItemsTable),
    db.select().from(expensesTable),
    db.select().from(licensesTable),
    db.select().from(quotationsTable),
    db.select().from(quotationItemsTable),
    db.select().from(purchasesTable),
    db.select().from(purchaseItemsTable),
    db.select().from(accountsTable),
    db.select().from(accountTransactionsTable),
    db.select().from(receiptVouchersTable),
    db.select().from(paymentVouchersTable),
    db.select().from(employeesTable),
    db.select().from(salaryPaymentsTable),
    db.select().from(warehousesTable),
    db.select().from(warehouseStockTable),
    db.select().from(warehouseTransfersTable),
    db.select().from(warehouseTransferItemsTable),
    db.select().from(projectsTable),
    db.select({ id: usersTable.id, username: usersTable.username, name: usersTable.name, role: usersTable.role, status: usersTable.status, email: usersTable.email, phone: usersTable.phone, createdAt: usersTable.createdAt }).from(usersTable),
    db.select().from(invoiceSettingsTable),
  ]);

  const serialize = (rows: any[]) =>
    rows.map(r => {
      const out: any = {};
      for (const [k, v] of Object.entries(r)) {
        if (v instanceof Date) out[k] = v.toISOString();
        else out[k] = v;
      }
      return out;
    });

  return res.json({
    version: 3,
    exportedAt: new Date().toISOString(),
    products: serialize(products),
    categories: serialize(categories),
    customers: serialize(customers),
    suppliers: serialize(suppliers),
    invoices: serialize(invoices),
    invoiceItems: serialize(invoiceItems),
    invoiceReturns: serialize(invoiceReturns),
    invoiceReturnItems: serialize(invoiceReturnItems),
    expenses: serialize(expenses),
    licenses: serialize(licenses),
    quotations: serialize(quotations),
    quotationItems: serialize(quotationItems),
    purchases: serialize(purchases),
    purchaseItems: serialize(purchaseItems),
    accounts: serialize(accounts),
    accountTransactions: serialize(accountTransactions),
    receiptVouchers: serialize(receiptVouchers),
    paymentVouchers: serialize(paymentVouchers),
    employees: serialize(employees),
    salaryPayments: serialize(salaryPayments),
    warehouses: serialize(warehouses),
    warehouseStock: serialize(warehouseStock),
    warehouseTransfers: serialize(warehouseTransfers),
    warehouseTransferItems: serialize(warehouseTransferItems),
    projects: serialize(projects),
    users: serialize(users),
    invoiceSettings: serialize(invoiceSettings),
  });
});

/* ─── FULL RESET ─── */
router.post("/backup/reset", async (_req, res) => {
  await wipeCompanyData();
  return res.json({ ok: true });
});

/* ─── RESTORE FROM BACKUP ─── */

/**
 * الأرقام التسلسلية (`id`) مشتركة بين كل الشركات، فرقم 5 عند شركة يخص صفًا
 * آخر تمامًا عند شركة ثانية. لذلك لا تُعاد الصفوف بأرقامها القديمة، بل
 * تُدرَج بأرقام جديدة ويُترجم كل مرجع من الرقم القديم إلى الجديد.
 *
 * قبل هذا كانت الاستعادة تُدرج الأرقام كما هي مع `onConflictDoNothing`، فأي
 * تصادم مع شركة أخرى كان يُسقط الصف بصمت وينتج نسخة ناقصة دون أي رسالة.
 */
type Restorable = {
  key: string;
  table: any;
  /** اسم الحقل في النسخة ⇒ الجدول الذي يشير إليه. */
  refs?: Record<string, string>;
};

const RESTORE_ORDER: Restorable[] = [
  { key: "categories", table: categoriesTable },
  { key: "suppliers", table: suppliersTable },
  { key: "customers", table: customersTable },
  { key: "warehouses", table: warehousesTable },
  { key: "accounts", table: accountsTable },
  { key: "employees", table: employeesTable },
  { key: "projects", table: projectsTable, refs: { customerId: "customers" } },
  { key: "products", table: productsTable, refs: { categoryId: "categories" } },
  {
    key: "invoices",
    table: invoicesTable,
    refs: { customerId: "customers", accountId: "accounts", projectId: "projects" },
  },
  {
    key: "invoiceItems",
    table: invoiceItemsTable,
    refs: { invoiceId: "invoices", productId: "products" },
  },
  { key: "invoiceReturns", table: invoiceReturnsTable, refs: { invoiceId: "invoices" } },
  {
    key: "invoiceReturnItems",
    table: invoiceReturnItemsTable,
    refs: { returnId: "invoiceReturns", productId: "products" },
  },
  {
    key: "quotations",
    table: quotationsTable,
    refs: { customerId: "customers", projectId: "projects" },
  },
  {
    key: "quotationItems",
    table: quotationItemsTable,
    refs: { quotationId: "quotations", productId: "products" },
  },
  {
    key: "purchases",
    table: purchasesTable,
    refs: { supplierId: "suppliers", accountId: "accounts" },
  },
  {
    key: "purchaseItems",
    table: purchaseItemsTable,
    refs: { purchaseId: "purchases", productId: "products" },
  },
  { key: "accountTransactions", table: accountTransactionsTable, refs: { accountId: "accounts" } },
  {
    key: "receiptVouchers",
    table: receiptVouchersTable,
    refs: { accountId: "accounts", customerId: "customers" },
  },
  {
    key: "paymentVouchers",
    table: paymentVouchersTable,
    refs: { accountId: "accounts", supplierId: "suppliers" },
  },
  {
    key: "salaryPayments",
    table: salaryPaymentsTable,
    refs: { employeeId: "employees", accountId: "accounts" },
  },
  {
    key: "warehouseStock",
    table: warehouseStockTable,
    refs: { warehouseId: "warehouses", productId: "products" },
  },
  {
    key: "warehouseTransfers",
    table: warehouseTransfersTable,
    refs: { fromWarehouseId: "warehouses", toWarehouseId: "warehouses" },
  },
  {
    key: "warehouseTransferItems",
    table: warehouseTransferItemsTable,
    refs: { transferId: "warehouseTransfers", productId: "products" },
  },
  { key: "expenses", table: expensesTable, refs: { accountId: "accounts", projectId: "projects" } },
  { key: "licenses", table: licensesTable },
];

/**
 * JSON لا يعرف التواريخ: `createdAt` يعود نصًّا بينما ينتظر Drizzle كائن
 * `Date` ويستدعي عليه `toISOString`. كانت الاستعادة تسقط بـ 500 بسبب هذا.
 */
function reviveDates(table: any, row: Record<string, any>) {
  for (const [key, column] of Object.entries(getTableColumns(table) as any)) {
    const value = row[key];
    if ((column as any).dataType === "date" && typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) row[key] = parsed;
    }
  }
  return row;
}

router.post("/backup/restore", async (req, res) => {
  const data = req.body;
  if (!data || !data.exportedAt) {
    return res.status(400).json({ error: "ملف النسخة الاحتياطية غير صالح" });
  }

  await wipeCompanyData();

  /** الرقم القديم ⇒ الرقم الجديد، لكل جدول. */
  const idMap: Record<string, Map<number, number>> = {};

  for (const { key, table, refs } of RESTORE_ORDER) {
    const rows: any[] = data[key] ?? [];
    idMap[key] = new Map();
    if (rows.length === 0) continue;

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);

      const values = batch.map((row) => {
        // company_id يأتي من نطاق الطلب لا من الملف: نسخة شركة لا تُستعاد
        // داخل شركة أخرى ولو حُرِّر الملف يدويًا.
        const { id: _id, companyId: _companyId, ...rest } = row;

        for (const [field, parent] of Object.entries(refs ?? {})) {
          const old = rest[field];
          rest[field] = old == null ? null : idMap[parent]?.get(Number(old)) ?? null;
        }

        return reviveDates(table, rest);
      });

      const inserted = await db.insert(table).values(values).returning({ id: table.id });

      inserted.forEach((newRow: { id: number }, index: number) => {
        const oldId = batch[index]?.id;
        if (oldId != null) idMap[key].set(Number(oldId), newRow.id);
      });
    }
  }

  return res.json({ ok: true });
});

export default router;
