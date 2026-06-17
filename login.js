const loginForm = document.getElementById('loginForm');
const loginMensagem = document.getElementById('loginMensagem');
const ACCOUNT_TYPE_STORAGE_KEY = 'accountType';

function setLoginMessage(text, color) {
  if (!loginMensagem) return;
  loginMensagem.textContent = text;
  loginMensagem.style.color = color;
}

function normalizeLoginAccountType(value) {
  return window.PhysioAccountTypes?.normalizeAccountType
    ? window.PhysioAccountTypes.normalizeAccountType(value)
    : String(value || 'physio').trim().toLowerCase() === 'clinic'
      ? 'clinic'
      : 'physio';
}

function getSelectedLoginAccountType() {
  const selected = document.querySelector('input[name="accountType"]:checked');
  return normalizeLoginAccountType(
    selected?.value ||
    localStorage.getItem(ACCOUNT_TYPE_STORAGE_KEY) ||
    'physio'
  );
}

function persistSelectedLoginAccountType(value) {
  const normalized = normalizeLoginAccountType(value);
  localStorage.setItem(ACCOUNT_TYPE_STORAGE_KEY, normalized);
  console.log('Selected account type', normalized);
  return normalized;
}

function syncLoginAccountTypeSelection() {
  const storedAccountType = normalizeLoginAccountType(
    localStorage.getItem(ACCOUNT_TYPE_STORAGE_KEY) || 'physio'
  );
  const selectedInput = document.querySelector(`input[name="accountType"][value="${storedAccountType}"]`);
  if (selectedInput) selectedInput.checked = true;
  persistSelectedLoginAccountType(storedAccountType);
}

function resolveLoginRedirect(user, selectedAccountType) {
  const normalizedSelectedType = normalizeLoginAccountType(selectedAccountType);
  const clinicProfileId = user?.clinicProfile?.id || user?.clinicProfileId || null;
  const physioProfileId = user?.profiles?.[0]?.id || user?.profile?.id || null;

  const targetPath = normalizedSelectedType === 'clinic' && clinicProfileId
    ? `profile.html?type=clinic&id=${encodeURIComponent(clinicProfileId)}`
    : normalizedSelectedType === 'physio' && physioProfileId
      ? `profile.html?id=${encodeURIComponent(physioProfileId)}`
      : window.physioApi.resolveUserHomePath(user) || 'index.html';

  console.log('Existing clinic found', user?.clinicProfile || null);
  console.log('Existing physio found', user?.profiles?.[0] || user?.profile || null);
  console.log('Redirect destination', targetPath);

  return targetPath;
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

document
  .querySelectorAll('input[name="accountType"]')
  .forEach((input) => {
    input.addEventListener('change', () => {
      persistSelectedLoginAccountType(input.value);
    });
  });

syncLoginAccountTypeSelection();

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const senha = document.getElementById('loginSenha').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    if (submitBtn) submitBtn.disabled = true;
    setLoginMessage('Entrando...', '#2563eb');

    try {
      const selectedAccountType = persistSelectedLoginAccountType(getSelectedLoginAccountType());
      const data = await window.physioApi.login(email, senha);

      // Try to confirm the session, but do not block the user forever if /auth/me is slow.
      await confirmSession();

      setLoginMessage('Login realizado com sucesso!', '#166534');

      setTimeout(() => {
        window.location.href = resolveLoginRedirect(data?.user, selectedAccountType);
      }, 500);
    } catch (error) {
      const message = error?.message || 'Erro ao fazer login.';
      setLoginMessage(message, '#b91c1c');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
