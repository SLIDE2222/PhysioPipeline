import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildClientUrl(req) {
  const explicitClientUrl = normalizeBaseUrl(process.env.CLIENT_URL);
  if (explicitClientUrl) return explicitClientUrl;

  const originHeader = normalizeBaseUrl(req.headers.origin);
  if (originHeader) return originHeader;

  const refererHeader = String(req.headers.referer || '').trim();
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      return normalizeBaseUrl(refererUrl.origin);
    } catch (_) {
      // ignore invalid referer
    }
  }

  return '';
}

export async function forgotPassword(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    if (!supabase) {
      console.error('Forgot password misconfiguration:', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseAnonKey: Boolean(supabaseAnonKey),
      });
      return res.status(500).json({
        message: 'Supabase environment variables are missing on the backend.',
      });
    }

    const clientUrl = buildClientUrl(req);
    if (!clientUrl) {
      console.error('Forgot password missing CLIENT_URL and no usable origin/referer header.');
      return res.status(500).json({
        message: 'CLIENT_URL is missing on the backend.',
      });
    }

    const redirectTo = `${clientUrl}/update-password.html`;

    console.log('Forgot password requested for:', email, 'redirectTo:', redirectTo);

    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 10000);
    });

    const supabaseCall = supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    const { error } = await Promise.race([supabaseCall, timeout]);

    if (error) {
      console.error('Supabase forgot password error:', {
        message: error.message,
        status: error.status,
        name: error.name,
        redirectTo,
      });

      return res.status(502).json({
        message: 'Failed to send reset email.',
        details: error.message || 'Unknown Supabase error.',
      });
    }

    return res.json({
      message: 'Se o e-mail existir, o link de recuperação foi enviado.',
      redirectTo,
    });
  } catch (err) {
    console.error('Forgot password crash:', err);

    if (err.message === 'Timeout') {
      return res.status(504).json({
        message: 'Password reset request timed out while waiting for Supabase.',
      });
    }

    return res.status(500).json({
      message: err.message || 'Server error.',
    });
  }
}
