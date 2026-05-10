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
    });

    document.querySelectorAll('[data-google-auth]').forEach((container) => {
      // Render the real Google button. Mobile browsers are less cursed with the official button.
      container.classList.remove('google-hidden-render');
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
