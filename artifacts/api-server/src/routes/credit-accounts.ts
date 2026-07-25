import { Router } from "express";
import { db, invoicesTable, customersTable, receiptVouchersTable, purchasesTable, suppliersTable, paymentVouchersTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

router.get("/credit-accounts/customers", async (_req, res) => {
  const creditTotals = await db
    .select({
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      totalCredit: sql<string>`COALESCE(SUM(${invoicesTable.total}), 0)`,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(and(eq(invoicesTable.paymentMethod, "credit"), sql`${invoicesTable.status} != 'cancelled'`))
    .groupBy(invoicesTable.customerId, customersTable.name);

  const paidTotals = await db
    .select({
      customerId: receiptVouchersTable.customerId,
      totalPaid: sql<string>`COALESCE(SUM(${receiptVouchersTable.amount}), 0)`,
    })
    .from(receiptVouchersTable)
    .where(sql`${receiptVouchersTable.customerId} IS NOT NULL`)
    .groupBy(receiptVouchersTable.customerId);

  const paidMap = new Map(paidTotals.map(p => [p.customerId, Number(p.totalPaid)]));

  const rows = creditTotals
    .filter(c => c.customerId !== null)
    .map(c => {
      const totalCredit = Number(c.totalCredit);
      const totalPaid = paidMap.get(c.customerId) ?? 0;
      return {
        customerId: c.customerId,
        customerName: c.customerName ?? "بدون اسم",
        totalCredit,
        totalPaid,
        balance: totalCredit - totalPaid,
      };
    })
    .filter(r => r.balance > 0.001)
    .sort((a, b) => b.balance - a.balance);

  return res.json(rows);
});

router.get("/credit-accounts/suppliers", async (_req, res) => {
  const creditTotals = await db
    .select({
      supplierId: purchasesTable.supplierId,
      supplierName: suppliersTable.name,
      supplierLabel: purchasesTable.supplierName,
      totalCredit: sql<string>`COALESCE(SUM(${purchasesTable.total}), 0)`,
    })
    .from(purchasesTable)
    .leftJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
    .where(eq(purchasesTable.paymentMethod, "credit"))
    .groupBy(purchasesTable.supplierId, suppliersTable.name, purchasesTable.supplierName);

  const paidTotals = await db
    .select({
      supplierId: paymentVouchersTable.supplierId,
      totalPaid: sql<string>`COALESCE(SUM(${paymentVouchersTable.amount}), 0)`,
    })
    .from(paymentVouchersTable)
    .where(sql`${paymentVouchersTable.supplierId} IS NOT NULL`)
    .groupBy(paymentVouchersTable.supplierId);

  const paidMap = new Map(paidTotals.map(p => [p.supplierId, Number(p.totalPaid)]));

  const rows = creditTotals
    .filter(c => c.supplierId !== null)
    .map(c => {
      const totalCredit = Number(c.totalCredit);
      const totalPaid = paidMap.get(c.supplierId) ?? 0;
      return {
        supplierId: c.supplierId,
        supplierName: c.supplierName ?? c.supplierLabel ?? "بدون اسم",
        totalCredit,
        totalPaid,
        balance: totalCredit - totalPaid,
      };
    })
    .filter(r => r.balance > 0.001)
    .sort((a, b) => b.balance - a.balance);

  return res.json(rows);
});

/* ── Supplier full balances: opening + credit purchases − payments ── */
router.get("/credit-accounts/supplier-balances", async (_req, res) => {
  // All registered suppliers with opening balance
  const allSuppliers = await db
    .select({ id: suppliersTable.id, name: suppliersTable.name, openingBalance: suppliersTable.openingBalance })
    .from(suppliersTable);

  // Credit purchases per supplier
  const creditPurchases = await db
    .select({
      supplierId: purchasesTable.supplierId,
      total: sql<string>`COALESCE(SUM(${purchasesTable.total}), 0)`,
    })
    .from(purchasesTable)
    .where(eq(purchasesTable.paymentMethod, "credit"))
    .groupBy(purchasesTable.supplierId);
  const purchaseMap = new Map(creditPurchases.map(p => [p.supplierId, Number(p.total)]));

  // Payment vouchers per supplier
  const payments = await db
    .select({
      supplierId: paymentVouchersTable.supplierId,
      totalPaid: sql<string>`COALESCE(SUM(${paymentVouchersTable.amount}), 0)`,
    })
    .from(paymentVouchersTable)
    .where(sql`${paymentVouchersTable.supplierId} IS NOT NULL`)
    .groupBy(paymentVouchersTable.supplierId);
  const paidMap = new Map(payments.map(p => [p.supplierId, Number(p.totalPaid)]));

  const rows = allSuppliers
    .map(s => {
      const openingBalance = Number(s.openingBalance ?? 0);
      const totalPurchases = purchaseMap.get(s.id) ?? 0;
      const totalPaid = paidMap.get(s.id) ?? 0;
      // balance > 0 = we owe them (ليهم فلوس)
      // balance < 0 = they owe us / we overpaid
      const balance = openingBalance + totalPurchases - totalPaid;
      return { supplierId: s.id, supplierName: s.name, openingBalance, totalPurchases, totalPaid, balance };
    })
    .filter(r => Math.abs(r.balance) > 0.001)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

  const totalOwedToSuppliers = rows.filter(r => r.balance > 0).reduce((s, r) => s + r.balance, 0);
  const totalOwedBySuppliers = rows.filter(r => r.balance < 0).reduce((s, r) => s + Math.abs(r.balance), 0);

  return res.json({ rows, totalOwedToSuppliers, totalOwedBySuppliers });
});

/* ── Customer balances: positive = they owe us, negative = we owe them ── */
router.get("/credit-accounts/balances", async (_req, res) => {
  const custCredit = await db
    .select({
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      totalInvoiced: sql<string>`COALESCE(SUM(${invoicesTable.total}), 0)`,
    })
    .from(invoicesTable)
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .where(and(eq(invoicesTable.paymentMethod, "credit"), sql`${invoicesTable.status} != 'cancelled'`))
    .groupBy(invoicesTable.customerId, customersTable.name);

  const custPaid = await db
    .select({
      customerId: receiptVouchersTable.customerId,
      totalPaid: sql<string>`COALESCE(SUM(${receiptVouchersTable.amount}), 0)`,
    })
    .from(receiptVouchersTable)
    .where(sql`${receiptVouchersTable.customerId} IS NOT NULL`)
    .groupBy(receiptVouchersTable.customerId);

  const paidMap = new Map(custPaid.map(p => [p.customerId, Number(p.totalPaid)]));

  // Build invoice map (customers with credit invoices)
  const invoiceMap = new Map(
    custCredit
      .filter(c => c.customerId !== null)
      .map(c => [c.customerId!, { name: c.customerName ?? "بدون اسم", totalInvoiced: Number(c.totalInvoiced) }])
  );

  // Include deposit-only customers (receipt vouchers but no credit invoice)
  const depositOnlyIds = [...paidMap.keys()].filter(id => id !== null && !invoiceMap.has(id!)) as number[];
  const depositCustomerNames: { id: number; name: string }[] = depositOnlyIds.length > 0
    ? await db.select({ id: customersTable.id, name: customersTable.name })
        .from(customersTable)
        .where(sql`${customersTable.id} = ANY(ARRAY[${sql.raw(depositOnlyIds.join(","))}]::int[])`)
    : [];
  const depositNameMap = new Map(depositCustomerNames.map(c => [c.id, c.name]));

  const allIds = new Set([...invoiceMap.keys(), ...depositOnlyIds]);

  const rows = [...allIds].map(customerId => {
    const inv = invoiceMap.get(customerId);
    const totalInvoiced = inv?.totalInvoiced ?? 0;
    const totalPaid = paidMap.get(customerId) ?? 0;
    const name = inv?.name ?? depositNameMap.get(customerId) ?? "بدون اسم";
    return { customerId, name, totalInvoiced, totalPaid, balance: totalInvoiced - totalPaid };
  })
    .filter(r => Math.abs(r.balance) > 0.001)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

  const totalOwedByCustomers = rows.filter(r => r.balance > 0).reduce((s, r) => s + r.balance, 0);
  const totalOwedToCustomers = rows.filter(r => r.balance < 0).reduce((s, r) => s + Math.abs(r.balance), 0);

  return res.json({ rows, totalOwedByCustomers, totalOwedToCustomers });
});

export default router;
