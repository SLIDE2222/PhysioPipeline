(function () {
  function showMessage(text, color = '#b91c1c') {
    const targets = [
      document.getElementById('cadastroMensagem'),
      document.getElementById('loginMensagem'),
    ].filter(Boolean);

    targets.forEach((el) => {
      el.textContent = text;
      el.style.color = color;
    });
  }

  function getSelectedAccountType() {
    const selected = document.querySelector('input[name="accountType"]:checked');
    return window.PhysioAccountTypes?.normalizeAccountType
      ? window.PhysioAccountTypes.normalizeAccountType(selected?.value)
      : 'physio';
  }

  function getSupabaseOAuthClient() {
    const client = window.supabaseClient;

    console.log('Supabase library:', window.supabase);
    console.log('Supabase client:', client);
    console.log('Google OAuth client auth:', client?.auth);

    if (!client?.auth?.signInWithOAuth) {
      console.error('Google OAuth client auth is not available. Check Supabase CDN, supabase-client.js, and script order.');
      showMessage('Google ainda está carregando. Tente novamente em alguns segundos.');
      return null;
    }

    return client;
  }

  async function startGoogleOAuth() {
    console.log('Starting Google OAuth');

    const client = getSupabaseOAuthClient();
    if (!client) return;

    try {
      sessionStorage.setItem('pendingGoogleAccountType', getSelectedAccountType());
    } catch (_) {
      // Account type persistence is best-effort; OAuth can still continue.
    }

    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth-callback.html`,
      },
    });

    console.log('Google OAuth response:', { data, error });

    if (error) {
      console.error('OAuth error:', error.message, error);
      showMessage(error.message || 'Não foi possível iniciar o login com Google.');
    }
  }

  function bindGoogleButton() {
    const googleBtn =
      document.getElementById('googleSignupButton') ||
      document.getElementById('googleLoginBtn') ||
      document.querySelector('[data-google-auth-trigger]');

    if (!googleBtn) {
      console.warn('Google button not found');
      return;
    }

    console.log('Google button found');

    if ('type' in googleBtn) googleBtn.type = 'button';
    if (googleBtn.dataset.googleAuthBound === 'true') return;

    googleBtn.dataset.googleAuthBound = 'true';

    googleBtn.addEventListener('click', (event) => {
      event.preventDefault();
      console.log('Google button clicked');

      startGoogleOAuth().catch((error) => {
        console.error('OAuth error:', error);
        showMessage(error.message || 'Não foi possível iniciar o login com Google.');
      });
    });
  }

  function initGoogleAuth() {
    bindGoogleButton();
  }

  window.PhysioGoogleAuth = {
    init: initGoogleAuth,
    start: startGoogleOAuth,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoogleAuth);
  } else {
    initGoogleAuth();
  }

  window.addEventListener('load', initGoogleAuth);
  window.setTimeout(initGoogleAuth, 500);
})();
