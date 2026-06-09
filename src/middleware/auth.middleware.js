import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const tokenFromHeader = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = req.cookies?.token || tokenFromHeader;

  if (!token) {
    console.warn("Auth middleware missing token:", { method: req.method, path: req.originalUrl });
    return res.status(401).json({ error: "Login obrigatório.", message: "Login obrigatório." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    console.warn("Auth middleware token rejected:", {
      method: req.method,
      path: req.originalUrl,
      error: error?.message,
      tokenPrefix: token ? String(token).slice(0, 12) : null,
    });
    return res.status(401).json({ error: "Sessão inválida ou expirada.", message: "Sessão inválida ou expirada." });
  }
}


