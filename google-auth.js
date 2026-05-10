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

  async function handleCredentialResponse(response) {
    try {
      if (!response?.credential) {
        showMessage('Não foi possível receber a credencial do Google.');
        return;
      }

      const data = await window.physioApi.loginWithGoogle(response.credential);

      if (data?.token) {
        const authPayload = { token: data.token, user: data.user };

        try {
          window.physioApi.setStoredAuth?.(authPayload, true);
          localStorage.setItem('physioAuth', JSON.stringify(authPayload));
          sessionStorage.setItem('physioAuth', JSON.stringify(authPayload));
        } catch (_) {
          // ignore storage write issues
        }
      }

      showMessage('Login com Google realizado com sucesso.', '#166534');

      const profileId = data?.user?.profiles?.[0]?.id;
      setTimeout(() => {
        window.location.href = profileId
          ? `profile.html?id=${encodeURIComponent(profileId)}`
          : 'cadastro.html?completeProfile=true';
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
        showMessage('Abrindo login com Google...', '#2563eb');

        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
            showMessage('Se o Google não abrir no celular, entre com e-mail e senha por enquanto.', '#b45309');
          }
        });
      });
    }
  }

  window.addEventListener('load', initGoogleAuth);
})();
