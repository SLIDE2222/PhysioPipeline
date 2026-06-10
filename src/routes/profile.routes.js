import { Router } from "express";
import {
  acceptClinicLinkRequest,
  createProfile,
  getMyProfile,
  getProfile,
  listMyClinicLinkRequests,
  listProfileOptions,
  listProfiles,
  rejectClinicLinkRequest,
  unlinkClinicFromProfile,
  updateMyProfile
} from "../controllers/profile.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", listProfiles);
router.get("/options", listProfileOptions);
router.get("/me", requireAuth, getMyProfile);
router.get("/me/clinic-links", requireAuth, listMyClinicLinkRequests);
router.post("/me/clinic-links/:linkId/accept", requireAuth, acceptClinicLinkRequest);
router.post("/me/clinic-links/:linkId/reject", requireAuth, rejectClinicLinkRequest);
router.delete("/me/clinic-links/:linkId", requireAuth, unlinkClinicFromProfile);
router.get("/:id", getProfile);
router.post("/", requireAuth, createProfile);
router.put("/me", requireAuth, updateMyProfile);

export default router;
