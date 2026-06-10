import { Router } from "express";
import {
  getClinic,
  listClinics,
  listClinicOptions,
  getMyClinicProfile,
  listMyClinicPhysioLinks,
  requestClinicPhysioLink,
  searchPhysiotherapistsForClinic,
  unlinkClinicPhysioFromClinic,
  upsertMyClinicProfile,
} from "../controllers/clinic.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", listClinics);
router.get("/options", listClinicOptions);
router.get("/physiotherapists/search", requireAuth, searchPhysiotherapistsForClinic);
router.get("/me", requireAuth, getMyClinicProfile);
router.get("/me/physio-links", requireAuth, listMyClinicPhysioLinks);
router.post("/me/physio-links", requireAuth, requestClinicPhysioLink);
router.delete("/me/physio-links/:linkId", requireAuth, unlinkClinicPhysioFromClinic);
router.post("/register", requireAuth, upsertMyClinicProfile);
router.patch("/me", requireAuth, upsertMyClinicProfile);
router.put("/me", requireAuth, upsertMyClinicProfile);
router.get("/:id", getClinic);

export default router;


