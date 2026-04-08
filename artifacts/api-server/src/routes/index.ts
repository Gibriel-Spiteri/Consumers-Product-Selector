import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import netsuiteRouter from "./netsuite";
import estimatesRouter from "./estimates";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(netsuiteRouter);
router.use(estimatesRouter);

export default router;
