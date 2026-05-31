(function () {
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
          id: data?.user?.id || null,
          email: data?.user?.email || '',
          accountType,
          name: data?.user?.name || '',
          emailVerified: Boolean(data?.user?.emailVerified),
          profiles: profileId ? [{ id: profileId }] : [],
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
    if (!clientId || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });

    document.querySelectorAll('[data-google-auth]').forEach((container) => {
      if (container.classList.contains('google-hidden-render')) return;
      const width = Number(container.dataset.width || 400);
      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: Math.min(Math.max(width, 240), 400),
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
