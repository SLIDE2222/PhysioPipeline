import { Router } from "express";
import {
  acceptClinicLinkRequest,
  createClinicLinkRequest,
  getClinicLinkRequest,
  listMyClinicLinkRequests,
  rejectClinicLinkRequest,
} from "../controllers/clinic-link-request.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", requireAuth, createClinicLinkRequest);
router.get("/my", requireAuth, listMyClinicLinkRequests);
router.get("/:id", requireAuth, getClinicLinkRequest);
router.post("/:linkId/accept", requireAuth, acceptClinicLinkRequest);
router.post("/:linkId/reject", requireAuth, rejectClinicLinkRequest);

export default router;
