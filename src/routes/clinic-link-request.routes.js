import { Router } from "express";
import {
  createClinicLinkRequest,
  listMyClinicLinkRequests,
} from "../controllers/clinic-link-request.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", requireAuth, createClinicLinkRequest);
router.get("/my", requireAuth, listMyClinicLinkRequests);

export default router;
