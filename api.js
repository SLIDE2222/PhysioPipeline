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
  const PUBLIC_PROFILE_CACHE_KEY = 'physioPublicProfiles:v1';
  const DYNAMIC_OPTIONS_CACHE_KEY = 'physioDynamicOptions:v1';
  const PUBLIC_PROFILE_CACHE_TTL_MS = 1000 * 60 * 3;
  const SUPABASE_URL =
    window.PHYSIO_SUPABASE_URL ||
    'https://epptihpvgwzrodfsukpr.supabase.co';
  const SUPABASE_ANON_KEY =
    window.PHYSIO_SUPABASE_ANON_KEY ||
    'sb_publishable_QNqv1waCxDu2z2vprYM62w_zkhrafGH';
  const PUBLIC_PROFILE_SELECT = [
    'id',
    'name',
    'specialty',
    'secondarySpecialty',
    'city',
    'neighborhood',
    'phone',
    'bio',
    'instagram',
    'linkedin',
    'photoUrl',
    'attendance',
    'isClaimed',
    'createdAt',
    'updatedAt',
  ].join(',');
  const PUBLIC_PROFILE_SOURCES = ['public_profiles', 'Profile'];

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
      const serializedAuth = JSON.stringify(auth);
      localStorage.setItem('physioAuth', serializedAuth);
      sessionStorage.setItem('physioAuth', serializedAuth);
    } catch (_) {
      // ignore storage access issues
    }
  }

  function isSupabasePublicConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  function readPublicProfileCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(PUBLIC_PROFILE_CACHE_KEY) || 'null');
      if (!cached?.profiles || !cached?.savedAt) return null;

      if (Date.now() - cached.savedAt > PUBLIC_PROFILE_CACHE_TTL_MS) {
        sessionStorage.removeItem(PUBLIC_PROFILE_CACHE_KEY);
        return null;
      }

      return cached.profiles;
    } catch (_) {
      return null;
    }
  }

  function writePublicProfileCache(profiles) {
    try {
      sessionStorage.setItem(
        PUBLIC_PROFILE_CACHE_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          profiles,
        })
      );
    } catch (_) {
      // ignore storage access issues
    }
  }

  function clearPublicProfileCache() {
    try {
      sessionStorage.removeItem(PUBLIC_PROFILE_CACHE_KEY);
      sessionStorage.removeItem(DYNAMIC_OPTIONS_CACHE_KEY);
    } catch (_) {
      // ignore storage access issues
    }
  }

  async function supabasePublicRequest(resource, query = '') {
    if (!isSupabasePublicConfigured()) {
      throw new Error('Supabase public client is not configured.');
    }

    const path = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${resource}${query ? `?${query}` : ''}`;
    const response = await fetch(path, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `Supabase request failed with status ${response.status}.`);
    }

    return response.json();
  }

  async function fetchPublicProfilesFromSupabase({ useCache = true } = {}) {
    if (useCache) {
      const cached = readPublicProfileCache();
      if (cached) return cached.map(normalizeProfile);
    }

    const query = [
      `select=${encodeURIComponent(PUBLIC_PROFILE_SELECT)}`,
      'order=createdAt.desc',
      'limit=1000',
    ].join('&');

    let lastError = null;

    for (const source of PUBLIC_PROFILE_SOURCES) {
      try {
        const rows = await supabasePublicRequest(source, query);
        const profiles = (rows || []).map(normalizeProfile).filter(Boolean);
        writePublicProfileCache(profiles);
        return profiles;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Could not load public profiles from Supabase.');
  }

  async function fetchPublicProfileFromSupabase(id) {
    if (!id) return null;

    const safeId = String(id).replace(/"/g, '');
    const query = [
      `select=${encodeURIComponent(PUBLIC_PROFILE_SELECT)}`,
      `id=eq.${encodeURIComponent(safeId)}`,
      'limit=1',
    ].join('&');

    let lastError = null;

    for (const source of PUBLIC_PROFILE_SOURCES) {
      try {
        const rows = await supabasePublicRequest(source, query);
        return normalizeProfile(rows?.[0] || null);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Could not load public profile from Supabase.');
  }

  function buildProfileOptionsFromProfiles(profiles) {
    const clean = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const getKey = (value) =>
      clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const dedupeSort = (values) => {
      const seen = new Set();

      return values
        .map(clean)
        .filter((value) => value && value !== '-')
        .filter((value) => {
          const key = getKey(value);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    };

    const neighborhoodsByCity = {};

    profiles.forEach((profile) => {
      const city = clean(profile.cidade || profile.city);
      const neighborhood = clean(profile.bairro || profile.neighborhood);
      if (!city || !neighborhood || city === '-' || neighborhood === '-') return;

      if (!neighborhoodsByCity[city]) neighborhoodsByCity[city] = [];
      neighborhoodsByCity[city].push(neighborhood);
    });

    Object.keys(neighborhoodsByCity).forEach((city) => {
      neighborhoodsByCity[city] = dedupeSort(neighborhoodsByCity[city]);
    });

    return {
      cities: dedupeSort(profiles.map((profile) => profile.cidade || profile.city)),
      neighborhoods: dedupeSort(profiles.map((profile) => profile.bairro || profile.neighborhood)),
      neighborhoodsByCity,
      specialties: dedupeSort(
        profiles.flatMap((profile) => [
          profile.especialidade || profile.specialty,
          profile.especialidadeSecundaria || profile.secondarySpecialty,
        ])
      ),
    };
  }


  function decodeBase64Url(value) {
    const base64 = String(value || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );

    const binary = atob(paddedBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  }

  function restoreAuthFromHash() {
    try {
      const hash = window.location.hash || '';
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const packedAuth = params.get('auth');

      if (!packedAuth) return;

      const decoded = JSON.parse(decodeBase64Url(packedAuth));

      if (decoded?.token) {
        setStoredAuth(
          {
            token: decoded.token,
            user: decoded.user || null,
          },
          true
        );
      }

      params.delete('auth');
      const cleanHash = params.toString();
      const cleanUrl =
        window.location.pathname +
        window.location.search +
        (cleanHash ? `#${cleanHash}` : '');

      window.history.replaceState({}, document.title, cleanUrl);
    } catch (error) {
      console.warn('Could not restore auth from URL hash:', error);
    }
  }

  restoreAuthFromHash();

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
      especialidadeSecundaria: profile.secondarySpecialty ?? profile.especialidadeSecundaria ?? '',
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
    getStoredAuth,
    setStoredAuth,
    clearStoredAuth,

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
    async loginWithGoogle(credential) {
      const data = await request('/auth/google', {
        method: 'POST',
        body: { credential },
        timeoutMs: 15000,
      });

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
    async fetchProfiles(options = {}) {
      try {
        return await fetchPublicProfilesFromSupabase(options);
      } catch (error) {
        console.warn('Using Render fallback for public profiles:', error);
        return request('/profiles').then((data) =>
          (data.profiles || data || []).map(normalizeProfile)
        );
      }
    },
    createProfile(payload) {
      return request('/profiles', {
        method: 'POST',
        body: payload,
        timeoutMs: 20000,
      }).then((data) => {
        clearPublicProfileCache();
        const profile = normalizeProfile(data.profile || data);

        try {
          const auth = getStoredAuth();
          if (auth?.user && profile?.id) {
            setStoredAuth({
              ...auth,
              user: {
                ...auth.user,
                profiles: [{ id: profile.id }],
              },
            }, true);
          }
        } catch (_) {
          // ignore storage sync issues
        }

        return profile;
      });
    },
    updateMyProfile(payload) {
      return request('/profiles/me', {
        method: 'PUT',
        body: payload,
        timeoutMs: 20000,
      }).then((data) => {
        clearPublicProfileCache();
        return normalizeProfile(data.profile || data);
      });
    },
    async fetchProfile(id) {
      try {
        const profile = await fetchPublicProfileFromSupabase(id);
        if (profile) return profile;
      } catch (error) {
        console.warn('Using Render fallback for public profile:', error);
      }

      return request(`/profiles/${id}`).then((data) =>
        normalizeProfile(data.profile || data)
      );
    },
    async fetchProfileOptions(options = {}) {
      try {
        const profiles = await fetchPublicProfilesFromSupabase({
          useCache: options.useCache ?? false,
        });
        return buildProfileOptionsFromProfiles(profiles);
      } catch (error) {
        console.warn('Using Render fallback for profile options:', error);
        return request('/profiles/options', {
          timeoutMs: 10000,
        });
      }
    },
    recordLeadEvent(payload) {
      return request('/lead-events', {
        method: 'POST',
        body: payload,
        timeoutMs: 5000,
      }).catch((error) => {
        console.warn('Could not record lead event:', error);
        return null;
      });
    },
    fetchMyLeadSummary() {
      return request('/lead-events/me/summary');
    },
    sendContactMessage(payload) {
      return request('/contact', {
        method: 'POST',
        body: payload,
        timeoutMs: 30000,
      });
    },
    requestPasswordReset(email) {
      return request('/auth/forgot-password', {
        method: 'POST',
        body: { email },
        timeoutMs: 45000,
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


window.debugPhysioAuth = function () {
  try {
    return {
      localStorageAuth: localStorage.getItem('physioAuth'),
      sessionStorageAuth: sessionStorage.getItem('physioAuth'),
      physioApiAuth: window.physioApi?.getStoredAuth?.() || null,
      url: window.location.href,
    };
  } catch (error) {
    return { error: error.message };
  }
};
