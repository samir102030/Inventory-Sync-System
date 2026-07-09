import { Router } from "express";
import { db, employeesTable, salaryPaymentsTable, accountTransactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

const fmt = (e: any) => ({
  ...e,
  baseSalary: Number(e.baseSalary),
  createdAt: e.createdAt.toISOString(),
});

const fmtPayment = (p: any) => ({
  ...p,
  amount: Number(p.amount),
  createdAt: p.createdAt.toISOString(),
});

router.get("/employees", async (_req, res) => {
  const rows = await db.select().from(employeesTable).orderBy(employeesTable.name);
  return res.json(rows.map(fmt));
});

router.post("/employees", async (req, res) => {
  const { name, position, baseSalary, phone, hireDate, status, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [e] = await db.insert(employeesTable).values({
    name, position: position ?? "", baseSalary: String(baseSalary ?? 0),
    phone: phone ?? null, hireDate: hireDate ?? null,
    status: status ?? "active", notes: notes ?? null,
  }).returning();
  return res.status(201).json(fmt(e));
});

router.patch("/employees/:id", async (req, res) => {
  const { name, position, baseSalary, phone, hireDate, status, notes } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (position !== undefined) updates.position = position;
  if (baseSalary !== undefined) updates.baseSalary = String(baseSalary);
  if (phone !== undefined) updates.phone = phone;
  if (hireDate !== undefined) updates.hireDate = hireDate;
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  const [e] = await db.update(employeesTable).set(updates).where(eq(employeesTable.id, Number(req.params.id))).returning();
  if (!e) return res.status(404).json({ error: "Not found" });
  return res.json(fmt(e));
});

router.delete("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const payments = await db.select({ id: salaryPaymentsTable.id }).from(salaryPaymentsTable).where(eq(salaryPaymentsTable.employeeId, id));
  for (const p of payments) {
    await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `salary:${p.id}`));
  }
  await db.delete(salaryPaymentsTable).where(eq(salaryPaymentsTable.employeeId, id));
  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  return res.json({ ok: true });
});

router.get("/employees/:id/salaries", async (req, res) => {
  const rows = await db.select().from(salaryPaymentsTable)
    .where(eq(salaryPaymentsTable.employeeId, Number(req.params.id)))
    .orderBy(desc(salaryPaymentsTable.paidAt));
  return res.json(rows.map(fmtPayment));
});

router.post("/employees/:id/salary", async (req, res) => {
  const { amount, month, accountId, notes, paidAt } = req.body;
  if (!amount || !month || !paidAt) return res.status(400).json({ error: "amount, month, paidAt required" });
  const emp = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(req.params.id))).limit(1);
  if (!emp[0]) return res.status(404).json({ error: "Employee not found" });

  const [p] = await db.insert(salaryPaymentsTable).values({
    employeeId: Number(req.params.id),
    amount: String(amount),
    month,
    accountId: accountId ? Number(accountId) : null,
    notes: notes ?? null,
    paidAt,
  }).returning();

  if (accountId) {
    await db.insert(accountTransactionsTable).values({
      accountId: Number(accountId),
      direction: "out",
      amount: String(amount),
      description: `راتب ${emp[0].name} — ${month}`,
      category: "رواتب",
      date: paidAt,
      reference: `salary:${p.id}`,
    });
  }

  return res.status(201).json(fmtPayment(p));
});

router.delete("/employees/:employeeId/salary/:id", async (req, res) => {
  await db.delete(accountTransactionsTable).where(eq(accountTransactionsTable.reference, `salary:${req.params.id}`));
  await db.delete(salaryPaymentsTable).where(eq(salaryPaymentsTable.id, Number(req.params.id)));
  return res.json({ ok: true });
});

export default router;
