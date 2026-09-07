import { Router } from "express";
import { getUser,updateProfile } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
const router=Router();
router.get("/:id",getUser);
router.put("/profile",protect,updateProfile);
export default router;
