import { Router, RequestHandler } from "express";
import * as ctrl from "../controllers/review.controller";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.post("/", requireAuth as RequestHandler, requireRole("CUSTOMER") as RequestHandler, ctrl.createReview as any);
router.get("/", requireAuth as RequestHandler, ctrl.listMyReviews as any);
router.get("/vendor/:vendorId", ctrl.listVendorReviews as any);
export default router;
