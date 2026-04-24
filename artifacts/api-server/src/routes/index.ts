import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import netsuiteRouter from "./netsuite";
import estimatesRouter from "./estimates";
import authRouter from "./auth";
import adminRouter from "./admin";
import imageProxyRouter from "./imageProxy";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(netsuiteRouter);
router.use(estimatesRouter);
router.use(adminRouter);
router.use(imageProxyRouter);
router.use(analyticsRouter);

export default router;
