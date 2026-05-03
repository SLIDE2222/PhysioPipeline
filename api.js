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

  function getStoredAuth() {
    try {
      return (
        JSON.parse(localStorage.getItem('physioAuth') || 'null') ||
        JSON.parse(sessionStorage.getItem('physioAuth') || 'null')
      );
    } catch (_) {
      return null;
    }
  }

  function setStoredAuth(auth, remember = true) {
    try {
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem('physioAuth', JSON.stringify(auth));
    } catch (_) {
      // ignore storage access issues
    }
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeoutMs = Number(options.timeoutMs || REQUEST_TIMEOUT_MS);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const auth = getStoredAuth();
      const token = auth?.token;

      const response = await fetch(`${API_BASE}${path}`, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    async register(payload) {
      const data = await request('/auth/register', { method: 'POST', body: payload });
      if (data?.token) {
        setStoredAuth({ token: data.token, user: data.user }, true);
      }
      return data;
    },
    async login(email, password) {
      const data = await request('/auth/login', { method: 'POST', body: { email, password } });
      if (data?.token) {
        setStoredAuth({ token: data.token, user: data.user }, true);
      }
      return data;
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
    updateMyProfile(payload) {
      return request('/profiles/me', {
        method: 'PUT',
        body: payload,
        timeoutMs: 20000,
      }).then((data) => normalizeProfile(data.profile || data));
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
    getStoredAuth,
    setStoredAuth,
    clearStoredAuth,
    updatePassword({ token, password }) {
      return request('/auth/update-password', {
        method: 'POST',
        body: { accessToken: token, token, password },
      });
    },
  };
})();
