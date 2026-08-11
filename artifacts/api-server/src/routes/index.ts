import { Router, type IRouter } from "express";
import { requireAuth, requireRolePermissions } from "../middlewares/require-auth";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import customersRouter from "./customers";
import invoicesRouter from "./invoices";
import expensesRouter from "./expenses";
import licensesRouter from "./licenses";
import reportsRouter from "./reports";
import backupRouter from "./backup";
import settingsRouter from "./settings";
import suppliersRouter from "./suppliers";
import purchasesRouter from "./purchases";
import vouchersRouter from "./vouchers";
import accountsRouter from "./accounts";
import creditAccountsRouter from "./credit-accounts";
import warehousesRouter from "./warehouses";
import employeesRouter from "./employees";
import quotationsRouter from "./quotations";
import projectsRouter from "./projects";
import rentalRouter from "./rental";
import jam3iyyatRouter from "./jam3iyyat";
import creditCardsRouter from "./credit-cards";
import banksRouter from "./banks";

const router: IRouter = Router();

// --- مسارات عامة ------------------------------------------------------------
// /healthz يحتاجه Render لفحص حالة الخدمة.
// /auth/login و /auth/me و /auth/logout يجب أن تعمل قبل وجود جلسة.
// (/auth/me يرجّع 401 بنفسه إن لم توجد جلسة، وهذا ما تعتمد عليه شاشة الدخول.)
router.use(healthRouter);
router.use(authRouter);

// --- بوابة الحماية ----------------------------------------------------------
// كل ما يأتي بعد هذين السطرين لا يُفتح إلا بجلسة صالحة.
router.use(requireAuth);
router.use(requireRolePermissions);

router.use(usersRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(customersRouter);
router.use(invoicesRouter);
router.use(expensesRouter);
router.use(licensesRouter);
router.use(reportsRouter);
router.use(backupRouter);
router.use(settingsRouter);
router.use(suppliersRouter);
router.use(purchasesRouter);
router.use(vouchersRouter);
router.use(accountsRouter);
router.use(creditAccountsRouter);
router.use(warehousesRouter);
router.use(employeesRouter);
router.use(quotationsRouter);
router.use(projectsRouter);
router.use(rentalRouter);
router.use(jam3iyyatRouter);
router.use(creditCardsRouter);
router.use(banksRouter);

export default router;
