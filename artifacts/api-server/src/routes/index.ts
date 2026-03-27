import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import netsuiteRouter from "./netsuite";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(netsuiteRouter);

export default router;
