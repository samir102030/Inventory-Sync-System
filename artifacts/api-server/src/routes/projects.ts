import { Router } from "express";
import { db, projectsTable, invoicesTable, expensesTable, customersTable, quotationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtProject(p: any, inv: any, exp: any, quot: any) {
  const installationCost = Number(p.installationCost ?? 0);
  const maintenanceCost  = Number(p.maintenanceCost  ?? 0);
  const totalRevenue     = inv.totalRevenue   ?? 0;
  const totalExpenses    = exp.totalExpenses  ?? 0;
  const totalQuotations  = quot.totalQuotations ?? 0;
  const netProfit = totalRevenue - totalExpenses - installationCost - maintenanceCost;
  return {
    ...p,
    installationCost,
    maintenanceCost,
    totalRevenue,
    invoiceCount:   inv.invoiceCount   ?? 0,
    totalExpenses,
    expenseCount:   exp.expenseCount   ?? 0,
    totalQuotations,
    quotationCount: quot.quotationCount ?? 0,
    netProfit,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  };
}

// ── GET /projects ─────────────────────────────────────────────────────────────
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
      maintenanceCost: projectsTable.maintenanceCost,
      startDate: projectsTable.startDate,
      endDate: projectsTable.endDate,
      notes: projectsTable.notes,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id))
    .orderBy(projectsTable.createdAt);

  const [invoiceTotals, expenseTotals, quotationTotals] = await Promise.all([
    db.select({
      projectId: invoicesTable.projectId,
      totalRevenue: sql<number>`coalesce(sum(${invoicesTable.total}),0)`,
      invoiceCount: sql<number>`count(*)`,
    }).from(invoicesTable).where(sql`${invoicesTable.projectId} is not null`).groupBy(invoicesTable.projectId),

    db.select({
      projectId: expensesTable.projectId,
      totalExpenses: sql<number>`coalesce(sum(${expensesTable.amount}),0)`,
      expenseCount: sql<number>`count(*)`,
    }).from(expensesTable).where(sql`${expensesTable.projectId} is not null`).groupBy(expensesTable.projectId),

    db.select({
      projectId: quotationsTable.projectId,
      totalQuotations: sql<number>`coalesce(sum(${quotationsTable.total}),0)`,
      quotationCount: sql<number>`count(*)`,
    }).from(quotationsTable).where(sql`${quotationsTable.projectId} is not null`).groupBy(quotationsTable.projectId),
  ]);

  const invMap:  Record<number, any> = {};
  const expMap:  Record<number, any> = {};
  const quotMap: Record<number, any> = {};
  for (const r of invoiceTotals)   if (r.projectId != null) invMap[r.projectId]  = { totalRevenue:    Number(r.totalRevenue),    invoiceCount:   Number(r.invoiceCount) };
  for (const r of expenseTotals)   if (r.projectId != null) expMap[r.projectId]  = { totalExpenses:   Number(r.totalExpenses),   expenseCount:   Number(r.expenseCount) };
  for (const r of quotationTotals) if (r.projectId != null) quotMap[r.projectId] = { totalQuotations: Number(r.totalQuotations), quotationCount: Number(r.quotationCount) };

  return res.json(projects.map((p) => fmtProject(p, invMap[p.id] ?? {}, expMap[p.id] ?? {}, quotMap[p.id] ?? {})));
});

// ── GET /projects/:id ─────────────────────────────────────────────────────────
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
      maintenanceCost: projectsTable.maintenanceCost,
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

  const [invoices, expenses, quotations] = await Promise.all([
    db.select().from(invoicesTable).where(eq(invoicesTable.projectId, id)),
    db.select().from(expensesTable).where(eq(expensesTable.projectId, id)),
    db.select().from(quotationsTable).where(eq(quotationsTable.projectId, id)),
  ]);

  const totalRevenue    = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalExpenses   = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalQuotations = quotations.reduce((s, q) => s + Number(q.total), 0);
  const installationCost = Number(project.installationCost);
  const maintenanceCost  = Number(project.maintenanceCost);
  const netProfit = totalRevenue - totalExpenses - installationCost - maintenanceCost;

  return res.json({
    ...project,
    installationCost,
    maintenanceCost,
    totalRevenue,
    totalExpenses,
    totalQuotations,
    netProfit,
    invoiceCount:   invoices.length,
    expenseCount:   expenses.length,
    quotationCount: quotations.length,
    invoices:   invoices.map((i) => ({ ...i, total: Number(i.total), subtotal: Number(i.subtotal), discount: Number(i.discount), tax: Number(i.tax ?? 0), createdAt: i.createdAt.toISOString() })),
    expenses:   expenses.map((e) => ({ ...e, amount: Number(e.amount), createdAt: e.createdAt.toISOString() })),
    quotations: quotations.map((q) => ({ ...q, total: Number(q.total), subtotal: Number(q.subtotal), discount: Number(q.discount), tax: Number(q.tax ?? 0), createdAt: q.createdAt.toISOString() })),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

// ── POST /projects ────────────────────────────────────────────────────────────
router.post("/projects", async (req, res) => {
  const { name, description, customerId, status, installationCost, maintenanceCost, startDate, endDate, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const [p] = await db.insert(projectsTable).values({
    name,
    description,
    customerId: customerId ? Number(customerId) : null,
    status: status ?? "active",
    installationCost: String(installationCost ?? 0),
    maintenanceCost:  String(maintenanceCost  ?? 0),
    startDate: startDate ?? null,
    endDate:   endDate   ?? null,
    notes,
  }).returning();
  return res.status(201).json({ ...p, installationCost: Number(p.installationCost), maintenanceCost: Number(p.maintenanceCost), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });
});

// ── PATCH /projects/:id ───────────────────────────────────────────────────────
router.patch("/projects/:id", async (req, res) => {
  const { name, description, customerId, status, installationCost, maintenanceCost, startDate, endDate, notes } = req.body;
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (name              !== undefined) updates.name             = name;
  if (description       !== undefined) updates.description      = description;
  if (customerId        !== undefined) updates.customerId        = customerId ? Number(customerId) : null;
  if (status            !== undefined) updates.status           = status;
  if (installationCost  !== undefined) updates.installationCost = String(installationCost);
  if (maintenanceCost   !== undefined) updates.maintenanceCost  = String(maintenanceCost);
  if (startDate         !== undefined) updates.startDate        = startDate;
  if (endDate           !== undefined) updates.endDate          = endDate;
  if (notes             !== undefined) updates.notes            = notes;

  const [p] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, Number(req.params.id))).returning();
  if (!p) return res.status(404).json({ error: "Not found" });
  return res.json({ ...p, installationCost: Number(p.installationCost), maintenanceCost: Number(p.maintenanceCost), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() });
});

// ── DELETE /projects/:id ──────────────────────────────────────────────────────
router.delete("/projects/:id", async (req, res) => {
  const id = Number(req.params.id);
  await Promise.all([
    db.update(invoicesTable).set({ projectId: null }).where(eq(invoicesTable.projectId, id)),
    db.update(expensesTable).set({ projectId: null }).where(eq(expensesTable.projectId, id)),
    db.update(quotationsTable).set({ projectId: null }).where(eq(quotationsTable.projectId, id)),
  ]);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  return res.json({ ok: true });
});

// ── invoice linking ───────────────────────────────────────────────────────────
router.post("/projects/:id/invoices/:invoiceId", async (req, res) => {
  await db.update(invoicesTable).set({ projectId: Number(req.params.id) }).where(eq(invoicesTable.id, Number(req.params.invoiceId)));
  return res.json({ ok: true });
});
router.delete("/projects/:id/invoices/:invoiceId", async (req, res) => {
  await db.update(invoicesTable).set({ projectId: null }).where(eq(invoicesTable.id, Number(req.params.invoiceId)));
  return res.json({ ok: true });
});

// ── expense linking ───────────────────────────────────────────────────────────
router.post("/projects/:id/expenses/:expenseId", async (req, res) => {
  await db.update(expensesTable).set({ projectId: Number(req.params.id) }).where(eq(expensesTable.id, Number(req.params.expenseId)));
  return res.json({ ok: true });
});
router.delete("/projects/:id/expenses/:expenseId", async (req, res) => {
  await db.update(expensesTable).set({ projectId: null }).where(eq(expensesTable.id, Number(req.params.expenseId)));
  return res.json({ ok: true });
});

// ── quotation linking ─────────────────────────────────────────────────────────
router.post("/projects/:id/quotations/:quotationId", async (req, res) => {
  await db.update(quotationsTable).set({ projectId: Number(req.params.id) }).where(eq(quotationsTable.id, Number(req.params.quotationId)));
  return res.json({ ok: true });
});
router.delete("/projects/:id/quotations/:quotationId", async (req, res) => {
  await db.update(quotationsTable).set({ projectId: null }).where(eq(quotationsTable.id, Number(req.params.quotationId)));
  return res.json({ ok: true });
});

// ── GET /invoices?customerId=N  (for project linking picker) ─────────────────
router.get("/projects/:id/customer-invoices", async (req, res) => {
  const project = await db.select({ customerId: projectsTable.customerId }).from(projectsTable).where(eq(projectsTable.id, Number(req.params.id))).limit(1);
  if (!project[0] || !project[0].customerId) return res.json([]);
  const rows = await db.select().from(invoicesTable).where(eq(invoicesTable.customerId, project[0].customerId));
  return res.json(rows.map((i) => ({ ...i, total: Number(i.total), subtotal: Number(i.subtotal), discount: Number(i.discount), tax: Number(i.tax ?? 0), createdAt: i.createdAt.toISOString() })));
});

router.get("/projects/:id/customer-quotations", async (req, res) => {
  const project = await db.select({ customerId: projectsTable.customerId }).from(projectsTable).where(eq(projectsTable.id, Number(req.params.id))).limit(1);
  if (!project[0] || !project[0].customerId) return res.json([]);
  const rows = await db.select().from(quotationsTable).where(eq(quotationsTable.customerId, project[0].customerId));
  return res.json(rows.map((q) => ({ ...q, total: Number(q.total), subtotal: Number(q.subtotal), discount: Number(q.discount), tax: Number(q.tax ?? 0), createdAt: q.createdAt.toISOString() })));
});

export default router;
