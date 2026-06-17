import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import clinicRoutes from "./routes/clinic.routes.js";
import clinicLinkRequestRoutes from "./routes/clinic-link-request.routes.js";
import claimRoutes from "./routes/claim.routes.js";
import leadRoutes from "./routes/lead.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import {
  createClinicLinkRequest,
  listMyClinicLinkRequests,
} from "./controllers/clinic-link-request.controller.js";
import {
  notifications,
  markNotificationRead,
} from "./controllers/auth.controller.js";
import { requireAuth } from "./middleware/auth.middleware.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "physio-pipeline-api" });
});

app.use("/auth", authRoutes);
app.use("/profiles", profileRoutes);
app.use("/clinics", clinicRoutes);
app.use("/clinic-link-requests", clinicLinkRequestRoutes);
app.use("/claims", claimRoutes);
app.use("/lead-events", leadRoutes);
app.use("/contact", contactRoutes);

// Production/static hosts sometimes configure the frontend with an /api base
// path. Keep both route shapes available so clinic profile calls never fall
// through to Express' HTML 404 handler because of a base-path mismatch.
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/clinics", clinicRoutes);
app.use("/api/clinic-link-requests", clinicLinkRequestRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/lead-events", leadRoutes);
app.use("/api/contact", contactRoutes);

// Keep explicit aliases here as a safety net so this endpoint still resolves
// even if a deployment ends up with stale router wiring.
app.post("/clinic-link-requests", requireAuth, createClinicLinkRequest);
app.get("/clinic-link-requests/my", requireAuth, listMyClinicLinkRequests);
app.post("/api/clinic-link-requests", requireAuth, createClinicLinkRequest);
app.get("/api/clinic-link-requests/my", requireAuth, listMyClinicLinkRequests);
app.get("/api/notifications", requireAuth, notifications);
app.post("/api/notifications/:id/read", requireAuth, markNotificationRead);

app.use((req, res) => {
  res.status(404).json({
    message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    message: err.message || "Internal server error.",
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`PhysioPipeline API running on http://localhost:${port}`);
});



