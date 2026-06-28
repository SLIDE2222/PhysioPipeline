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
  const PUBLIC_PROFILE_LIST_LIMIT = 500;
  const SUPABASE_URL =
    window.PHYSIO_SUPABASE_URL ||
    'https://epptihpvgwzrodfsukpr.supabase.co';
  const SUPABASE_ANON_KEY =
    window.PHYSIO_SUPABASE_ANON_KEY ||
    'sb_publishable_QNqv1waCxDu2z2vprYM62w_zkhrafGH';
  const PUBLIC_PROFILE_CARD_SELECT = [
    'id',
    'name',
    'specialty',
    'secondarySpecialty',
    'tertiarySpecialty',
    'city',
    'neighborhood',
    'bio',
    'photoUrl',
  ].join(',');
  const PUBLIC_PROFILE_DETAIL_SELECT = [
    'id',
    'name',
    'specialty',
    'secondarySpecialty',
    'tertiarySpecialty',
    'city',
    'neighborhood',
    'phone',
    'bio',
    'instagram',
    'linkedin',
    'photoUrl',
    'photos',
    'publicEmail',
    'attendance',
    'isClaimed',
    'ownerUserId',
  ].join(',');
  const PUBLIC_PROFILE_CARD_SOURCES = ['Profile', 'public_profiles', 'public_profile_cards'];
  const PUBLIC_PROFILE_DETAIL_SOURCES = ['Profile', 'public_profiles', 'public_profile_details'];
  const ACCOUNT_TYPES = window.PhysioAccountTypes?.ACCOUNT_TYPES || {
    PHYSIO: 'physio',
    CLINIC: 'clinic',
  };
  let publicProfileListMemoryCache = null;
  let publicProfileListInflight = null;

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
      const serializedAuth = JSON.stringify({
        ...auth,
        user: normalizeUser(auth?.user),
      });
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
    if (publicProfileListMemoryCache?.profiles?.length) {
      return publicProfileListMemoryCache.profiles;
    }

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
    publicProfileListMemoryCache = {
      savedAt: Date.now(),
      profiles,
    };

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
    publicProfileListMemoryCache = null;
    publicProfileListInflight = null;

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

  async function fetchPublicProfilesFromSupabase({ useCache = true, limit = PUBLIC_PROFILE_LIST_LIMIT } = {}) {
    const startedAt = performance.now();
    const timingLabel = `PhysioPipeline public profiles fetch ${Math.round(startedAt)}`;
    console.time(timingLabel);

    if (useCache) {
      const cached = readPublicProfileCache();
      if (cached) {
        console.info(`PhysioPipeline profiles: cache hit em ${Math.round(performance.now() - startedAt)}ms`);
        console.timeEnd(timingLabel);
        return cached.map(normalizeProfile);
      }

      if (publicProfileListInflight) {
        console.info('PhysioPipeline profiles: reutilizando busca em andamento');
        return publicProfileListInflight.then((profiles) => {
          console.timeEnd(timingLabel);
          return profiles.map(normalizeProfile);
        });
      }
    }

    const baseQuery = [
      `select=${encodeURIComponent(PUBLIC_PROFILE_CARD_SELECT)}`,
      `limit=${encodeURIComponent(String(limit))}`,
    ].join('&');
    const orderedQuery = `${baseQuery}&order=createdAt.desc`;

    const requestProfiles = async () => {
      let lastError = null;

      for (const source of PUBLIC_PROFILE_CARD_SOURCES) {
        for (const query of [orderedQuery, baseQuery]) {
          try {
            const sourceStartedAt = performance.now();
            const rows = await supabasePublicRequest(source, query);
            console.info(`PhysioPipeline profiles: ${source} carregou ${rows?.length || 0} perfis em ${Math.round(performance.now() - sourceStartedAt)}ms`);
            const profiles = (rows || []).map(normalizeProfile).filter(Boolean);
            writePublicProfileCache(profiles);
            console.info(`PhysioPipeline profiles: fetch total em ${Math.round(performance.now() - startedAt)}ms`);
            console.timeEnd(timingLabel);
            return profiles;
          } catch (error) {
            lastError = error;
            console.warn(`PhysioPipeline profiles: fonte ${source} falhou`, error);
          }
        }
      }

      console.timeEnd(timingLabel);
      throw lastError || new Error('Could not load public profiles from Supabase.');
    };

    publicProfileListInflight = requestProfiles().finally(() => {
      publicProfileListInflight = null;
    });

    return publicProfileListInflight;
  }

  async function fetchPublicProfileFromSupabase(id) {
    if (!id) return null;

    const safeId = String(id).replace(/"/g, '');
    const query = [
      `select=${encodeURIComponent(PUBLIC_PROFILE_DETAIL_SELECT)}`,
      `id=eq.${encodeURIComponent(safeId)}`,
      'limit=1',
    ].join('&');

    let lastError = null;

    for (const source of PUBLIC_PROFILE_DETAIL_SOURCES) {
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
        profiles.flatMap((profile) => {
          const explicitList = Array.isArray(profile.specialties)
            ? profile.specialties
            : Array.isArray(profile.especialidades)
              ? profile.especialidades
              : [];

          return [
            ...explicitList,
            profile.especialidade || profile.specialty,
            profile.especialidadeSecundaria || profile.secondarySpecialty,
            profile.especialidadeTerciaria || profile.tertiarySpecialty || profile.specialty2,
          ];
        })
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

      const responseText = await response.text().catch(() => '');
      const data = responseText
        ? (() => {
            try {
              return JSON.parse(responseText);
            } catch (_) {
              return { raw: responseText };
            }
          })()
        : {};

      if (!response.ok) {
        const rawText = typeof data?.raw === 'string' ? data.raw.trim() : '';
        const rawLooksLikeHtml = /^<!doctype html|^<html|<pre>/i.test(rawText);
        const rawLooksLikeExpressRouteMiss = /^Cannot\s+(GET|POST|PUT|PATCH|DELETE)\s+/i.test(rawText);
        const safeRawMessage = rawText && !rawLooksLikeHtml && !rawLooksLikeExpressRouteMiss
          ? rawText
          : '';
        const fallbackMessage = safeRawMessage || response.statusText || `Request failed with status ${response.status}.`;
        const error = new Error(data.message || fallbackMessage);
        error.status = response.status;
        error.code = data.code;
        error.data = data;
        error.responseText = responseText;
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

    const explicitSpecialties = Array.isArray(profile.specialties)
      ? profile.specialties
      : Array.isArray(profile.especialidades)
        ? profile.especialidades
        : parseJsonArrayString(profile.specialties) ||
          parseJsonArrayString(profile.especialidades) ||
          [];

    const mergedSpecialties = Array.from(
      new Map(
        [
          ...explicitSpecialties,
          profile.specialty,
          profile.especialidade,
          profile.secondarySpecialty,
          profile.secondary_specialties,
          profile.especialidadeSecundaria,
          profile.tertiarySpecialty,
          profile.specialty2,
          profile.especialidadeTerciaria,
        ]
          .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .map((item) => [
            item
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase(),
            item,
          ])
      ).values()
    );

    return {
      ...profile,
      id: profile.id,
      nome: profile.name ?? profile.nome ?? '',
      especialidade: profile.specialty ?? profile.especialidade ?? mergedSpecialties[0] ?? '',
      especialidadeSecundaria:
        profile.secondarySpecialty ??
        profile.secondary_specialties ??
        profile.especialidadeSecundaria ??
        mergedSpecialties[1] ??
        '',
      especialidadeTerciaria:
        profile.tertiarySpecialty ??
        profile.specialty2 ??
        profile.especialidadeTerciaria ??
        mergedSpecialties[2] ??
        '',
      specialty2:
        profile.tertiarySpecialty ??
        profile.specialty2 ??
        profile.especialidadeTerciaria ??
        mergedSpecialties[2] ??
        '',
      tertiarySpecialty:
        profile.tertiarySpecialty ??
        profile.specialty2 ??
        profile.especialidadeTerciaria ??
        mergedSpecialties[2] ??
        '',
      specialties: mergedSpecialties,
      especialidades: mergedSpecialties,
      cidade: profile.city ?? profile.cidade ?? '',
      bairro: profile.neighborhood ?? profile.bairro ?? '',
      telefone: profile.phone ?? profile.telefone ?? '',
      descricao: profile.bio ?? profile.descricao ?? '',
      instagram: profile.instagram ?? '',
      linkedin: profile.linkedin ?? '',
      photoUrl: buildAvatarPhotoPublicUrl(
        profile.photoUrl ?? profile.photo_url ?? profile.avatar_url ?? profile.foto ?? ''
      ),
      foto: buildAvatarPhotoPublicUrl(
        profile.photoUrl ?? profile.photo_url ?? profile.avatar_url ?? profile.foto ?? ''
      ),
      fotos: normalizeProfilePhotosList(profile.photosList ?? profile.fotos ?? profile.photos),
      photos: normalizeProfilePhotosList(profile.photosList ?? profile.fotos ?? profile.photos),
      photosList: normalizeProfilePhotosList(profile.photosList ?? profile.fotos ?? profile.photos),
      email: profile.publicEmail ?? profile.email ?? '',
      atendimento: profile.attendance ?? profile.atendimento ?? '',
      isClaimed: Boolean(profile.isClaimed),
      ownerUserId: profile.ownerUserId ?? null,
      linkedClinics: Array.isArray(profile.linkedClinics)
        ? profile.linkedClinics
        : Array.isArray(profile.clinicLinks)
          ? profile.clinicLinks
          : [],
    };
  }

  function parseJsonArrayString(value) {
    if (typeof value !== 'string') return null;

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function buildStoragePhotoPublicUrl(value, fallbackBucket = 'profile-gallery') {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    if (/^data:image\//i.test(normalized)) {
      return normalized;
    }

    try {
      const parsed = new URL(normalized);
      if (!/^https?:$/i.test(parsed.protocol)) return '';
      const fullPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (!/\.(jpg|jpeg|png|webp)(\?.*)?(#.*)?$/i.test(fullPath)) return '';
      return normalized;
    } catch (_) {
      if (!/\.(jpg|jpeg|png|webp)(\?.*)?(#.*)?$/i.test(normalized)) return '';

      const trimmed = normalized.replace(/^\/+/, '');
      const hasAvatarBucketPrefix = /^profile-images\//i.test(trimmed);
      const hasGalleryBucketPrefix = /^profile-gallery\//i.test(trimmed);
      const bucketName = hasAvatarBucketPrefix
        ? 'profile-images'
        : hasGalleryBucketPrefix
          ? 'profile-gallery'
          : fallbackBucket;
      const storagePath = (hasAvatarBucketPrefix || hasGalleryBucketPrefix)
        ? trimmed.replace(/^[^/]+\//, '')
        : trimmed;
      const safePath = storagePath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucketName}/${safePath}`;
    }
  }

  function buildAvatarPhotoPublicUrl(value) {
    return buildStoragePhotoPublicUrl(value, 'profile-images');
  }

  function buildGalleryPhotoPublicUrl(value) {
    return buildStoragePhotoPublicUrl(value, 'profile-gallery');
  }

  function normalizeProfilePhotosList(value) {
    const rawValues = Array.isArray(value)
      ? value
      : parseJsonArrayString(value) || String(value || '').split(/[\n,|]/);
    const seen = new Set();

    return rawValues
      .map((item) => buildGalleryPhotoPublicUrl(item))
      .filter(Boolean)
      .filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }

  function normalizeClinicServicesList(value) {
    const rawValues = Array.isArray(value)
      ? value
      : parseJsonArrayString(value) || String(value || '').split(/[,\n/|]/);
    const seen = new Set();

    return rawValues
      .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((item) => {
        const key = item
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function normalizeClinicTeamList(value) {
    const rawValues = Array.isArray(value) ? value : parseJsonArrayString(value) || [];
    const seen = new Set();

    return rawValues
      .map((item) => ({
        name: String(item?.name || '').replace(/\s+/g, ' ').trim(),
        specialty: String(item?.specialty || '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((item) => item.name && item.specialty)
      .filter((item) => {
        const key = `${item.name}::${item.specialty}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }

  function normalizeClinicProfile(clinic) {
    if (!clinic) return null;

    const servicesList = normalizeClinicServicesList(
      clinic.servicesList ??
      clinic.servicosLista ??
      clinic.specialties ??
      clinic.especialidades ??
      clinic.services ??
      clinic.servicos
    );
    const physioTeamList = normalizeClinicTeamList(
      clinic.physioTeamList ?? clinic.fisioterapeutas ?? clinic.physioTeam
    );
    const linkedPhysiotherapists = Array.isArray(clinic.linkedPhysiotherapists)
      ? clinic.linkedPhysiotherapists
      : Array.isArray(clinic.physiotherapistLinks)
        ? clinic.physiotherapistLinks
        : [];

    return {
      ...clinic,
      id: clinic.id,
      nome: clinic.clinicName ?? clinic.nome ?? '',
      nomeClinica: clinic.clinicName ?? clinic.nomeClinica ?? '',
      responsavel: clinic.responsibleName ?? clinic.responsavel ?? '',
      email: clinic.email ?? clinic.publicEmail ?? '',
      endereco: clinic.address ?? clinic.endereco ?? '',
      cidade: clinic.city ?? clinic.cidade ?? '',
      bairro: clinic.neighborhood ?? clinic.bairro ?? '',
      telefone: clinic.phone ?? clinic.telefone ?? '',
      whatsapp: clinic.whatsapp ?? '',
      instagram: clinic.instagram ?? '',
      servicos: servicesList.join(', '),
      servicosLista: servicesList,
      services: clinic.services ?? clinic.servicos ?? '',
      servicesList,
      fotos: normalizeProfilePhotosList(clinic.photosList ?? clinic.fotos ?? clinic.photos),
      photos: normalizeProfilePhotosList(clinic.photosList ?? clinic.fotos ?? clinic.photos),
      photosList: normalizeProfilePhotosList(clinic.photosList ?? clinic.fotos ?? clinic.photos),
      specialties: servicesList,
      especialidades: servicesList,
      fisioterapeutas: physioTeamList,
      physioTeamList,
      physioTeam: clinic.physioTeam ?? null,
      linkedPhysiotherapists,
      logoUrl: buildAvatarPhotoPublicUrl(clinic.logoUrl ?? clinic.logo ?? clinic.foto ?? ''),
      logo: buildAvatarPhotoPublicUrl(clinic.logoUrl ?? clinic.logo ?? clinic.foto ?? ''),
      descricao: clinic.description ?? clinic.descricao ?? '',
      userId: clinic.userId ?? null,
      isClaimable: typeof clinic.isClaimable === 'boolean' ? clinic.isClaimable : !clinic.userId,
      accountType: ACCOUNT_TYPES.CLINIC,
    };
  }

  function normalizeUser(user) {
    if (!user) return null;

    const inferredClinicProfile = user.clinicProfile ? normalizeClinicProfile(user.clinicProfile) : null;
    const accountType = window.PhysioAccountTypes?.normalizeAccountType
      ? window.PhysioAccountTypes.normalizeAccountType(user.accountType)
      : String(user.accountType || '').trim().toLowerCase() === ACCOUNT_TYPES.CLINIC
        ? ACCOUNT_TYPES.CLINIC
        : ACCOUNT_TYPES.PHYSIO;
    const resolvedAccountType =
      accountType === ACCOUNT_TYPES.CLINIC || inferredClinicProfile?.id || user.clinicProfileId
        ? ACCOUNT_TYPES.CLINIC
        : ACCOUNT_TYPES.PHYSIO;

    return {
      ...user,
      accountType: resolvedAccountType,
      isAdmin: Boolean(user.isAdmin),
      profiles: Array.isArray(user.profiles) ? user.profiles : [],
      clinicProfile: inferredClinicProfile,
    };
  }

  function normalizeProfileReview(review) {
    if (!review) return null;

    return {
      ...review,
      id: review.id,
      profileId: review.profileId,
      authorName: String(review.authorName || '').trim(),
      authorEmail: String(review.authorEmail || '').trim(),
      rating: Number(review.rating || 0) || null,
      title: String(review.title || '').trim(),
      body: String(review.body || '').trim(),
      status: String(review.status || "pending_admin").trim().toLowerCase(),
      reportReason: String(review.reportReason || '').trim(),
      reportedAt: review.reportedAt || null,
      moderatedAt: review.moderatedAt || null,
      createdAt: review.createdAt || null,
      updatedAt: review.updatedAt || null,
      profile: review.profile ? normalizeProfile(review.profile) : null,
    };
  }

  function getProfilePath(user) {
    const profileId = user?.profiles?.[0]?.id || user?.profile?.id || null;
    return profileId
      ? `profile.html?id=${encodeURIComponent(profileId)}`
      : 'profile.html';
  }

  function getClinicProfilePath(user) {
    const clinicProfileId = user?.clinicProfile?.id || user?.clinicProfileId || null;
    return clinicProfileId
      ? `profile.html?type=clinic&id=${encodeURIComponent(clinicProfileId)}`
      : 'profile.html';
  }

  function resolveUserHomePath(user) {
    const normalizedUser = normalizeUser(user);

    if (normalizedUser?.accountType === ACCOUNT_TYPES.CLINIC) {
      return getClinicProfilePath(normalizedUser);
    }

    return getProfilePath(normalizedUser);
  }

  function syncStoredClinicProfile(clinicProfile) {
    if (!clinicProfile?.id) return;

    try {
      const auth = getStoredAuth();
      if (!auth?.user) return;

      setStoredAuth({
        ...auth,
        user: normalizeUser({
          ...auth.user,
          accountType: ACCOUNT_TYPES.CLINIC,
          name: clinicProfile.nomeClinica || clinicProfile.clinicName || auth.user.name,
          clinicProfile,
        }),
      }, true);
    } catch (_) {
      // Storage sync is best-effort; the next /auth/me call will refresh it.
    }
  }

  function clearStoredAuth() {
    try {
      localStorage.removeItem('physioAuth');
      sessionStorage.removeItem('physioAuth');
    } catch (_) {
      // ignore storage access issues
    }
  }

  function arePhotoListsEqual(left, right) {
    const normalizedLeft = normalizeProfilePhotosList(left);
    const normalizedRight = normalizeProfilePhotosList(right);

    return normalizedLeft.length === normalizedRight.length &&
      normalizedLeft.every((item, index) => item === normalizedRight[index]);
  }

  function mergeProfileGallerySources(profile, publicProfile = null) {
    const normalizedProfile = normalizeProfile(profile);
    const normalizedPublicProfile = normalizeProfile(publicProfile);

    if (!normalizedProfile) return normalizedPublicProfile;
    if (!normalizedPublicProfile) return normalizedProfile;

    const mergedPhotos = normalizeProfilePhotosList(
      (Array.isArray(normalizedProfile.photosList) && normalizedProfile.photosList.length ? normalizedProfile.photosList : null)
        ?? (Array.isArray(normalizedProfile.photos) && normalizedProfile.photos.length ? normalizedProfile.photos : null)
        ?? normalizedProfile.fotos
        ?? normalizedPublicProfile.photosList
        ?? normalizedPublicProfile.photos
        ?? normalizedPublicProfile.fotos
    );

    return {
      ...normalizedPublicProfile,
      ...normalizedProfile,
      photos: mergedPhotos,
      photosList: mergedPhotos,
      fotos: mergedPhotos,
    };
  }

  async function hydrateOwnProfileWithPublicPhotos(profile, options = {}) {
    const normalizedProfile = normalizeProfile(profile);
    if (!normalizedProfile?.id) return normalizedProfile;

    const expectedPhotos = normalizeProfilePhotosList(options.expectedPhotos);
    const retryCount = Number.isInteger(options.retryCount) ? options.retryCount : 2;
    let lastPublicProfile = null;
    let lastPublicError = null;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        lastPublicProfile = await fetchPublicProfileFromSupabase(normalizedProfile.id);
        console.log('OWN PROFILE PUBLIC HYDRATION RESPONSE:', {
          profileId: normalizedProfile.id,
          publicPhotos: lastPublicProfile?.photos,
          publicPhotosList: lastPublicProfile?.photosList,
          attempt,
        });
      } catch (error) {
        lastPublicError = error;
        console.warn('Could not hydrate own profile photos from Supabase:', error);
      }

      const hydratedProfile = mergeProfileGallerySources(normalizedProfile, lastPublicProfile);
      const actualPhotos = normalizeProfilePhotosList(hydratedProfile?.photosList ?? hydratedProfile?.photos ?? hydratedProfile?.fotos);

      if (!expectedPhotos.length || arePhotoListsEqual(actualPhotos, expectedPhotos)) {
        return hydratedProfile;
      }

      if (attempt < retryCount) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    }

    if (lastPublicError) {
      console.warn('Falling back to backend own-profile response after failed public photo hydration:', lastPublicError);
    }

    return mergeProfileGallerySources(normalizedProfile, lastPublicProfile);
  }

  window.physioApi = {
    getStoredAuth,
    setStoredAuth,
    clearStoredAuth,

    request,
    async register(payload) {
      const data = await request('/auth/register', { method: 'POST', body: payload });
      if (data?.token) {
        setStoredAuth({ token: data.token, user: normalizeUser(data.user) }, true);
      }
      return data;
    },
    async login(email, password) {
      const data = await request('/auth/login', { method: 'POST', body: { email, password } });
      if (data?.token) {
        setStoredAuth({ token: data.token, user: normalizeUser(data.user) }, true);
      }
      return data;
    },
    async loginWithGoogle(credential, accountType) {
      const data = await request('/auth/google', {
        method: 'POST',
        body: {
          credential,
          accountType:
            window.PhysioAccountTypes?.normalizeAccountType?.(accountType) ||
            ACCOUNT_TYPES.PHYSIO,
        },
        timeoutMs: 15000,
      });

      if (data?.token) {
        setStoredAuth({ token: data.token, user: normalizeUser(data.user) }, true);
      }

      return data;
    },
    async loginWithSupabase(accessToken, accountType) {
      const data = await request('/auth/supabase', {
        method: 'POST',
        body: {
          accessToken,
          accountType:
            window.PhysioAccountTypes?.normalizeAccountType?.(accountType) ||
            ACCOUNT_TYPES.PHYSIO,
        },
        timeoutMs: 15000,
      });

      if (data?.token) {
        setStoredAuth({ token: data.token, user: normalizeUser(data.user) }, true);
      }

      return data;
    },
    logout() {
      clearStoredAuth();
      return request('/auth/logout', { method: 'POST' });
    },
    me() {
      return request('/auth/me', { timeoutMs: 5000 }).then((data) => ({
        ...data,
        user: normalizeUser(data?.user || data),
      }));
    },
    fetchNotifications() {
      return request('/auth/notifications', { timeoutMs: 10000 });
    },
    markNotificationRead(id) {
      return request(`/auth/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
        timeoutMs: 10000,
      });
    },
    dismissNotification(id) {
      const primaryPath = `/auth/notifications/${encodeURIComponent(id)}`;
      return request(primaryPath, {
        method: 'DELETE',
        timeoutMs: 10000,
      }).catch((error) => {
        if (error.status !== 404) throw error;
        return request(`/api/notifications/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          timeoutMs: 10000,
        });
      });
    },
    async fetchMyProfile() {
      const data = await request('/profiles/me');
      const backendProfile = normalizeProfile(data.profile || data);
      console.log('FETCH MY PROFILE BACKEND RESPONSE:', {
        profileId: backendProfile?.id,
        backendPhotos: backendProfile?.photos,
        backendPhotosList: backendProfile?.photosList,
      });
      const hydratedProfile = await hydrateOwnProfileWithPublicPhotos(backendProfile);
      console.log('FETCH MY PROFILE HYDRATED PHOTOS:', {
        profileId: hydratedProfile?.id,
        hydratedPhotos: hydratedProfile?.photos,
        hydratedPhotosList: hydratedProfile?.photosList,
      });
      return hydratedProfile;
    },
    fetchMyClinicProfile() {
      return request('/clinics/me').then((data) => normalizeClinicProfile(data.clinicProfile || data));
    },
    fetchProfileReviews(profileId) {
      return request(`/reviews/${encodeURIComponent(profileId)}`, {
        timeoutMs: 10000,
      }).then((data) => (data.reviews || []).map(normalizeProfileReview));
    },
    submitProfileReview(payload) {
      return request('/reviews', {
        method: 'POST',
        body: payload,
        timeoutMs: 15000,
      }).then((data) => ({
        ...data,
        review: normalizeProfileReview(data.review),
      }));
    },
    fetchMyReviews() {
      return request('/reviews/me', {
        timeoutMs: 10000,
      }).then((data) => ({
        ...data,
        reviews: (data.reviews || []).map(normalizeProfileReview),
      }));
    },
    fetchMyPendingOwnerReviews() {
      return request('/reviews/owner/pending', {
        timeoutMs: 10000,
      }).then((data) => ({
        ...data,
        reviews: (data.reviews || []).map(normalizeProfileReview),
      }));
    },
    reportProfileReview(reviewId, reason) {
      return request(`/reviews/${encodeURIComponent(reviewId)}/report`, {
        method: 'POST',
        body: { reason },
        timeoutMs: 15000,
      }).then((data) => ({
        ...data,
        review: normalizeProfileReview(data.review),
      }));
    },
    approveOwnReview(reviewId) {
      return request(`/reviews/${encodeURIComponent(reviewId)}/approve`, {
        method: 'POST',
        timeoutMs: 15000,
      }).then((data) => ({
        ...data,
        review: normalizeProfileReview(data.review),
      }));
    },
    rejectOwnReview(reviewId) {
      return request(`/reviews/${encodeURIComponent(reviewId)}/reject`, {
        method: 'POST',
        timeoutMs: 15000,
      }).then((data) => ({
        ...data,
        review: normalizeProfileReview(data.review),
      }));
    },
    fetchAdminReviews(status) {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      return request(`/admin/reviews${query}`, {
        timeoutMs: 10000,
      }).then((data) => ({
        ...data,
        reviews: (data.reviews || []).map(normalizeProfileReview),
      }));
    },
    approveReview(reviewId) {
      return request(`/admin/reviews/${encodeURIComponent(reviewId)}/approve`, {
        method: 'POST',
        timeoutMs: 15000,
      }).then((data) => ({
        ...data,
        review: normalizeProfileReview(data.review),
      }));
    },
    keepPublishedReview(reviewId) {
      return request(`/admin/reviews/${encodeURIComponent(reviewId)}/keep-published`, {
        method: 'POST',
        timeoutMs: 15000,
      }).then((data) => ({
        ...data,
        review: normalizeProfileReview(data.review),
      }));
    },
    rejectReview(reviewId) {
      return request(`/admin/reviews/${encodeURIComponent(reviewId)}/reject`, {
        method: 'POST',
        timeoutMs: 15000,
      }).then((data) => ({
        ...data,
        review: normalizeProfileReview(data.review),
      }));
    },
    async fetchProfiles(options = {}) {
      const startedAt = performance.now();
      try {
        return await fetchPublicProfilesFromSupabase(options);
      } catch (error) {
        if (options.allowBackendFallback === false) {
          console.warn('Supabase public profiles failed and backend fallback is disabled:', error);
          throw error;
        }

        console.warn('Using Render fallback for public profiles:', error);
        return request('/profiles').then((data) => {
          const profiles = (data.profiles || data || []).map(normalizeProfile);
          console.info(`PhysioPipeline profiles: Render fallback carregou ${profiles.length} perfis em ${Math.round(performance.now() - startedAt)}ms`);
          return profiles;
        });
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
    async updateMyProfile(payload) {
      console.log('UPDATE MY PROFILE PAYLOAD:', payload);
      const data = await request('/profiles/me', {
        method: 'PUT',
        body: payload,
        timeoutMs: 20000,
      });
      clearPublicProfileCache();

      const backendProfile = normalizeProfile(data.profile || data);
      console.log('UPDATE MY PROFILE BACKEND RESPONSE:', {
        profileId: backendProfile?.id,
        backendPhotos: backendProfile?.photos,
        backendPhotosList: backendProfile?.photosList,
      });

      const hydratedProfile = await hydrateOwnProfileWithPublicPhotos(backendProfile, {
        expectedPhotos: payload?.photos,
        retryCount: 3,
      });

      console.log('UPDATE MY PROFILE HYDRATED PHOTOS:', {
        profileId: hydratedProfile?.id,
        hydratedPhotos: hydratedProfile?.photos,
        hydratedPhotosList: hydratedProfile?.photosList,
      });

      if (payload?.photos !== undefined) {
        const expectedPhotos = normalizeProfilePhotosList(payload.photos);
        const actualPhotos = normalizeProfilePhotosList(
          hydratedProfile?.photosList ?? hydratedProfile?.photos ?? hydratedProfile?.fotos
        );

        if (!arePhotoListsEqual(actualPhotos, expectedPhotos)) {
          console.warn('PROFILE GALLERY SAVE VERIFICATION DELAYED:', {
            profileId: hydratedProfile?.id || backendProfile?.id || null,
            expectedPhotos,
            actualPhotos,
          });
          return {
            ...hydratedProfile,
            photos: expectedPhotos,
            photosList: expectedPhotos,
            fotos: expectedPhotos,
          };
        }
      }

      return hydratedProfile;
    },
    async updateMyClinicProfile(payload) {
      const upsertWith = (path, method) => request(path, {
        method,
        body: payload,
        timeoutMs: 20000,
      }).then((data) => {
        clearPublicProfileCache();
        return normalizeClinicProfile(data.clinicProfile || data);
      });

      try {
        const clinicProfile = await upsertWith('/clinics/me', 'PATCH');
        syncStoredClinicProfile(clinicProfile);
        return clinicProfile;
      } catch (patchError) {
        if (patchError.status !== 404) throw patchError;
        console.warn('PATCH /clinics/me unavailable, trying POST /clinics/register:', patchError);
      }

      try {
        const clinicProfile = await upsertWith('/clinics/register', 'POST');
        syncStoredClinicProfile(clinicProfile);
        return clinicProfile;
      } catch (postError) {
        if (postError.status !== 404) throw postError;
        console.warn('POST /clinics/register unavailable, trying PUT /clinics/me:', postError);
      }

      const clinicProfile = await upsertWith('/clinics/me', 'PUT');
      syncStoredClinicProfile(clinicProfile);
      return clinicProfile;
    },
    fetchClinics(params = {}) {
      const searchParams = new URLSearchParams();
      if (params.specialty) searchParams.set('specialty', params.specialty);
      if (params.query) searchParams.set('query', params.query);
      if (params.city) searchParams.set('city', params.city);
      if (params.neighborhood) searchParams.set('neighborhood', params.neighborhood);

      const query = searchParams.toString();
      return request(`/clinics${query ? `?${query}` : ''}`, {
        timeoutMs: 10000,
      }).then((data) => (data.clinics || data || []).map(normalizeClinicProfile));
    },
    fetchClinicOptions() {
      return request('/clinics/options', {
        timeoutMs: 10000,
      });
    },
    fetchClinic(id) {
      return request(`/clinics/${encodeURIComponent(id)}`, {
        timeoutMs: 10000,
      }).then((data) => normalizeClinicProfile(data.clinicProfile || data));
    },
    searchPhysiotherapistsForClinic(params = {}) {
      const searchParams = new URLSearchParams();
      if (params.query) searchParams.set('query', params.query);
      if (params.name) searchParams.set('name', params.name);
      if (params.city) searchParams.set('city', params.city);
      if (params.specialty) searchParams.set('specialty', params.specialty);

      const query = searchParams.toString();
      return request(`/clinics/physiotherapists/search${query ? `?${query}` : ''}`, {
        timeoutMs: 10000,
      }).then((data) => (data.profiles || []).map(normalizeProfile));
    },
    fetchMyClinicPhysioLinks() {
      return request('/clinics/me/physio-links', {
        timeoutMs: 10000,
      }).catch((error) => {
        if (error.status !== 404) throw error;
        return request('/api/clinics/me/physio-links', { timeoutMs: 10000 });
      }).then((data) => data.links || []);
    },
    requestClinicPhysioLink(payload) {
      const options = {
        method: 'POST',
        body: payload,
        timeoutMs: 15000,
      };

      return request('/clinics/me/physio-links', options).catch((error) => {
        if (error.status !== 404) throw error;
        return request('/api/clinics/me/physio-links', options);
      }).then((data) => data.link || data);
    },
    unlinkClinicPhysioLink(linkId) {
      return request(`/clinics/me/physio-links/${encodeURIComponent(linkId)}`, {
        method: 'DELETE',
        timeoutMs: 15000,
      }).then((data) => data.link || data);
    },
    async fetchProfile(id) {
      let supabaseProfile = null;
      let backendProfile = null;
      let supabaseError = null;
      let backendError = null;

      try {
        supabaseProfile = await fetchPublicProfileFromSupabase(id);
        console.log('Fetched public profile:', supabaseProfile);
        console.log('PUBLIC PROFILE PHOTOS FROM SUPABASE:', supabaseProfile?.photos);
      } catch (error) {
        supabaseError = error;
        console.warn('Supabase public profile fetch failed:', error);
      }

      try {
        const backendData = await request(`/profiles/${id}`, { timeoutMs: 15000 });
        backendProfile = normalizeProfile(backendData.profile || backendData);
        console.log('PUBLIC PROFILE PHOTOS FROM BACKEND:', backendProfile?.photos);
      } catch (error) {
        backendError = error;
        console.warn('Could not load backend public profile details:', error);
      }

      if (supabaseProfile && backendProfile) {
        const mergedPhotos = normalizeProfilePhotosList(
          (Array.isArray(backendProfile?.photosList) && backendProfile.photosList.length ? backendProfile.photosList : null)
            ?? (Array.isArray(backendProfile?.photos) && backendProfile.photos.length ? backendProfile.photos : null)
            ?? (Array.isArray(backendProfile?.fotos) && backendProfile.fotos.length ? backendProfile.fotos : null)
            ?? supabaseProfile.photosList
            ?? supabaseProfile.photos
            ?? supabaseProfile.fotos
        );

        return {
          ...supabaseProfile,
          ...backendProfile,
          ownerUserId: backendProfile?.ownerUserId || supabaseProfile.ownerUserId || null,
          isClaimed: Boolean(backendProfile?.isClaimed || supabaseProfile.isClaimed),
          linkedClinics: backendProfile?.linkedClinics || supabaseProfile.linkedClinics || [],
          photos: mergedPhotos,
          photosList: mergedPhotos,
          fotos: mergedPhotos,
        };
      }

      if (backendProfile) {
        return backendProfile;
      }

      if (supabaseProfile) {
        return supabaseProfile;
      }

      const finalError = backendError || supabaseError || new Error('Could not load public profile.');
      console.warn('Using Render fallback for public profile:', finalError);
      throw finalError;
    },
    async fetchProfileOptions(options = {}) {
      try {
        const profiles = await fetchPublicProfilesFromSupabase({
          useCache: options.useCache ?? true,
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
    fetchMyClinicLinkRequests() {
      return request('/profiles/me/clinic-links', {
        timeoutMs: 10000,
      }).then((data) => data.links || []);
    },
    fetchMyPhysioClinicLinkRequests() {
      return request('/clinic-link-requests/my', {
        timeoutMs: 10000,
      }).catch((error) => {
        if (error.status !== 404) throw error;
        return request('/api/clinic-link-requests/my', { timeoutMs: 10000 });
      }).then((data) => data.links || []);
    },
    createClinicLinkRequest(payload) {
      const options = {
        method: 'POST',
        body: payload,
        timeoutMs: 15000,
      };

      return request('/clinic-link-requests', options).catch((error) => {
        if (error.status !== 404) throw error;
        return request('/api/clinic-link-requests', options);
      }).then((data) => data.link || data);
    },
    fetchClinicLinkRequest(linkId) {
      const primaryPath = `/clinic-link-requests/${encodeURIComponent(linkId)}`;
      return request(primaryPath, {
        timeoutMs: 10000,
      }).catch((error) => {
        if (error.status !== 404) throw error;
        return request(`/api${primaryPath}`, { timeoutMs: 10000 });
      });
    },
    fetchPendingClinicLinkRequestForClinic() {
      const primaryPath = '/clinic-link-requests/pending-for-clinic';
      return request(primaryPath, {
        timeoutMs: 10000,
      }).catch((error) => {
        if (error.status !== 404) throw error;
        return request(`/api${primaryPath}`, { timeoutMs: 10000 });
      });
    },
    acceptClinicLinkRequest(linkId, config = {}) {
      const clinicOwnedPath = `/clinic-link-requests/${encodeURIComponent(linkId)}/accept`;
      const physioOwnedPath = `/profiles/me/clinic-links/${encodeURIComponent(linkId)}/accept`;
      const requestOptions = {
        method: 'POST',
        timeoutMs: 15000,
      };

      const preferredPaths = config?.accountType === ACCOUNT_TYPES.PHYSIO
        ? [physioOwnedPath, clinicOwnedPath, `/api${clinicOwnedPath}`]
        : [clinicOwnedPath, `/api${clinicOwnedPath}`, physioOwnedPath];

      let attempt = Promise.reject();
      preferredPaths.forEach((path) => {
        attempt = attempt.catch((error) => {
          if (error && error.status && ![403, 404].includes(error.status)) {
            throw error;
          }

          return request(path, requestOptions);
        });
      });

      return attempt.then((data) => data.link || data);
    },
    rejectClinicLinkRequest(linkId, config = {}) {
      const clinicOwnedPath = `/clinic-link-requests/${encodeURIComponent(linkId)}/reject`;
      const physioOwnedPath = `/profiles/me/clinic-links/${encodeURIComponent(linkId)}/reject`;
      const requestOptions = {
        method: 'POST',
        timeoutMs: 15000,
      };

      const preferredPaths = config?.accountType === ACCOUNT_TYPES.PHYSIO
        ? [physioOwnedPath, clinicOwnedPath, `/api${clinicOwnedPath}`]
        : [clinicOwnedPath, `/api${clinicOwnedPath}`, physioOwnedPath];

      let attempt = Promise.reject();
      preferredPaths.forEach((path) => {
        attempt = attempt.catch((error) => {
          if (error && error.status && ![403, 404].includes(error.status)) {
            throw error;
          }

          return request(path, requestOptions);
        });
      });

      return attempt.then((data) => data.link || data);
    },
    unlinkClinicFromProfile(linkId) {
      return request(`/profiles/me/clinic-links/${encodeURIComponent(linkId)}`, {
        method: 'DELETE',
        timeoutMs: 15000,
      }).then((data) => data.link || data);
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
    normalizeClinicProfile,
    normalizeUser,
    resolveUserHomePath,
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




