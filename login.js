const loginForm = document.getElementById('loginForm');
const loginMensagem = document.getElementById('loginMensagem');

function setLoginMessage(text, color) {
  if (!loginMensagem) return;
  loginMensagem.textContent = text;
  loginMensagem.style.color = color;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirmSession(retries = 2, delay = 300) {
  let lastError = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await window.physioApi.me();
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        await wait(delay);
      }
    }
  }

  return null;
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const senha = document.getElementById('loginSenha').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    if (submitBtn) submitBtn.disabled = true;
    setLoginMessage('Entrando...', '#2563eb');

    try {
      await window.physioApi.login(email, senha);

      // Try to confirm the session, but do not block the user forever if /auth/me is slow.
      await confirmSession();

      setLoginMessage('Login realizado com sucesso!', '#166534');

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    } catch (error) {
      const message = error?.message || 'Erro ao fazer login.';
      setLoginMessage(message, '#b91c1c');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
