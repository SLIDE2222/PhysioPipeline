const resetForm = document.getElementById('resetForm');
const resetMensagem = document.getElementById('resetMensagem');

function setResetMessage(text, color) {
  if (!resetMensagem) return;
  resetMensagem.textContent = text;
  resetMensagem.style.color = color;
}

if (resetForm) {
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('resetEmail').value.trim().toLowerCase();
    const submitBtn = resetForm.querySelector('button[type="submit"]');

    if (submitBtn) submitBtn.disabled = true;
    setResetMessage('Enviando link...', '#2563eb');

    try {
      if (!window.physioApi || typeof window.physioApi.requestPasswordReset !== 'function') {
        throw new Error('API de recuperação não está disponível.');
      }

      await window.physioApi.requestPasswordReset(email);

      setResetMessage('Se o e-mail existir, o link de recuperação foi enviado.', '#166534');
      resetForm.reset();
    } catch (error) {
      setResetMessage(
        error.message || 'Não foi possível enviar o link de recuperação.',
        '#b91c1c'
      );
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
