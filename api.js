(function () {
  const API_BASE = window.PHYSIO_API_BASE || 'http://localhost:3000';

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
      return request('/auth/me');
    },
    fetchMyProfile() {
      return request('/profiles/me').then((data) => normalizeProfile(data.profile));
    },
    fetchProfile(id) {
      return request(`/profiles/${id}`).then((data) => normalizeProfile(data.profile || data));
    },
    normalizeProfile,
    clearStoredAuth,
    updatePassword({ token, password }) {
      return request('/auth/update-password', {
        method: 'POST',
        body: { token, password },
      });
    },
  };
})();
