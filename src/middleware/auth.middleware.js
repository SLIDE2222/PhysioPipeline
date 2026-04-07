import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const tokenFromHeader = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = req.cookies?.token || tokenFromHeader;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
