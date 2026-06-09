import { Router } from "express";
import {
  getClinic,
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
router.post("/register", requireAuth, upsertMyClinicProfile);
router.patch("/me", requireAuth, upsertMyClinicProfile);
router.put("/me", requireAuth, upsertMyClinicProfile);
router.get("/:id", getClinic);

export default router;


