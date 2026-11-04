import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import netsuiteRouter from "./netsuite";
import estimatesRouter from "./estimates";
import specialOrdersRouter from "./specialOrders";
import authRouter from "./auth";
import adminRouter from "./admin";
import imageProxyRouter from "./imageProxy";
import analyticsRouter from "./analytics";
import storageRouter from "./storage";
import productImagesRouter from "./productImages";
import quoteHelperRouter from "./quoteHelper";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(netsuiteRouter);
router.use(estimatesRouter);
router.use(specialOrdersRouter);
router.use(adminRouter);
router.use(imageProxyRouter);
router.use(analyticsRouter);
router.use(storageRouter);
router.use(productImagesRouter);
router.use(quoteHelperRouter);

export default router;
