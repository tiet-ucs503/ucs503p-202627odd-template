import { Router, RequestHandler } from "express";
import * as vendorController from "../controllers/vendor.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", vendorController.listVendors);
router.get("/:id", vendorController.getVendorById);

// Vendor dashboard specific routes
router.get("/my/orders", requireAuth as RequestHandler, vendorController.getVendorOrders as any);
router.patch("/my/orders/:id/status", requireAuth as RequestHandler, vendorController.updateOrderStatus as any);

export default router;
