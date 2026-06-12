(function () {
  let initAttempts = 0;

  function getClientId() {
    return document.querySelector('meta[name="google-client-id"]')?.content?.trim() || '';
  }

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


  function encodeBase64Url(value) {
    const bytes = new TextEncoder().encode(String(value || ''));
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  function getSelectedAccountType() {
    const selected = document.querySelector('input[name="accountType"]:checked');
    return window.PhysioAccountTypes?.normalizeAccountType
      ? window.PhysioAccountTypes.normalizeAccountType(selected?.value)
      : 'physio';
  }

  async function handleCredentialResponse(response) {
    try {
      if (!response?.credential) {
        showMessage('Não foi possível receber a credencial do Google.');
        return;
      }

      const data = await window.physioApi.loginWithGoogle(
        response.credential,
        getSelectedAccountType()
      );

      if (!data?.token) {
        showMessage('Login recebido, mas o token não veio do servidor.', '#b91c1c');
        return;
      }

      const profileId = data?.user?.profiles?.[0]?.id || null;
      const accountType = window.PhysioAccountTypes?.normalizeAccountType
        ? window.PhysioAccountTypes.normalizeAccountType(data?.user?.accountType)
        : 'physio';

      const authPayload = {
        token: data.token,
        user: {
          ...(data?.user || {}),
          id: data?.user?.id || null,
          email: data?.user?.email || '',
          accountType,
          name: data?.user?.name || '',
          emailVerified: Boolean(data?.user?.emailVerified),
          profiles: profileId ? [{ id: profileId }] : [],
          clinicProfile: data?.user?.clinicProfile || null,
          clinicProfileId: data?.user?.clinicProfileId || data?.user?.clinicProfile?.id || null,
        },
      };

      try {
        window.physioApi.setStoredAuth?.(authPayload, true);
        localStorage.setItem('physioAuth', JSON.stringify(authPayload));
        sessionStorage.setItem('physioAuth', JSON.stringify(authPayload));
      } catch (_) {
        // ignore storage write issues
      }

      showMessage('Login com Google realizado com sucesso.', '#166534');

      const packedAuth = encodeBase64Url(JSON.stringify(authPayload));

      setTimeout(() => {
        const targetPath = window.physioApi?.resolveUserHomePath?.(authPayload.user) || 'profile.html';
        window.location.href = profileId || accountType === 'clinic'
          ? `${targetPath}#auth=${packedAuth}`
          : `cadastro.html?completeProfile=true#auth=${packedAuth}`;
      }, 600);
    } catch (error) {
      showMessage(error.message || 'Não foi possível entrar com Google.');
    }
  }

  function initGoogleAuth() {
    const clientId = getClientId();
    if (!clientId) return;

    if (!window.google?.accounts?.id) {
      initAttempts += 1;
      if (initAttempts <= 20) window.setTimeout(initGoogleAuth, 250);
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });

    document.querySelectorAll('[data-google-auth]').forEach((container) => {
      const customButton = container.closest('.google-auth-card')?.querySelector('.google-full-btn');
      const measuredWidth = customButton?.offsetWidth || Number(container.dataset.width || 400);
      const width = Number(container.dataset.width || measuredWidth || 400);

      container.innerHTML = '';
      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: Math.min(Math.max(width, 240), 400),
      });

      container.addEventListener('click', () => {
        window.google.accounts.id.prompt();
      });
    });

    const customButton = document.getElementById('googleSignupButton');
    if (customButton) {
      customButton.addEventListener('click', () => {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
            const hiddenHost = document.querySelector('[data-google-auth]:not(.google-hidden-render)');
            const iframe = hiddenHost?.querySelector('iframe');
            if (iframe) iframe.focus();
          }
        });
      });
    }
  }

  window.addEventListener('load', initGoogleAuth);
})();
