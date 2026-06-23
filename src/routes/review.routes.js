import { Router } from "express";
import {
  listProfileReviews,
  submitReview,
  listMyReviews,
  listMyPendingOwnerReviews,
  approveOwnReview,
  rejectOwnReview,
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
router.get("/owner/pending", requireAuth, listMyPendingOwnerReviews);
router.post("/:reviewId/approve", requireAuth, approveOwnReview);
router.post("/:reviewId/reject", requireAuth, rejectOwnReview);
router.post("/:reviewId/report", requireAuth, reportReview);
router.get("/:profileId", listProfileReviews);

adminRouter.get("/", requireAuth, listAdminReviews);
adminRouter.post("/:reviewId/approve", requireAuth, approveReview);
adminRouter.post("/:reviewId/keep-published", requireAuth, keepPublishedReview);
adminRouter.post("/:reviewId/reject", requireAuth, rejectReview);

export { adminRouter as adminReviewRouter };
export default router;