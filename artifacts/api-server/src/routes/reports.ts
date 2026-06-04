import { Router } from "express";
import { db, invoicesTable, invoiceItemsTable, expensesTable, productsTable, categoriesTable, customersTable, licensesTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

router.get("/reports/daily", async (req, res) => {
  const dateStr = req.query.date ? String(req.query.date) : new Date().toISOString().split("T")[0];

  const invoices = await db
    .select({ total: invoicesTable.total, paymentMethod: invoicesTable.paymentMethod })
    .from(invoicesTable)
    .where(and(
      eq(sql`${invoicesTable.createdAt}::date`, sql`${dateStr}::date`),
      eq(invoicesTable.status, "paid")
    ));

  const totalRevenue = invoices.reduce((s, i) => s + Number(i.total), 0);
  const invoiceCount = invoices.length;
  const paymentBreakdown = { cash: 0, card: 0, transfer: 0, credit: 0 };
  for (const inv of invoices) {
    const method = inv.paymentMethod as keyof typeof paymentBreakdown;
    if (method in paymentBreakdown) paymentBreakdown[method] += Number(inv.total);
  }

  const expenses = await db
    .select({ amount: expensesTable.amount })
    .from(expensesTable)
    .where(eq(expensesTable.date, dateStr));
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const topProductsRaw = await db
    .select({
      productId: invoiceItemsTable.productId,
      productName: invoiceItemsTable.productName,
      quantitySold: sql<number>`SUM(${invoiceItemsTable.quantity}::numeric)`,
      revenue: sql<number>`SUM(${invoiceItemsTable.total}::numeric)`,
    })
    .from(invoiceItemsTable)
    .innerJoin(invoicesTable, and(
      eq(invoiceItemsTable.invoiceId, invoicesTable.id),
      eq(sql`${invoicesTable.createdAt}::date`, sql`${dateStr}::date`),
      eq(invoicesTable.status, "paid")
    ))
    .groupBy(invoiceItemsTable.productId, invoiceItemsTable.productName)
    .orderBy(sql`SUM(${invoiceItemsTable.total}::numeric) DESC`)
    .limit(5);

  return res.json({
    date: dateStr,
    totalSales: totalRevenue,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    invoiceCount,
    paymentBreakdown,
    topProducts: topProductsRaw.map(p => ({
      productId: p.productId,
      productName: p.productName,
      quantitySold: Number(p.quantitySold),
      revenue: Number(p.revenue),
    })),
  });
});

router.get("/reports/summary", async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.substring(0, 7) + "-01";

  const todayInvoices = await db
    .select({ total: invoicesTable.total })
    .from(invoicesTable)
    .where(and(eq(sql`${invoicesTable.createdAt}::date`, sql`${today}::date`), eq(invoicesTable.status, "paid")));

  const todaySales = todayInvoices.length;
  const todayRevenue = todayInvoices.reduce((s, i) => s + Number(i.total), 0);

  const monthInvoices = await db
    .select({ total: invoicesTable.total })
    .from(invoicesTable)
    .where(and(gte(sql`${invoicesTable.createdAt}::date`, sql`${monthStart}::date`), eq(invoicesTable.status, "paid")));
  const monthRevenue = monthInvoices.reduce((s, i) => s + Number(i.total), 0);

  const [{ cnt: totalProducts }] = await db.select({ cnt: sql<number>`COUNT(*)` }).from(productsTable);
  const [{ cnt: totalCustomers }] = await db.select({ cnt: sql<number>`COUNT(*)` }).from(customersTable);

  const lowStock = await db.select({ cnt: sql<number>`COUNT(*)` }).from(productsTable).where(lte(productsTable.stock, productsTable.minStock));
  const lowStockCount = Number(lowStock[0]?.cnt ?? 0);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split("T")[0];

  const expiring = await db.select({ cnt: sql<number>`COUNT(*)` }).from(licensesTable)
    .where(and(eq(licensesTable.status, "active"), lte(licensesTable.expiryDate, thirtyDaysStr)));
  const expiringLicenses = Number(expiring[0]?.cnt ?? 0);

  const recentInvoices = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      subtotal: invoicesTable.subtotal,
      discount: invoicesTable.discount,
      tax: invoicesTable.tax,
      total: invoicesTable.total,
      paymentMethod: invoicesTable.paymentMethod,
      status: invoicesTable.status,
      notes: invoicesTable.notes,
      createdBy: invoicesTable.createdBy,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .orderBy(sql`${invoicesTable.createdAt} DESC`)
    .limit(5);

  return res.json({
    todaySales,
    todayRevenue,
    totalProducts: Number(totalProducts),
    totalCustomers: Number(totalCustomers),
    lowStockCount,
    monthRevenue,
    expiringLicenses,
    recentInvoices: recentInvoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId ?? null,
      customerName: inv.customerName ?? null,
      subtotal: Number(inv.subtotal),
      discount: Number(inv.discount),
      tax: Number(inv.tax),
      total: Number(inv.total),
      paymentMethod: inv.paymentMethod,
      status: inv.status,
      notes: inv.notes ?? null,
      createdBy: inv.createdBy ?? null,
      createdAt: inv.createdAt.toISOString(),
    })),
  });
});

router.get("/reports/sales-by-category", async (req, res) => {
  const { startDate, endDate } = req.query;
  const conditions = [eq(invoicesTable.status, "paid")];
  if (startDate) conditions.push(gte(sql`${invoicesTable.createdAt}::date`, sql`${String(startDate)}::date`));
  if (endDate) conditions.push(lte(sql`${invoicesTable.createdAt}::date`, sql`${String(endDate)}::date`));

  const rows = await db
    .select({
      categoryId: categoriesTable.id,
      categoryName: categoriesTable.name,
      revenue: sql<number>`SUM(${invoiceItemsTable.total}::numeric)`,
      itemCount: sql<number>`COUNT(DISTINCT ${invoiceItemsTable.id})`,
    })
    .from(invoiceItemsTable)
    .innerJoin(invoicesTable, and(eq(invoiceItemsTable.invoiceId, invoicesTable.id), ...conditions))
    .innerJoin(productsTable, eq(invoiceItemsTable.productId, productsTable.id))
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .groupBy(categoriesTable.id, categoriesTable.name)
    .orderBy(sql`SUM(${invoiceItemsTable.total}::numeric) DESC`);

  return res.json(rows.map(r => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    revenue: Number(r.revenue),
    itemCount: Number(r.itemCount),
  })));
});

export default router;
