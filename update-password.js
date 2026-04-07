const updatePasswordForm = document.getElementById('updatePasswordForm');
const updatePasswordMensagem = document.getElementById('updatePasswordMensagem');

function getResetTokenFromUrl() {
  const queryParams = new URLSearchParams(window.location.search);
  const queryToken = queryParams.get('token');
  if (queryToken) return queryToken;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return hashParams.get('access_token') || hashParams.get('token') || '';
}

function setUpdatePasswordMessage(text, color) {
  if (!updatePasswordMensagem) return;
  updatePasswordMensagem.textContent = text;
  updatePasswordMensagem.style.color = color;
}

if (updatePasswordForm) {
  updatePasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const password = document.getElementById('novaSenha').value;
    const confirmPassword = document.getElementById('confirmarNovaSenha').value;
    const token = getResetTokenFromUrl();
    const submitBtn = updatePasswordForm.querySelector('button[type="submit"]');

    if (!token) {
      setUpdatePasswordMessage('Token inválido ou ausente.', '#b91c1c');
      return;
    }

    if (password.length < 6) {
      setUpdatePasswordMessage('A senha precisa ter pelo menos 6 caracteres.', '#b91c1c');
      return;
    }

    if (password !== confirmPassword) {
      setUpdatePasswordMessage('As senhas não conferem.', '#b91c1c');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setUpdatePasswordMessage('Atualizando senha...', '#2563eb');

    try {
      await window.physioApi.updatePassword({ token, password });
      if (window.physioApi && typeof window.physioApi.clearStoredAuth === 'function') {
        window.physioApi.clearStoredAuth();
      }

      setUpdatePasswordMessage('Senha atualizada com sucesso! Agora faça login com a nova senha.', '#166534');

      setTimeout(() => {
        window.location.href = 'login.html?reset=success';
      }, 1400);
    } catch (error) {
      setUpdatePasswordMessage(error.message || 'Não foi possível atualizar a senha.', '#b91c1c');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
