(function () {
  const isLocalHost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  const API_BASE =
    window.PHYSIO_API_BASE ||
    (isLocalHost
      ? 'http://localhost:3000'
      : 'https://physiopipeline-2.onrender.com');

  const REQUEST_TIMEOUT_MS = 15000;

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeoutMs = Number(options.timeoutMs || REQUEST_TIMEOUT_MS);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        credentials: 'include',
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 204) {
        return {};
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || 'Request failed.');
        error.status = response.status;
        error.code = data.code;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('A requisição demorou demais. Verifique se o backend está online e tente novamente.');
      }

      if (error instanceof TypeError) {
        throw new Error('Não foi possível conectar ao servidor. Confira a URL da API, CORS e se o backend está no ar.');
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function normalizeProfile(profile) {
    if (!profile) return null;
    return {
      ...profile,
      id: profile.id,
      nome: profile.name ?? profile.nome ?? '',
      especialidade: profile.specialty ?? profile.especialidade ?? '',
      cidade: profile.city ?? profile.cidade ?? '',
      bairro: profile.neighborhood ?? profile.bairro ?? '',
      telefone: profile.phone ?? profile.telefone ?? '',
      descricao: profile.bio ?? profile.descricao ?? '',
      instagram: profile.instagram ?? '',
      linkedin: profile.linkedin ?? '',
      foto: profile.photoUrl ?? profile.foto ?? '',
      email: profile.publicEmail ?? profile.email ?? '',
      atendimento: profile.attendance ?? profile.atendimento ?? '',
      isClaimed: Boolean(profile.isClaimed),
      ownerUserId: profile.ownerUserId ?? null,
    };
  }

  function clearStoredAuth() {
    try {
      localStorage.removeItem('physioAuth');
      sessionStorage.removeItem('physioAuth');
    } catch (_) {
      // ignore storage access issues
    }
  }

  window.physioApi = {
    request,
    register(payload) {
      return request('/auth/register', { method: 'POST', body: payload });
    },
    login(email, password) {
      return request('/auth/login', { method: 'POST', body: { email, password } });
    },
    logout() {
      clearStoredAuth();
      return request('/auth/logout', { method: 'POST' });
    },
    me() {
      return request('/auth/me', { timeoutMs: 5000 });
    },
    fetchMyProfile() {
      return request('/profiles/me').then((data) => normalizeProfile(data.profile));
    },
    fetchProfile(id) {
      return request(`/profiles/${id}`).then((data) =>
        normalizeProfile(data.profile || data)
      );
    },
    requestPasswordReset(email) {
      return request('/auth/forgot-password', {
        method: 'POST',
        body: { email },
        timeoutMs: 12000,
      });
    },
    normalizeProfile,
    clearStoredAuth,
    updatePassword({ token, password }) {
      return request('/auth/update-password', {
        method: 'POST',
        body: { accessToken: token, token, password },
      });
    },
  };
})();
