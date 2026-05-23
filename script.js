let cachedMyProfile = null;

const EXISTING_SPECIALTIES = [
  'Fisioterapia Ortopédica',
  'Fisioterapia Esportiva',
  'Fisioterapia Neurológica',
  'Fisioterapia Geriátrica',
  'Fisioterapia Respiratória',
  'Pilates',
  'Domicilar',
  'Fisioterapia Ocupacional',
  'Quiropraxia',
  'Fisioterapia Pediátrica',
  'Ventosaterapia',
  'Pós-operatório'
];

const SPECIALTIES = window.PhysioTaxonomy?.profileSpecialtyOptions || EXISTING_SPECIALTIES;

const CITY_NEIGHBORHOODS = {
  'São Paulo': [
    'Bela Vista',
    'Butantã',
    'Ipiranga',
    'Lapa',
    'Mooca',
    'Pinheiros',
    'Santana',
    'Santo Amaro',
    'Campo Belo',
    'Tatuapé',
    'Vila Mariana'
  ],
  'Sorocaba': [
    'Campolim',
    'Centro',
    'Éden',
    'Jardim Europa',
    'Santa Rosália',
    'Vila Haro',
    'Wanel Ville'
  ],
  'Itapetininga': [
    'Centro',
    'Chapada Grande',
    'Jardim Fogaça',
    'Jardim Marabá',
    'Vila Aparecida',
    'Vila Nastri',
    'Vila Rio Branco'
  ]
};

const CITIES = Object.keys(CITY_NEIGHBORHOODS);

let dynamicCityOptions = [];
let dynamicSpecialtyOptions = [];
let dynamicOptionsLoaded = false;

const DYNAMIC_OPTIONS_CACHE_KEY = 'physioDynamicOptions:v1';
const DYNAMIC_OPTIONS_CACHE_MS = 5 * 60 * 1000;
const OPTION_SORTER = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
  numeric: true,
});

const PATIENT_SEARCH_MAP = [
  {
    triggers: ['dedo em gatilho', 'gatilho', 'dedo travando', 'dedo preso'],
    terms: ['dedo em gatilho', 'mao', 'punho', 'tendao', 'tendinite', 'ler', 'dort', 'ortopedica', 'ocupacional', 'trabalho', 'reabilitacao'],
  },
  {
    triggers: ['dor lombar', 'lombar', 'coluna', 'costas', 'ciatica', 'nervo ciatico', 'hernia de disco'],
    terms: ['lombar', 'coluna', 'costas', 'ciatica', 'hernia', 'ortopedica', 'quiropraxia', 'pilates', 'ocupacional', 'ergonomia'],
  },
  {
    triggers: ['dor no joelho', 'joelho', 'menisco', 'ligamento', 'acl', 'lca'],
    terms: ['joelho', 'menisco', 'ligamento', 'ortopedica', 'esportiva', 'pos-operatorio', 'reabilitacao'],
  },
  {
    triggers: ['ombro', 'dor no ombro', 'manguito', 'bursite', 'tendinite no ombro'],
    terms: ['ombro', 'manguito', 'bursite', 'tendinite', 'ortopedica', 'esportiva', 'reabilitacao'],
  },
  {
    triggers: ['avc', 'derrame', 'paralisia', 'neurologico', 'neurologica'],
    terms: ['avc', 'derrame', 'paralisia', 'neurologica', 'neuro', 'reabilitacao'],
  },
  {
    triggers: ['asma', 'respiracao', 'respiratoria', 'pulmao', 'bronquite', 'dpoc'],
    terms: ['asma', 'respiracao', 'respiratoria', 'pulmao', 'bronquite', 'dpoc'],
  },
  {
    triggers: ['trabalho', 'ergonomia', 'ler', 'dort', 'tendinite', 'escritorio', 'home office'],
    terms: ['trabalho', 'ergonomia', 'ocupacional', 'ler', 'dort', 'tendinite', 'postura', 'mao', 'punho', 'lombar'],
  },
  {
    triggers: ['pos operatorio', 'cirurgia', 'operou', 'recuperacao'],
    terms: ['pos-operatorio', 'pos operatorio', 'cirurgia', 'recuperacao', 'reabilitacao', 'ortopedica'],
  },
  {
    triggers: ['crianca', 'bebe', 'infantil', 'pediatrica', 'pediatria'],
    terms: ['pediatrica', 'pediatria', 'crianca', 'bebe', 'infantil'],
  },
  {
    triggers: ['idoso', 'idosa', 'geriatrica', 'equilibrio', 'queda'],
    terms: ['geriatrica', 'idoso', 'idosa', 'equilibrio', 'queda', 'mobilidade'],
  },
];

const STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'com', 'para', 'por', 'um', 'uma', 'o', 'a', 'e']);

function cleanOptionLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeOptionLists(...lists) {
  const byKey = new Map();

  lists.flat().forEach((value) => {
    const option = cleanOptionLabel(value);
    if (!option || option === '-') return;

    const key = normalizeText(option);
    if (!key || byKey.has(key)) return;

    byKey.set(key, option);
  });

  return Array.from(byKey.values()).sort((a, b) => OPTION_SORTER.compare(a, b));
}

function applyDynamicOptions(options = {}) {
  dynamicCityOptions = Array.isArray(options.cities) ? options.cities : [];
  dynamicSpecialtyOptions = Array.isArray(options.specialties) ? options.specialties : [];
  dynamicOptionsLoaded = true;

  window.PhysioDynamicOptions = {
    cities: getCityOptions(),
    specialties: getSpecialtyAutocompleteOptions(),
  };
}

function readCachedDynamicOptions() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(DYNAMIC_OPTIONS_CACHE_KEY) || 'null');
    if (!cached?.createdAt || Date.now() - cached.createdAt > DYNAMIC_OPTIONS_CACHE_MS) return null;
    return cached.options || null;
  } catch (_) {
    return null;
  }
}

function writeCachedDynamicOptions(options) {
  try {
    sessionStorage.setItem(
      DYNAMIC_OPTIONS_CACHE_KEY,
      JSON.stringify({
        createdAt: Date.now(),
        options,
      })
    );
  } catch (_) {
    // Storage may be unavailable on some private/mobile browsers.
  }
}

async function loadDynamicSearchOptions() {
  if (dynamicOptionsLoaded) return window.PhysioDynamicOptions;

  const cachedOptions = readCachedDynamicOptions();
  if (cachedOptions) {
    applyDynamicOptions(cachedOptions);
    return window.PhysioDynamicOptions;
  }

  if (!window.physioApi?.fetchProfileOptions) {
    applyDynamicOptions({});
    return window.PhysioDynamicOptions;
  }

  try {
    const options = await window.physioApi.fetchProfileOptions();
    writeCachedDynamicOptions(options);
    applyDynamicOptions(options);
  } catch (error) {
    console.warn('Não foi possível carregar opções dinâmicas:', error);
    applyDynamicOptions({});
  }

  return window.PhysioDynamicOptions;
}

function getCityOptions() {
  return mergeOptionLists(CITIES, dynamicCityOptions);
}

function getSpecialtyAutocompleteOptions() {
  return mergeOptionLists(
    SPECIALTIES,
    window.PhysioTaxonomy?.autocompleteSpecialtyOptions || [],
    dynamicSpecialtyOptions
  );
}

window.physioSearchOptions = {
  getCities: getCityOptions,
  getSpecialties: getSpecialtyAutocompleteOptions,
  loadDynamicOptions: loadDynamicSearchOptions,
};

function getPatientSearchGroups() {
  return [
    ...PATIENT_SEARCH_MAP,
    ...(window.PhysioTaxonomy?.searchSynonymGroups || []),
  ];
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenizeSearch(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function uniqueTerms(terms) {
  return [...new Set(terms.filter(Boolean))];
}

function expandPatientSearch(query) {
  const normalizedQuery = normalizeText(query);
  const terms = tokenizeSearch(query);
  const queryTokens = tokenizeSearch(query);
  const taxonomy = window.PhysioTaxonomy || {};

  getPatientSearchGroups().forEach((entry) => {
    const matched = entry.triggers.some((trigger) =>
      normalizedQuery.includes(normalizeText(trigger))
    );

    if (matched) {
      terms.push(...entry.triggers.map(normalizeText));
      terms.push(...entry.terms.map(normalizeText));
    }
  });

  [
    ...(taxonomy.treatmentTags || []),
    ...(taxonomy.coreSpecialties || []),
    ...(taxonomy.audienceTags || []),
    ...(taxonomy.seoSearchCombinations || []),
  ].forEach((value) => {
    const normalizedValue = normalizeText(value);
    const hasDirectMatch =
      normalizedQuery && normalizedValue.includes(normalizedQuery);
    const hasTokenMatch =
      queryTokens.length && queryTokens.some((term) => normalizedValue.includes(term));

    if (hasDirectMatch || hasTokenMatch) {
      terms.push(...tokenizeSearch(value));
    }
  });

  return uniqueTerms(terms);
}

function getProfileSearchText(profile) {
  return normalizeText([
    profile.nome,
    profile.name,
    profile.especialidade,
    profile.specialty,
    profile.especialidadeSecundaria,
    profile.secondarySpecialty,
    profile.specialization,
    profile.specialty2,
    profile.extraSpecialty,
    profile.atendimento,
    profile.attendance,
    profile.descricao,
    profile.bio,
  ].filter(Boolean).join(' '));
}

function scorePatientMatch(profile, terms) {
  if (!terms.length) return 0;

  const specialtyText = getSearchableSpecialties(profile);
  const profileText = getProfileSearchText(profile);
  let score = 0;

  terms.forEach((term) => {
    if (specialtyText.includes(term)) score += 5;
    if (profileText.includes(term)) score += 2;
  });

  return score;
}


function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAuthStorage(retries = 10, delay = 150) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const auth = window.physioApi?.getStoredAuth?.();

    if (auth?.token) return auth;

    await wait(delay);
  }

  return null;
}

function findExactMatch(options, value) {
  const normalizedValue = normalizeText(value);
  return options.find((option) => normalizeText(option) === normalizedValue) || null;
}

function closeSuggestionList(listElement) {
  if (!listElement) return;
  listElement.innerHTML = '';
  listElement.style.display = 'none';
}

function debounce(fn, wait = 350) {
  let timeoutId = null;

  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), wait);
  };
}

function renderSuggestionList(listElement, inputElement, options, onSelect) {
  if (!listElement || !inputElement) return;

  listElement.innerHTML = '';

  if (!options.length) {
    closeSuggestionList(listElement);
    return;
  }

  options.forEach((option, index) => {
    const item = document.createElement('li');
    item.textContent = option;
    item.setAttribute('role', 'option');
    item.dataset.index = String(index);

    item.addEventListener('mousedown', (event) => {
      event.preventDefault();
      inputElement.value = option;
      closeSuggestionList(listElement);
      if (typeof onSelect === 'function') onSelect(option);
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    });

    listElement.appendChild(item);
  });

  listElement.style.display = 'block';
}

function setupAutocomplete({
  inputId,
  listId,
  optionsProvider,
  onSelect,
  minChars = 0,
  showOnFocus = true
}) {
  const inputElement = document.getElementById(inputId);
  const listElement = document.getElementById(listId);

  if (!inputElement || !listElement) return null;

  const getFilteredOptions = () => {
    const allOptions = typeof optionsProvider === 'function' ? optionsProvider() : [];
    const searchTerm = normalizeText(inputElement.value);

    if (!searchTerm) {
      return showOnFocus ? allOptions : [];
    }

    if (searchTerm.length < minChars) return [];

    return allOptions.filter((option) => normalizeText(option).includes(searchTerm));
  };

  const refreshSuggestions = () => {
    renderSuggestionList(listElement, inputElement, getFilteredOptions(), onSelect);
  };

  const debouncedRefreshSuggestions = debounce(refreshSuggestions, 350);

  inputElement.addEventListener('input', debouncedRefreshSuggestions);

  inputElement.addEventListener('focus', () => {
    if (!inputElement.disabled) refreshSuggestions();
  });

  inputElement.addEventListener('keydown', (event) => {
    const items = Array.from(listElement.querySelectorAll('li'));
    if (!items.length) return;

    const activeItem = listElement.querySelector('.active');
    let activeIndex = activeItem ? Number(activeItem.dataset.index) : -1;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
    } else if (event.key === 'Enter') {
      if (activeItem) {
        event.preventDefault();
        activeItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }
      return;
    } else if (event.key === 'Escape') {
      closeSuggestionList(listElement);
      return;
    } else {
      return;
    }

    items.forEach((item) => item.classList.remove('active'));
    items[activeIndex].classList.add('active');
  });

  document.addEventListener('click', (event) => {
    if (!listElement.contains(event.target) && event.target !== inputElement) {
      closeSuggestionList(listElement);
    }
  });

  inputElement.addEventListener('blur', () => {
    setTimeout(() => closeSuggestionList(listElement), 120);
  });

  return {
    inputElement,
    listElement,
    refreshSuggestions
  };
}

function setupSpecialtyAutocomplete(inputId, listId) {
  setupAutocomplete({
    inputId,
    listId,
    optionsProvider: getSpecialtyAutocompleteOptions,
    minChars: 0,
    showOnFocus: true
  });
}

function setupCityNeighborhoodAutocomplete(cityInputId, cityListId, neighborhoodInputId, neighborhoodListId) {
  const cityInput = document.getElementById(cityInputId);
  const neighborhoodInput = document.getElementById(neighborhoodInputId);
  const neighborhoodList = document.getElementById(neighborhoodListId);

  if (!cityInput || !neighborhoodInput || !neighborhoodList) return;

  const getMatchedCity = () => findExactMatch(getCityOptions(), cityInput.value);

  const syncNeighborhoodState = () => {
    const matchedCity = getMatchedCity();
    const neighborhoods = matchedCity ? CITY_NEIGHBORHOODS[matchedCity] || [] : [];

    if (!cityInput.value.trim()) {
      neighborhoodInput.value = '';
      neighborhoodInput.disabled = true;
      neighborhoodInput.placeholder = 'Selecione ou digite uma cidade primeiro';
      closeSuggestionList(neighborhoodList);
      return;
    }

    neighborhoodInput.disabled = false;
    neighborhoodInput.placeholder = `Ex.: ${neighborhoods[0] || 'Centro'}`;

    if (neighborhoodInput.value && !findExactMatch(neighborhoods, neighborhoodInput.value)) {
      neighborhoodInput.value = '';
    }
  };

  setupAutocomplete({
    inputId: cityInputId,
    listId: cityListId,
    optionsProvider: getCityOptions,
    minChars: 0,
    showOnFocus: true,
    onSelect: () => {
      syncNeighborhoodState();
    }
  });

  setupAutocomplete({
    inputId: neighborhoodInputId,
    listId: neighborhoodListId,
    optionsProvider: () => {
      const matchedCity = getMatchedCity();
      return matchedCity ? CITY_NEIGHBORHOODS[matchedCity] || [] : [];
    },
    minChars: 0,
    showOnFocus: true
  });

  cityInput.addEventListener('input', syncNeighborhoodState);
  cityInput.addEventListener('change', syncNeighborhoodState);
  cityInput.addEventListener('blur', () => {
    const matchedCity = getMatchedCity();
    if (matchedCity) cityInput.value = matchedCity;
    syncNeighborhoodState();
  });

  neighborhoodInput.addEventListener('blur', () => {
    const matchedCity = getMatchedCity();
    if (!matchedCity) return;

    const matchedNeighborhood = findExactMatch(CITY_NEIGHBORHOODS[matchedCity] || [], neighborhoodInput.value);
    if (matchedNeighborhood) {
      neighborhoodInput.value = matchedNeighborhood;
    }
  });

  syncNeighborhoodState();
}

function setupSearchModeSwitches() {
  document.querySelectorAll('form[action="resultados.html"]').forEach((form) => {
    const modeInputs = Array.from(form.querySelectorAll('input[name="modo"]'));
    const specialtyField = form.querySelector('.specialty-search-field');
    const patientField = form.querySelector('.patient-search-field');
    const specialtyInput = specialtyField?.querySelector('input[name="especialidade"]');
    const patientInput = patientField?.querySelector('input[name="queixa"]');

    if (!modeInputs.length || !specialtyField || !patientField) return;

    const syncMode = () => {
      const mode = modeInputs.find((input) => input.checked)?.value || 'especialidade';
      const isPatientMode = mode === 'leigo';

      specialtyField.hidden = isPatientMode;
      patientField.hidden = !isPatientMode;

      if (specialtyInput) specialtyInput.required = !isPatientMode;
      if (patientInput) patientInput.required = isPatientMode;
    };

    modeInputs.forEach((input) => input.addEventListener('change', syncMode));
    syncMode();
  });
}

async function getLoggedUser(force = false) {
  if (!force && cachedMyProfile) return cachedMyProfile;

  try {
    const auth =
      window.physioApi.getStoredAuth?.() ||
      await waitForAuthStorage();

    console.log('Stored auth:', auth);

    if (!auth?.token) {
      cachedMyProfile = null;
      return null;
    }

    let rawUser = auth.user || {};
    const storedHasProfileId = Boolean(
      rawUser.profiles?.[0]?.id ||
      rawUser.profile?.id
    );

    if (!storedHasProfileId && window.physioApi.me) {
      try {
        const meData = await window.physioApi.me();
        rawUser = meData?.user ?? meData ?? rawUser;
      } catch (error) {
        console.warn('Using stored auth fallback because /auth/me failed:', error);
      }
    }

    let profile = null;
    const storedProfileId =
      rawUser.profiles?.[0]?.id ||
      rawUser.profile?.id ||
      null;

    if (storedProfileId && window.physioApi.fetchProfile) {
      try {
        profile = await window.physioApi.fetchProfile(storedProfileId);
      } catch (_) {
        profile = { id: storedProfileId };
      }
    }

    if (!profile && window.physioApi.fetchMyProfile) {
      try {
        profile = await window.physioApi.fetchMyProfile();
      } catch (_) {
        profile = null;
      }
    }

    cachedMyProfile = {
      id: rawUser.id ?? null,
      email: rawUser.email ?? '',
      emailVerified: rawUser.emailVerified ?? false,
      profile,
    };

    return cachedMyProfile;
  } catch (error) {
    console.warn('Auth UI init failed:', error);
    cachedMyProfile = null;
    return null;
  }
}

async function logout() {
  await window.physioApi.logout().catch(() => {});
  cachedMyProfile = null;
  window.location.href = 'index.html';
}

window.logout = logout;
window.getLoggedUser = getLoggedUser;

function getUserProfileHref(user) {
  return user?.profile?.id
    ? `profile.html?id=${encodeURIComponent(user.profile.id)}`
    : 'profile.html';
}


function updateProfileButtons(user) {
  const heroBtn = document.getElementById('heroProfileBtn');
  const ctaBtn = document.getElementById('ctaProfileBtn');
  const pageProfileBtn = document.getElementById('pageProfileBtn');
  const profileCtas = Array.from(document.querySelectorAll('[data-profile-cta]'));

  const profileHref = getUserProfileHref(user);

  const text = 'Meu perfil';

  [heroBtn, ctaBtn, pageProfileBtn, ...profileCtas].forEach((btn) => {
    if (!btn) return;
    btn.textContent = text;
    btn.href = profileHref;
  });
}


async function renderAuthArea() {
  const authArea = document.getElementById('authArea');
  const cadastroLink = document.getElementById('cadastroLink');

  if (!authArea) return;

  const user = await getLoggedUser(true);

  if (!user) {
    if (cadastroLink) cadastroLink.style.display = '';

    authArea.innerHTML = `
      <a href="login.html" class="btn btn-outline">Entrar</a>
      <a href="cadastro.html" class="btn btn-primary">Cadastrar</a>
    `;
    return;
  }

  if (cadastroLink) cadastroLink.remove();

  updateProfileButtons(user);

  const firstName = (
    user.profile?.nome ||
    user.profile?.name ||
    user.email ||
    'Profissional'
  ).split(' ')[0];
  const profileHref = getUserProfileHref(user);

  authArea.innerHTML = `
    <span class="user-greeting">Olá, ${escapeHtml(firstName)}</span>
    <a href="${profileHref}" class="btn btn-outline">Meu perfil</a>
    <button class="btn btn-secondary" onclick="logout()">Sair</button>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await renderAuthArea();
  await loadDynamicSearchOptions();

  // mobile navbar base64url auth check
  setTimeout(() => {
    cachedMyProfile = null;
    renderAuthArea();
  }, 1200);

  setupSpecialtyAutocomplete('specialtyInput', 'specialtySuggestions');
  setupSpecialtyAutocomplete('buscarEspecialidade', 'buscarSuggestions');

  setupCityNeighborhoodAutocomplete(
    'cityIndexSelect',
    'cityIndexSuggestions',
    'buscarBairroIndex',
    'bairroIndexSuggestions'
  );

  setupCityNeighborhoodAutocomplete(
    'buscarCidade',
    'cidadeSuggestions',
    'buscarBairro',
    'bairroSuggestions'
  );

  setupSearchModeSwitches();
});

function getSearchableSpecialties(profile) {
  return [
    profile.especialidade,
    profile.specialty,
    profile.especialidadeSecundaria,
    profile.secondarySpecialty,
    profile.specialization,
    profile.specialty2,
    profile.extraSpecialty,
  ]
    .filter(Boolean)
    .map(normalizeText)
    .join(' ');
}

function getDisplaySpecialties(profile) {
  return [
    profile.especialidade || profile.specialty,
    profile.especialidadeSecundaria || profile.secondarySpecialty,
  ]
    .filter(Boolean)
    .filter((specialty, index, arr) => arr.indexOf(specialty) === index)
    .join(' • ');
}

// ===============================
// RESULTADOS DA BUSCA
// ===============================

const RESULTS_PER_PAGE = 12;

document.addEventListener('DOMContentLoaded', async () => {
  const resultsGrid = document.getElementById('resultsGrid');

  // Só executa em resultados.html
  if (!resultsGrid) return;

  const resumo = document.getElementById('resultadoResumo');
  const resultsShowingSummary = document.getElementById('resultsShowingSummary');
  const paginationControls = document.getElementById('paginationControls');

  const renderResultsSkeleton = (count = 6) => {
    resultsGrid.innerHTML = Array.from({ length: count }, () => `
      <article class="result-card result-card-skeleton" aria-hidden="true">
        <span class="skeleton-line skeleton-title"></span>
        <span class="skeleton-pill"></span>
        <span class="skeleton-pill skeleton-pill-short"></span>
        <span class="skeleton-pill skeleton-pill-shorter"></span>
        <span class="skeleton-line"></span>
        <span class="skeleton-line"></span>
        <span class="skeleton-button"></span>
      </article>
    `).join('');
  };

  const params = new URLSearchParams(window.location.search);
  const requestedPage = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);

  const especialidade = normalizeText(
    params.get('especialidade') || ''
  );

  const modoBusca = params.get('modo') === 'leigo' ? 'leigo' : 'especialidade';
  const queixa = params.get('queixa') || '';
  const patientTerms = expandPatientSearch(queixa);

  const cidade = normalizeText(
    params.get('cidade') || ''
  );

  const bairro = normalizeText(
    params.get('bairro') || ''
  );

  const specialtyInput = document.getElementById('specialtyInput');
  const cityInput = document.getElementById('cityIndexSelect');
  const bairroInput = document.getElementById('buscarBairroIndex');
  const patientInput = document.querySelector('.patient-search-field input[name="queixa"]');

  if (specialtyInput) specialtyInput.value = params.get('especialidade') || '';
  if (patientInput) patientInput.value = queixa;
  if (cityInput) cityInput.value = params.get('cidade') || '';
  if (bairroInput) bairroInput.value = params.get('bairro') || '';
  setupSearchModeSwitches();
  document.querySelectorAll('input[name="modo"]').forEach((input) => {
    input.checked = input.value === modoBusca;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  try {
    resumo.textContent = 'Buscando profissionais...';
    renderResultsSkeleton();

    const profiles = await window.physioApi.fetchProfiles();

    const matchedProfiles = profiles.map((profile) => {
      const pEspecialidade = getSearchableSpecialties(profile);
      const pCidade = normalizeText(profile.cidade || profile.city);
      const pBairro = normalizeText(profile.bairro || profile.neighborhood);

      const specialtyMatch =
        modoBusca === 'leigo'
          ? scorePatientMatch(profile, patientTerms) > 0
          : (!especialidade || pEspecialidade.includes(especialidade));

      const cityMatch =
        !cidade || pCidade.includes(cidade);

      const neighborhoodMatch =
        !bairro || pBairro.includes(bairro);

      return {
        profile,
        score: modoBusca === 'leigo' ? scorePatientMatch(profile, patientTerms) : 0,
        matched: specialtyMatch && cityMatch && neighborhoodMatch,
      };
    });

    const filtered = matchedProfiles
      .filter((item) => item.matched)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.profile);

    const resultLabel = filtered.length === 1
      ? '1 profissional encontrado'
      : `${filtered.length} profissionais encontrados`;

    resumo.textContent = resultLabel;

    if (modoBusca === 'leigo' && queixa) {
      const hintTerms = patientTerms.slice(0, 8);
      resumo.textContent = `${resultLabel} para "${queixa}"`;

      if (hintTerms.length) {
        resumo.insertAdjacentHTML(
          'afterend',
          `
            <section class="smart-search-summary" aria-label="Resumo da busca inteligente">
              <div class="smart-search-summary__copy">
                <span>Busca inteligente</span>
                <strong>Tamb&eacute;m procuramos termos relacionados</strong>
              </div>
              <div class="smart-search-tags">
                ${hintTerms.map((term) => `<span>${escapeHtml(term)}</span>`).join('')}
              </div>
            </section>
          `
        );
      }
    }

    if (filtered.length === 0) {
      resultsGrid.innerHTML = `
        <div class="empty-results">
          <h3>Nenhum profissional encontrado.</h3>
          <p>Tente pesquisar outra especialidade ou cidade.</p>
        </div>
      `;
      if (resultsShowingSummary) resultsShowingSummary.textContent = 'Mostrando 0 de 0 profissionais';
      if (paginationControls) paginationControls.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(filtered.length / RESULTS_PER_PAGE);
    const clampPage = (page) => Math.min(Math.max(page, 1), totalPages);
    let currentPage = clampPage(requestedPage);

    const updatePageUrl = (page) => {
      const urlParams = new URLSearchParams(window.location.search);

      if (page <= 1) {
        urlParams.delete('page');
      } else {
        urlParams.set('page', String(page));
      }

      const queryString = urlParams.toString();
      const nextUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;

      window.history.replaceState(null, '', nextUrl);
    };

    const getPaginationItems = (page) => {
      const pages = [];

      if (totalPages <= 7) {
        for (let index = 1; index <= totalPages; index += 1) pages.push(index);
        return pages;
      }

      pages.push(1);
      if (page > 4) pages.push('...');

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let index = start; index <= end; index += 1) pages.push(index);

      if (page < totalPages - 3) pages.push('...');
      pages.push(totalPages);

      return pages;
    };

    const renderPagination = () => {
      if (!paginationControls) return;

      if (totalPages <= 1) {
        paginationControls.innerHTML = '';
        return;
      }

      const pageButtons = getPaginationItems(currentPage)
        .map((item) => {
          if (item === '...') {
            return '<span class="pagination-ellipsis" aria-hidden="true">...</span>';
          }

          return `
            <button
              type="button"
              class="pagination-page ${item === currentPage ? 'is-active' : ''}"
              data-page="${item}"
              aria-label="Ir para a página ${item}"
              ${item === currentPage ? 'aria-current="page"' : ''}
            >
              ${item}
            </button>
          `;
        })
        .join('');

      paginationControls.innerHTML = `
        <button
          type="button"
          class="pagination-btn"
          data-page="${currentPage - 1}"
          ${currentPage === 1 ? 'disabled' : ''}
        >
          Anterior
        </button>

        <div class="pagination-pages">
          ${pageButtons}
        </div>

        <button
          type="button"
          class="pagination-btn"
          data-page="${currentPage + 1}"
          ${currentPage === totalPages ? 'disabled' : ''}
        >
          Próxima
        </button>
      `;

      paginationControls.querySelectorAll('button[data-page]').forEach((button) => {
        button.addEventListener('click', () => {
          renderPage(Number.parseInt(button.dataset.page, 10), true);
        });
      });
    };

    const renderPage = (page, shouldScroll = false) => {
      currentPage = clampPage(page);

      const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
      const endIndex = Math.min(startIndex + RESULTS_PER_PAGE, filtered.length);
      const pageProfiles = filtered.slice(startIndex, endIndex);

   resultsGrid.innerHTML = pageProfiles.map((profile) => `
  <article class="result-card">
    <h3>
      ${escapeHtml(profile.nome || profile.name || 'Fisioterapeuta')}
    </h3>

    <p>
      <strong>Especialidade:</strong>
      ${escapeHtml(getDisplaySpecialties(profile) || 'Não informado')}
    </p>

    <p>
      <strong>Cidade:</strong>
      ${escapeHtml(profile.cidade || profile.city || 'Não informado')}
    </p>

    <p>
      <strong>Bairro:</strong>
      ${escapeHtml(profile.bairro || profile.neighborhood || 'Não informado')}
    </p>

    <div class="bio-wrapper">
  <p class="bio collapsed">
    ${escapeHtml(profile.bio || profile.descricao || 'Sem descrição.')}
  </p>

  <button class="toggle-bio-btn" type="button">
    Veja mais
  </button>
</div>

    <a
      href="profile.html?id=${encodeURIComponent(profile.id)}"
      class="btn btn-primary"
    >
      Ver perfil
    </a>
  </article>
`).join('');

document.querySelectorAll('.toggle-bio-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const bio = button.previousElementSibling;

    bio.classList.toggle('collapsed');

    if (bio.classList.contains('collapsed')) {
      button.textContent = 'Veja mais';
    } else {
      button.textContent = 'Veja menos';
    }
  });
});

      renderPagination();
      updatePageUrl(currentPage);

      if (resultsShowingSummary) {
        resultsShowingSummary.textContent = `Mostrando ${endIndex} de ${filtered.length} profissionais`;
      }

      if (shouldScroll) {
        resultsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    renderPage(currentPage);

} catch (error) {
  console.error(error);

  resumo.textContent = 'Erro ao carregar resultados.';
  if (resultsShowingSummary) resultsShowingSummary.textContent = '';
  if (paginationControls) paginationControls.innerHTML = '';

  resultsGrid.innerHTML = `
    <div class="empty-results">
      <h3>Erro ao buscar profissionais.</h3>
    </div>
  `;
}
});
