const resetForm = document.getElementById('resetForm');
const resetMensagem = document.getElementById('resetMensagem');

function setResetMessage(text, color) {
  if (!resetMensagem) return;
  resetMensagem.textContent = text;
  resetMensagem.style.color = color;
}

function getFriendlyResetError(error) {
  const rawMessage = String(error?.message || '').trim();

  if (!rawMessage) {
    return 'Não foi possível enviar o link de recuperação.';
  }

  if (/demorou demais|timed out|timeout/i.test(rawMessage)) {
    return 'A solicitação demorou demais. Confira se o backend e o Supabase estão respondendo e tente novamente.';
  }

  if (/conectar ao servidor|failed to fetch|networkerror/i.test(rawMessage)) {
    return 'Não foi possível conectar ao servidor. Verifique a URL da API, o CORS e se o backend está online.';
  }

  return rawMessage;
}

if (resetForm) {
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('resetEmail');
    const email = emailInput?.value.trim().toLowerCase() || '';
    const submitBtn = resetForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';

    if (!email) {
      setResetMessage('Digite um e-mail válido.', '#b91c1c');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
    }

    setResetMessage('Enviando link...', '#2563eb');

    try {
      if (!window.physioApi || typeof window.physioApi.requestPasswordReset !== 'function') {
        throw new Error('API de recuperação não está disponível. Confira se api.js carregou corretamente.');
      }

      const response = await window.physioApi.requestPasswordReset(email);
      const successMessage =
        response?.message ||
        'Se o e-mail existir, o link de recuperação foi enviado.';

      setResetMessage(successMessage, '#166534');
      resetForm.reset();
    } catch (error) {
      console.error('Erro ao solicitar recuperação de senha:', error);
      setResetMessage(getFriendlyResetError(error), '#b91c1c');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText || 'Enviar link de recuperação';
      }
    }
  });
}
