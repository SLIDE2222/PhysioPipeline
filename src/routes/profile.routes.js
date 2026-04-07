import { Router } from "express";
import {
  createProfile,
  getMyProfile,
  getProfile,
  listProfiles,
  updateMyProfile
} from "../controllers/profile.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", listProfiles);
router.get("/me", requireAuth, getMyProfile);
router.get("/:id", getProfile);
router.post("/", requireAuth, createProfile);
router.put("/me", requireAuth, updateMyProfile);

export default router;
