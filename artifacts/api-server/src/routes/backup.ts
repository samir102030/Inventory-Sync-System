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

export default router;
