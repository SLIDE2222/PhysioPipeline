import { Router } from "express";
import {
  listProfileReviews,
  submitReview,
  listMyReviews,
  reportReview,
  listAdminReviews,
  approveReview,
  keepPublishedReview,
  rejectReview,
} from "../controllers/review.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
const adminRouter = Router();

router.get("/profile/:profileId", listProfileReviews);
router.post("/", submitReview);
router.get("/me", requireAuth, listMyReviews);
router.post("/:reviewId/report", requireAuth, reportReview);

adminRouter.get("/", requireAuth, listAdminReviews);
adminRouter.post("/:reviewId/approve", requireAuth, approveReview);
adminRouter.post("/:reviewId/keep-published", requireAuth, keepPublishedReview);
adminRouter.post("/:reviewId/reject", requireAuth, rejectReview);

export { adminRouter as adminReviewRouter };
export default router;
