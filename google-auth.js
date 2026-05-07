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

      await window.physioApi.loginWithGoogle(response.credential);
      showMessage('Login com Google realizado com sucesso.', '#166534');
      setTimeout(() => {
        window.location.href = 'cadastro.html';
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
