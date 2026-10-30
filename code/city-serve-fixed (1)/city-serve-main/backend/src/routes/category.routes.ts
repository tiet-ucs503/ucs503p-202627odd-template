import { Router } from "express";
import * as ctrl from "../controllers/category.controller";

const router = Router();
router.get("/", ctrl.listCategories);
router.get("/:slug", ctrl.getCategory);
export default router;
