import { Router, RequestHandler } from "express";
import * as orderController from "../controllers/order.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth as RequestHandler);

router.post("/", orderController.createOrder);
router.get("/", orderController.getOrders);
router.get("/:id", orderController.getOrderById);

export default router;
