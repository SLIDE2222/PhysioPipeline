const resetForm = document.getElementById('resetForm');
const resetMensagem = document.getElementById('resetMensagem');

async function fallbackRequestPasswordReset(email) {
  const apiBase = window.PHYSIO_API_BASE || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3000' : 'https://physiopipeline.onrender.com');
  const response = await fetch(`${apiBase}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : {};

  if (!response.ok) {
    throw new Error(data.message || 'Não foi possível enviar o link de recuperação.');
  }

  return data;
}

if (resetForm) {
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('resetEmail').value.trim().toLowerCase();
    const submitBtn = resetForm.querySelector('button[type="submit"]');

    if (submitBtn) submitBtn.disabled = true;
    resetMensagem.textContent = 'Enviando link...';
    resetMensagem.style.color = '#2563eb';

    try {
      const api = window.physioApi;
      if (api && typeof api.requestPasswordReset === 'function') {
        await api.requestPasswordReset(email);
      } else {
        await fallbackRequestPasswordReset(email);
      }

      resetMensagem.textContent = 'Link de recuperação enviado com sucesso.';
      resetMensagem.style.color = '#166534';
      resetForm.reset();
    } catch (error) {
      resetMensagem.textContent = error.message || 'Não foi possível enviar o link de recuperação.';
      resetMensagem.style.color = '#b91c1c';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}