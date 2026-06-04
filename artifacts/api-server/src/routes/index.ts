import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
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

export default router;
