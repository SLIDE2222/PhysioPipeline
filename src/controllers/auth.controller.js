import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { prisma } from "../lib/prisma.js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      })
    : null;

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      })
    : null;

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildClientUrl(req) {
  const explicitClientUrl = normalizeBaseUrl(process.env.CLIENT_URL);
  if (explicitClientUrl) return explicitClientUrl;

  const originHeader = normalizeBaseUrl(req.headers.origin);
  if (originHeader) return originHeader;

  const refererHeader = String(req.headers.referer || "").trim();
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      return normalizeBaseUrl(refererUrl.origin);
    } catch (_) {
      // ignore invalid referer
    }
  }

  return "";
}

function signAuthToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function clearAuthCookie(res) {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
}

function decodeJwtPayload(token) {
  try {
    const [, payloadPart] = String(token || "").split(".");
    if (!payloadPart) return null;
    const json = Buffer.from(payloadPart, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function register(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must have at least 6 characters." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "This email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({
      message: "Account created successfully.",
      user,
      token,
    });
  } catch (error) {
    console.error("Register crash:", error);
    return res.status(500).json({ message: "Failed to create account." });
  }
}

export async function login(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
    };

    const token = signAuthToken(safeUser);
    setAuthCookie(res, token);

    return res.json({
      message: "Login successful.",
      user: safeUser,
      token,
    });
  } catch (error) {
    console.error("Login crash:", error);
    return res.status(500).json({ message: "Failed to login." });
  }
}

export async function logout(_req, res) {
  clearAuthCookie(res);
  return res.json({ message: "Logged out successfully." });
}

export async function me(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user });
  } catch (error) {
    console.error("Me crash:", error);
    return res.status(500).json({ message: "Failed to fetch user." });
  }
}

export async function forgotPassword(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    if (!supabase) {
      console.error("Forgot password misconfiguration:", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseAnonKey: Boolean(supabaseAnonKey),
      });
      return res.status(500).json({
        message: "Supabase environment variables are missing on the backend.",
      });
    }

    const clientUrl = buildClientUrl(req);
    if (!clientUrl) {
      console.error("Forgot password missing CLIENT_URL and no usable origin/referer header.");
      return res.status(500).json({
        message: "CLIENT_URL is missing on the backend.",
      });
    }

    const redirectTo = `${clientUrl}/update-password.html`;

    console.log("Forgot password requested for:", email, "redirectTo:", redirectTo);

    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), 10000);
    });

    const supabaseCall = supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    const { error } = await Promise.race([supabaseCall, timeout]);

    if (error) {
      console.error("Supabase forgot password error:", {
        message: error.message,
        status: error.status,
        name: error.name,
        redirectTo,
      });

      return res.status(502).json({
        message: "Failed to send reset email.",
        details: error.message || "Unknown Supabase error.",
      });
    }

    return res.json({
      message: "Se o e-mail existir, o link de recuperação foi enviado.",
      redirectTo,
    });
  } catch (err) {
    console.error("Forgot password crash:", err);

    if (err.message === "Timeout") {
      return res.status(504).json({
        message: "Password reset request timed out while waiting for Supabase.",
      });
    }

    return res.status(500).json({
      message: err.message || "Server error.",
    });
  }
}

export async function updatePassword(req, res) {
  try {
    const accessToken = String(req.body?.accessToken || req.body?.token || "").trim();
    const password = String(req.body?.password || "");

    if (!accessToken || !password) {
      return res.status(400).json({
        message: "Access token and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must have at least 6 characters.",
      });
    }

    if (!supabase) {
      return res.status(500).json({
        message: "Supabase environment variables are missing on the backend.",
      });
    }

    const recoveryClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    let updateResult = await recoveryClient.auth.updateUser({ password });

    if (updateResult?.error && supabaseAdmin) {
      const payload = decodeJwtPayload(accessToken);
      const userId = payload?.sub || payload?.user_id || "";

      if (userId) {
        updateResult = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
        });
      }
    }

    if (updateResult?.error) {
      console.error("Update password error:", updateResult.error);
      return res.status(502).json({
        message: updateResult.error.message || "Failed to update password.",
      });
    }

    return res.json({
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("Update password crash:", error);
    return res.status(500).json({
      message: error.message || "Failed to update password.",
    });
  }
}
