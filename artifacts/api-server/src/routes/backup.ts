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
import { sql } from "drizzle-orm";

const router = Router();

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
    version: 2,
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
  // Delete in FK-safe order (children first)
  await db.execute(sql`
    TRUNCATE TABLE
      warehouse_transfer_items,
      warehouse_transfers,
      warehouse_stock,
      warehouses,
      invoice_return_items,
      invoice_returns,
      invoice_items,
      invoices,
      quotation_items,
      quotations,
      purchase_items,
      purchases,
      account_transactions,
      receipt_vouchers,
      payment_vouchers,
      salary_payments,
      employees,
      expenses,
      licenses,
      projects,
      products,
      categories,
      customers,
      suppliers,
      accounts
    RESTART IDENTITY CASCADE
  `);

  return res.json({ ok: true });
});

/* ─── RESTORE FROM BACKUP ─── */
router.post("/backup/restore", async (req, res) => {
  const data = req.body;
  if (!data || !data.exportedAt) {
    return res.status(400).json({ error: "ملف النسخة الاحتياطية غير صالح" });
  }

  const chunk = async (table: any, rows: any[]) => {
    if (!rows?.length) return;
    // insert in batches of 100 to avoid huge queries
    for (let i = 0; i < rows.length; i += 100) {
      await db.insert(table).values(rows.slice(i, i + 100)).onConflictDoNothing();
    }
  };

  // 1. Wipe everything first (same as reset)
  await db.execute(sql`
    TRUNCATE TABLE
      warehouse_transfer_items, warehouse_transfers, warehouse_stock, warehouses,
      invoice_return_items, invoice_returns, invoice_items, invoices,
      quotation_items, quotations, purchase_items, purchases,
      account_transactions, receipt_vouchers, payment_vouchers,
      salary_payments, employees, expenses, licenses, projects,
      products, categories, customers, suppliers, accounts
    RESTART IDENTITY CASCADE
  `);

  // 2. Restore in FK-safe order (parents first)
  await chunk(categoriesTable,           data.categories          ?? []);
  await chunk(suppliersTable,            data.suppliers           ?? []);
  await chunk(customersTable,            data.customers           ?? []);
  await chunk(warehousesTable,           data.warehouses          ?? []);
  await chunk(accountsTable,             data.accounts            ?? []);
  await chunk(employeesTable,            data.employees           ?? []);
  await chunk(productsTable,             data.products            ?? []);
  await chunk(invoicesTable,             data.invoices            ?? []);
  await chunk(invoiceItemsTable,         data.invoiceItems        ?? []);
  await chunk(invoiceReturnsTable,       data.invoiceReturns      ?? []);
  await chunk(invoiceReturnItemsTable,   data.invoiceReturnItems  ?? []);
  await chunk(quotationsTable,           data.quotations          ?? []);
  await chunk(quotationItemsTable,       data.quotationItems      ?? []);
  await chunk(purchasesTable,            data.purchases           ?? []);
  await chunk(purchaseItemsTable,        data.purchaseItems       ?? []);
  await chunk(accountTransactionsTable,  data.accountTransactions ?? []);
  await chunk(receiptVouchersTable,      data.receiptVouchers     ?? []);
  await chunk(paymentVouchersTable,      data.paymentVouchers     ?? []);
  await chunk(salaryPaymentsTable,       data.salaryPayments      ?? []);
  await chunk(warehouseStockTable,       data.warehouseStock      ?? []);
  await chunk(warehouseTransfersTable,   data.warehouseTransfers  ?? []);
  await chunk(warehouseTransferItemsTable, data.warehouseTransferItems ?? []);
  await chunk(expensesTable,             data.expenses            ?? []);
  await chunk(licensesTable,             data.licenses            ?? []);
  await chunk(projectsTable,             data.projects            ?? []);

  // 3. Reset all sequences to max(id) so future inserts don't collide
  await db.execute(sql`
    SELECT setval(pg_get_serial_sequence('categories',           'id'), COALESCE(MAX(id),1)) FROM categories;
    SELECT setval(pg_get_serial_sequence('suppliers',            'id'), COALESCE(MAX(id),1)) FROM suppliers;
    SELECT setval(pg_get_serial_sequence('customers',            'id'), COALESCE(MAX(id),1)) FROM customers;
    SELECT setval(pg_get_serial_sequence('warehouses',           'id'), COALESCE(MAX(id),1)) FROM warehouses;
    SELECT setval(pg_get_serial_sequence('accounts',             'id'), COALESCE(MAX(id),1)) FROM accounts;
    SELECT setval(pg_get_serial_sequence('employees',            'id'), COALESCE(MAX(id),1)) FROM employees;
    SELECT setval(pg_get_serial_sequence('products',             'id'), COALESCE(MAX(id),1)) FROM products;
    SELECT setval(pg_get_serial_sequence('invoices',             'id'), COALESCE(MAX(id),1)) FROM invoices;
    SELECT setval(pg_get_serial_sequence('invoice_items',        'id'), COALESCE(MAX(id),1)) FROM invoice_items;
    SELECT setval(pg_get_serial_sequence('invoice_returns',      'id'), COALESCE(MAX(id),1)) FROM invoice_returns;
    SELECT setval(pg_get_serial_sequence('invoice_return_items', 'id'), COALESCE(MAX(id),1)) FROM invoice_return_items;
    SELECT setval(pg_get_serial_sequence('quotations',           'id'), COALESCE(MAX(id),1)) FROM quotations;
    SELECT setval(pg_get_serial_sequence('quotation_items',      'id'), COALESCE(MAX(id),1)) FROM quotation_items;
    SELECT setval(pg_get_serial_sequence('purchases',            'id'), COALESCE(MAX(id),1)) FROM purchases;
    SELECT setval(pg_get_serial_sequence('purchase_items',       'id'), COALESCE(MAX(id),1)) FROM purchase_items;
    SELECT setval(pg_get_serial_sequence('account_transactions', 'id'), COALESCE(MAX(id),1)) FROM account_transactions;
    SELECT setval(pg_get_serial_sequence('receipt_vouchers',     'id'), COALESCE(MAX(id),1)) FROM receipt_vouchers;
    SELECT setval(pg_get_serial_sequence('payment_vouchers',     'id'), COALESCE(MAX(id),1)) FROM payment_vouchers;
    SELECT setval(pg_get_serial_sequence('salary_payments',      'id'), COALESCE(MAX(id),1)) FROM salary_payments;
    SELECT setval(pg_get_serial_sequence('expenses',             'id'), COALESCE(MAX(id),1)) FROM expenses;
    SELECT setval(pg_get_serial_sequence('licenses',             'id'), COALESCE(MAX(id),1)) FROM licenses;
    SELECT setval(pg_get_serial_sequence('projects',             'id'), COALESCE(MAX(id),1)) FROM projects;
  `);

  return res.json({ ok: true });
});

export default router;
