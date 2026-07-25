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

/* ── Unified balances: all customers + suppliers with any balance ── */
router.get("/credit-accounts/balances", async (_req, res) => {
  // --- Customers: balance they owe us (positive = owe us, negative = overpaid)
  const custCredit = await db
    .select({
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      totalCredit: sql<string>`COALESCE(SUM(${invoicesTable.total}), 0)`,
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

  const custPaidMap = new Map(custPaid.map(p => [p.customerId, Number(p.totalPaid)]));

  const customerRows = custCredit
    .filter(c => c.customerId !== null)
    .map(c => ({
      id: c.customerId!,
      name: c.customerName ?? "بدون اسم",
      type: "customer" as const,
      totalDebit: Number(c.totalCredit),      // what they owe
      totalCredit: custPaidMap.get(c.customerId) ?? 0, // what they paid
      balance: Number(c.totalCredit) - (custPaidMap.get(c.customerId) ?? 0),
    }))
    .filter(r => Math.abs(r.balance) > 0.001);

  // --- Suppliers: balance we owe them (positive = we owe them, negative = overpaid)
  const suppCredit = await db
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

  const suppPaid = await db
    .select({
      supplierId: paymentVouchersTable.supplierId,
      totalPaid: sql<string>`COALESCE(SUM(${paymentVouchersTable.amount}), 0)`,
    })
    .from(paymentVouchersTable)
    .where(sql`${paymentVouchersTable.supplierId} IS NOT NULL`)
    .groupBy(paymentVouchersTable.supplierId);

  const suppPaidMap = new Map(suppPaid.map(p => [p.supplierId, Number(p.totalPaid)]));

  const supplierRows = suppCredit
    .filter(c => c.supplierId !== null)
    .map(c => ({
      id: c.supplierId!,
      name: c.supplierName ?? c.supplierLabel ?? "بدون اسم",
      type: "supplier" as const,
      totalDebit: Number(c.totalCredit),       // what we bought on credit
      totalCredit: suppPaidMap.get(c.supplierId) ?? 0, // what we paid them
      balance: Number(c.totalCredit) - (suppPaidMap.get(c.supplierId) ?? 0),
    }))
    .filter(r => Math.abs(r.balance) > 0.001);

  const all = [...customerRows, ...supplierRows].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

  const summary = {
    totalReceivable: customerRows.filter(r => r.balance > 0).reduce((s, r) => s + r.balance, 0),
    totalPayable: supplierRows.filter(r => r.balance > 0).reduce((s, r) => s + r.balance, 0),
  };

  return res.json({ rows: all, summary });
});

export default router;
