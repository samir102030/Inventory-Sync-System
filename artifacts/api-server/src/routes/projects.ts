import { Router } from "express";
import { db, projectsTable, invoicesTable, expensesTable, customersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

// List all projects with computed totals
router.get("/projects", async (req, res) => {
  const projects = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      description: projectsTable.description,
      customerId: projectsTable.customerId,
      customerName: customersTable.name,
      status: projectsTable.status,
      installationCost: projectsTable.installationCost,
      startDate: projectsTable.startDate,
      endDate: projectsTable.endDate,
      notes: projectsTable.notes,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id))
    .orderBy(projectsTable.createdAt);

  // Get totals for each project
  const invoiceTotals = await db
    .select({
      projectId: invoicesTable.projectId,
      totalRevenue: sql<number>`coalesce(sum(${invoicesTable.total}), 0)`,
      invoiceCount: sql<number>`count(*)`,
    })
    .from(invoicesTable)
    .where(sql`${invoicesTable.projectId} is not null`)
    .groupBy(invoicesTable.projectId);

  const expenseTotals = await db
    .select({
      projectId: expensesTable.projectId,
      totalExpenses: sql<number>`coalesce(sum(${expensesTable.amount}), 0)`,
      expenseCount: sql<number>`count(*)`,
    })
    .from(expensesTable)
    .where(sql`${expensesTable.projectId} is not null`)
    .groupBy(expensesTable.projectId);

  const invMap: Record<number, { totalRevenue: number; invoiceCount: number }> = {};
  for (const r of invoiceTotals) {
    if (r.projectId != null) invMap[r.projectId] = { totalRevenue: Number(r.totalRevenue), invoiceCount: Number(r.invoiceCount) };
  }
  const expMap: Record<number, { totalExpenses: number; expenseCount: number }> = {};
  for (const r of expenseTotals) {
    if (r.projectId != null) expMap[r.projectId] = { totalExpenses: Number(r.totalExpenses), expenseCount: Number(r.expenseCount) };
  }

  return res.json(
    projects.map((p) => {
      const inv = invMap[p.id] ?? { totalRevenue: 0, invoiceCount: 0 };
      const exp = expMap[p.id] ?? { totalExpenses: 0, expenseCount: 0 };
      const installationCost = Number(p.installationCost);
      const netProfit = inv.totalRevenue - exp.totalExpenses - installationCost;
      return {
        ...p,
        installationCost,
        totalRevenue: inv.totalRevenue,
        invoiceCount: inv.invoiceCount,
        totalExpenses: exp.totalExpenses,
        expenseCount: exp.expenseCount,
        netProfit,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    })
  );
});

// Get single project with its invoices and expenses
router.get("/projects/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [project] = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      description: projectsTable.description,
      customerId: projectsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      status: projectsTable.status,
      installationCost: projectsTable.installationCost,
      startDate: projectsTable.startDate,
      endDate: projectsTable.endDate,
      notes: projectsTable.notes,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id))
    .where(eq(projectsTable.id, id));

  if (!project) return res.status(404).json({ error: "Not found" });

  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.projectId, id));

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.projectId, id));

  const totalRevenue = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const installationCost = Number(project.installationCost);
  const netProfit = totalRevenue - totalExpenses - installationCost;

  return res.json({
    ...project,
    installationCost,
    totalRevenue,
    totalExpenses,
    netProfit,
    invoices: invoices.map((i) => ({ ...i, total: Number(i.total), subtotal: Number(i.subtotal), discount: Number(i.discount), tax: Number(i.tax), createdAt: i.createdAt.toISOString() })),
    expenses: expenses.map((e) => ({ ...e, amount: Number(e.amount), createdAt: e.createdAt.toISOString() })),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

// Create project
router.post("/projects", async (req, res) => {
  const { name, description, customerId, status, installationCost, startDate, endDate, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  const [p] = await db
    .insert(projectsTable)
    .values({
      name,
      description,
      customerId: customerId ? Number(customerId) : null,
      status: status ?? "active",
      installationCost: String(installationCost ?? 0),
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      notes,
    })
    .returning();

  return res.status(201).json({ ...p, installationCost: Number(p.installationCost), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });
});

// Update project
router.patch("/projects/:id", async (req, res) => {
  const { name, description, customerId, status, installationCost, startDate, endDate, notes } = req.body;
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (customerId !== undefined) updates.customerId = customerId ? Number(customerId) : null;
  if (status !== undefined) updates.status = status;
  if (installationCost !== undefined) updates.installationCost = String(installationCost);
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (notes !== undefined) updates.notes = notes;

  const [p] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, Number(req.params.id))).returning();
  if (!p) return res.status(404).json({ error: "Not found" });

  return res.json({ ...p, installationCost: Number(p.installationCost), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });
});

// Delete project
router.delete("/projects/:id", async (req, res) => {
  const id = Number(req.params.id);
  // Unlink invoices and expenses
  await db.update(invoicesTable).set({ projectId: null }).where(eq(invoicesTable.projectId, id));
  await db.update(expensesTable).set({ projectId: null }).where(eq(expensesTable.projectId, id));
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  return res.json({ ok: true });
});

// Link invoice to project
router.post("/projects/:id/invoices/:invoiceId", async (req, res) => {
  const [inv] = await db
    .update(invoicesTable)
    .set({ projectId: Number(req.params.id) })
    .where(eq(invoicesTable.id, Number(req.params.invoiceId)))
    .returning();
  if (!inv) return res.status(404).json({ error: "Invoice not found" });
  return res.json({ ok: true });
});

// Unlink invoice from project
router.delete("/projects/:id/invoices/:invoiceId", async (req, res) => {
  await db
    .update(invoicesTable)
    .set({ projectId: null })
    .where(eq(invoicesTable.id, Number(req.params.invoiceId)));
  return res.json({ ok: true });
});

// Link expense to project
router.post("/projects/:id/expenses/:expenseId", async (req, res) => {
  const [exp] = await db
    .update(expensesTable)
    .set({ projectId: Number(req.params.id) })
    .where(eq(expensesTable.id, Number(req.params.expenseId)))
    .returning();
  if (!exp) return res.status(404).json({ error: "Expense not found" });
  return res.json({ ok: true });
});

// Unlink expense from project
router.delete("/projects/:id/expenses/:expenseId", async (req, res) => {
  await db
    .update(expensesTable)
    .set({ projectId: null })
    .where(eq(expensesTable.id, Number(req.params.expenseId)));
  return res.json({ ok: true });
});

export default router;
