import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const publicAppUrl = process.env.PUBLIC_APP_URL || 'https://physio-pipeline.vercel.app';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Informe um e-mail válido.' });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicAppUrl}/update-password.html`,
    });

    if (error) {
      return res.status(400).json({ message: error.message || 'Não foi possível enviar o e-mail.' });
    }

    return res.json({ message: 'Se o e-mail existir, o link de recuperação foi enviado.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Erro interno ao processar recuperação.' });
  }
});

router.post('/update-password', async (req, res) => {
  try {
    const accessToken = String(req.body?.accessToken || req.body?.token || '').trim();
    const password = String(req.body?.password || '');

    if (!accessToken || !password) {
      return res.status(400).json({ message: 'Token e nova senha são obrigatórios.' });
    }

    const scopedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { error } = await scopedSupabase.auth.updateUser({ password });

    if (error) {
      return res.status(400).json({ message: error.message || 'Não foi possível atualizar a senha.' });
    }

    return res.json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Erro interno ao atualizar senha.' });
  }
});

export default router;
