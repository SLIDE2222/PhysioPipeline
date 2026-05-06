import { Router } from "express";
import {
  login,
  logout,
  me,
  register,
  forgotPassword,
  updatePassword,
  googleLogin,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.post("/forgot-password", forgotPassword);
router.post("/update-password", updatePassword);

export default router;
