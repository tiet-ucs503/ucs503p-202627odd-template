import { Router } from "express";
import { register,login,me } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requiredFields } from "../middleware/validationMiddleware.js";
const router=Router();
router.post("/register",requiredFields(["name","email","password"]),register);
router.post("/login",requiredFields(["email","password"]),login);
router.get("/me",protect,me);
export default router;
