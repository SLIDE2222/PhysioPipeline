let cachedMyProfile = null;

const SPECIALTIES = [
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

  inputElement.addEventListener('input', refreshSuggestions);

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
    optionsProvider: () => SPECIALTIES,
    minChars: 0,
    showOnFocus: true
  });
}

function setupCityNeighborhoodAutocomplete(cityInputId, cityListId, neighborhoodInputId, neighborhoodListId) {
  const cityInput = document.getElementById(cityInputId);
  const neighborhoodInput = document.getElementById(neighborhoodInputId);
  const neighborhoodList = document.getElementById(neighborhoodListId);

  if (!cityInput || !neighborhoodInput || !neighborhoodList) return;

  const getMatchedCity = () => findExactMatch(CITIES, cityInput.value);

  const syncNeighborhoodState = () => {
    const matchedCity = getMatchedCity();
    const neighborhoods = matchedCity ? CITY_NEIGHBORHOODS[matchedCity] || [] : [];

    if (!matchedCity) {
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
    optionsProvider: () => CITIES,
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

    try {
      const meData = await window.physioApi.me();
      rawUser = meData?.user ?? meData ?? rawUser;
    } catch (error) {
      console.warn('Using stored auth fallback because /auth/me failed:', error);
    }

    let profile = null;
    if (window.physioApi.fetchMyProfile) {
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


function updateProfileButtons(user) {
  const heroBtn = document.getElementById('heroProfileBtn');
  const ctaBtn = document.getElementById('ctaProfileBtn');

  const profileHref = user.profile?.id
    ? `profile.html?id=${encodeURIComponent(user.profile.id)}`
    : 'cadastro.html';

  const text = user.profile ? 'Meu perfil' : 'Criar perfil';

  [heroBtn, ctaBtn].forEach((btn) => {
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
  const profileHref = user.profile?.id
    ? `profile.html?id=${encodeURIComponent(user.profile.id)}`
    : 'cadastro.html';

  authArea.innerHTML = `
    <span class="user-greeting">Olá, ${escapeHtml(firstName)}</span>
    <a href="${profileHref}" class="btn btn-outline">Meu perfil</a>
    <button class="btn btn-secondary" onclick="logout()">Sair</button>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await renderAuthArea();

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
});

// ===============================
// RESULTADOS DA BUSCA
// ===============================

document.addEventListener('DOMContentLoaded', async () => {
  const resultsGrid = document.getElementById('resultsGrid');

  // Só executa em resultados.html
  if (!resultsGrid) return;

  const resumo = document.getElementById('resultadoResumo');

  const params = new URLSearchParams(window.location.search);

  const especialidade = normalizeText(
    params.get('especialidade') || ''
  );

  const cidade = normalizeText(
    params.get('cidade') || ''
  );

  const bairro = normalizeText(
    params.get('bairro') || ''
  );

  try {
    resumo.textContent = 'Buscando profissionais...';

    const profiles = await window.physioApi.fetchProfiles();

    const filtered = profiles.filter((profile) => {
     const pEspecialidade = normalizeText(profile.especialidade || profile.specialty);
const pCidade = normalizeText(profile.cidade || profile.city);
const pBairro = normalizeText(profile.bairro || profile.neighborhood);

      const specialtyMatch =
        !especialidade || pEspecialidade.includes(especialidade);

      const cityMatch =
        !cidade || pCidade.includes(cidade);

      const neighborhoodMatch =
        !bairro || pBairro.includes(bairro);

      return specialtyMatch && cityMatch && neighborhoodMatch;
    });

    resumo.textContent = `${filtered.length} profissional(is) encontrado(s)`;

    if (filtered.length === 0) {
      resultsGrid.innerHTML = `
        <div class="empty-results">
          <h3>Nenhum profissional encontrado.</h3>
          <p>Tente pesquisar outra especialidade ou cidade.</p>
        </div>
      `;
      return;
    }

    const shuffledProfiles = [...filtered].sort(() => Math.random() - 0.5);

   resultsGrid.innerHTML = shuffledProfiles.map((profile) => `
  <article class="result-card">
    <h3>
      ${escapeHtml(profile.nome || profile.name || 'Fisioterapeuta')}
    </h3>

    <p>
      <strong>Especialidade:</strong>
      ${escapeHtml(profile.especialidade || profile.specialty || 'Não informado')}
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

} catch (error) {
  console.error(error);

  resumo.textContent = 'Erro ao carregar resultados.';

  resultsGrid.innerHTML = `
    <div class="empty-results">
      <h3>Erro ao buscar profissionais.</h3>
    </div>
  `;
}
});