import { Router } from "express";
import { createLeadEvent, getMyLeadSummary } from "../controllers/lead.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", createLeadEvent);
router.get("/me/summary", requireAuth, getMyLeadSummary);

export default router;
