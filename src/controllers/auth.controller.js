
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    console.log("Forgot password requested for:", email);

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 8000)
    );

    const supabaseCall = supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.CLIENT_URL}/update-password.html`,
    });

    const { error } = await Promise.race([supabaseCall, timeout]);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ message: "Failed to send email" });
    }

    return res.json({ message: "Reset email sent" });

  } catch (err) {
    console.error("Forgot password crash:", err);

    return res.status(500).json({
      message: err.message === "Timeout"
        ? "Request timed out"
        : "Server error"
    });
  }
}
