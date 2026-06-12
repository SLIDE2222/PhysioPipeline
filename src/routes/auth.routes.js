import { Router } from "express";
import {
  login,
  logout,
  markNotificationRead,
  me,
  notifications,
  register,
  forgotPassword,
  updatePassword,
  googleLogin,
  supabaseLogin,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/supabase", supabaseLogin);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.get("/notifications", requireAuth, notifications);
router.post("/notifications/:id/read", requireAuth, markNotificationRead);
router.post("/forgot-password", forgotPassword);
router.post("/update-password", updatePassword);

export default router;
