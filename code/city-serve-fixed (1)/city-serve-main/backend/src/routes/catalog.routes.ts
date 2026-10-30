import { Router, RequestHandler } from "express";
import * as ctrl from "../controllers/catalog.controller";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/products", ctrl.listProducts);
router.get("/products/:id", ctrl.getProduct);
router.post("/products", requireAuth as RequestHandler, requireRole("VENDOR") as RequestHandler, ctrl.createOffering);
router.patch("/products/:id", requireAuth as RequestHandler, requireRole("VENDOR") as RequestHandler, ctrl.updateOffering);

router.get("/services", ctrl.listServices);
router.get("/services/:id", ctrl.getService);
router.post("/services", requireAuth as RequestHandler, requireRole("VENDOR") as RequestHandler, ctrl.createOffering);
router.patch("/services/:id", requireAuth as RequestHandler, requireRole("VENDOR") as RequestHandler, ctrl.updateOffering);

export default router;
