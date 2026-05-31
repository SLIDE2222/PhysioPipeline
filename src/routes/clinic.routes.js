import { Router } from "express";
import {
  listClinics,
  listClinicOptions,
  getMyClinicProfile,
  upsertMyClinicProfile,
} from "../controllers/clinic.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", listClinics);
router.get("/options", listClinicOptions);
router.get("/me", requireAuth, getMyClinicProfile);
router.put("/me", requireAuth, upsertMyClinicProfile);

export default router;
