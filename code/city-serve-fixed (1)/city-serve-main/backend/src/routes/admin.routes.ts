import { Router } from "express";
import * as ctrl from "../controllers/admin.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { RequestHandler } from "express";

const router = Router();
router.use(requireAuth as RequestHandler, requireRole("ADMIN") as RequestHandler);
router.get("/users", ctrl.listUsers);
router.get("/vendors", ctrl.listAllVendors as any);
router.patch("/vendors/:id/verify", ctrl.toggleVendorVerify as any);
router.get("/analytics", ctrl.analytics);
export default router;
