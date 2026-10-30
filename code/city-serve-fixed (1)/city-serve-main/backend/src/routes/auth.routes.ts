import { Router } from "express";
import * as ctrl from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";

import { RequestHandler } from "express";

const router = Router();

router.post("/register/customer", authLimiter, ctrl.registerCustomer);
router.post("/register/vendor", authLimiter, ctrl.registerVendor as any);
router.post("/login", authLimiter, ctrl.login);
router.post("/logout", ctrl.logout);
router.post("/refresh", ctrl.refresh);
router.get("/me", requireAuth as RequestHandler, ctrl.me);
router.patch("/me", requireAuth as RequestHandler, ctrl.updateMe as any);

export default router;
