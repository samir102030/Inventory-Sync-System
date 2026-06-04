import { Router } from "express";
import { db, productsTable, customersTable, invoicesTable, invoiceItemsTable, expensesTable, licensesTable, categoriesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/backup/export", async (_req, res) => {
  const products = await db
    .select({ id: productsTable.id, name: productsTable.name, description: productsTable.description, price: productsTable.price, costPrice: productsTable.costPrice, categoryId: productsTable.categoryId, categoryName: categoriesTable.name, stock: productsTable.stock, minStock: productsTable.minStock, barcode: productsTable.barcode, unit: productsTable.unit, createdAt: productsTable.createdAt })
    .from(productsTable).leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id));

  const customers = await db.select().from(customersTable);

  const invoices = await db
    .select({ id: invoicesTable.id, invoiceNumber: invoicesTable.invoiceNumber, customerId: invoicesTable.customerId, customerName: customersTable.name, subtotal: invoicesTable.subtotal, discount: invoicesTable.discount, tax: invoicesTable.tax, total: invoicesTable.total, paymentMethod: invoicesTable.paymentMethod, status: invoicesTable.status, notes: invoicesTable.notes, createdBy: invoicesTable.createdBy, createdAt: invoicesTable.createdAt })
    .from(invoicesTable).leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id));

  const invoiceDetails = await Promise.all(invoices.map(async inv => {
    const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, inv.id));
    return {
      ...inv,
      subtotal: Number(inv.subtotal), discount: Number(inv.discount), tax: Number(inv.tax), total: Number(inv.total),
      createdAt: inv.createdAt.toISOString(),
      items: items.map(i => ({ id: i.id, productId: i.productId, productName: i.productName, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discount: Number(i.discount), total: Number(i.total) })),
    };
  }));

  const expenses = await db.select().from(expensesTable);
  const licenses = await db.select().from(licensesTable);

  return res.json({
    exportedAt: new Date().toISOString(),
    products: products.map(p => ({ ...p, price: Number(p.price), costPrice: p.costPrice != null ? Number(p.costPrice) : null, createdAt: p.createdAt.toISOString() })),
    customers: customers.map(c => ({ ...c, totalPurchases: null, createdAt: c.createdAt.toISOString() })),
    invoices: invoiceDetails,
    expenses: expenses.map(e => ({ ...e, amount: Number(e.amount), createdAt: e.createdAt.toISOString() })),
    licenses: licenses.map(l => ({ ...l, cost: l.cost != null ? Number(l.cost) : null, createdAt: l.createdAt.toISOString() })),
  });
});

export default router;
