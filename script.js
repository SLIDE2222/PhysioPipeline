// =======================
// CORE DATA
// =======================
const especialidades = [
  "Fisioterapia Ortopédica",
  "Fisioterapia Esportiva",
  "Fisioterapia Neurológica",
  "Fisioterapia Geriátrica",
  "Fisioterapia Respiratória",
  "Pós-operatório"
];

const cityCoordinates = {
  "sao paulo": { lat: -23.55052, lng: -46.633308 },
  "sorocaba": { lat: -23.501533, lng: -47.452594 },
  "itapetininga": { lat: -23.591668, lng: -48.053055 }
};

const bairrosPorCidade = {
  "sao paulo": [
    "Aclimação", "Bela Vista", "Belém", "Bom Retiro", "Brooklin", "Butantã",
    "Campo Belo", "Casa Verde", "Consolação", "Freguesia do Ó", "Higienópolis",
    "Ipiranga", "Itaim Bibi", "Itaquera", "Jabaquara", "Jardins", "Lapa",
    "Liberdade", "Moema", "Morumbi", "Mooca", "Pari", "Penha", "Perdizes",
    "Pinheiros", "Sacomã", "Santa Cecília", "Santana", "Santo Amaro", "Saúde",
    "Sé", "Tatuapé", "Tremembé", "Vila Andrade", "Vila Leopoldina",
    "Vila Mariana", "Vila Matilde", "Vila Prudente"
  ],
  "sorocaba": [
    "Além Ponte", "Campolim", "Centro", "Jardim América", "Jardim Europa",
    "Jardim Gonçalves", "Mangal", "Santa Rosália", "Vila Amélia",
    "Vila Carvalho", "Vila Haro", "Wanel Ville"
  ],
  "itapetininga": [
    "Centro", "Jardim Itália", "Jardim Marabá", "Vila Barth", "Vila Belo Horizonte",
    "Vila Hungria", "Vila Nova", "Vila Rio Branco", "Chapada Grande", "Taboãozinho"
  ]
};

const cidades = ["São Paulo", "Sorocaba", "Itapetininga"];

const cityAliases = {
  sp: "São Paulo",
  "sao paulo": "São Paulo",
  "são paulo": "São Paulo",
  sampa: "São Paulo",
  sorocaba: "Sorocaba",
  itapetininga: "Itapetininga"
};

const demoProfiles = [
  {
    id: "demo-1",
    nome: "Dra. Mariana Alves",
    especialidade: "Fisioterapia Ortopédica",
    cidade: "São Paulo",
    bairro: "Moema",
    atendimento: "Clínica e domiciliar",
    telefone: "11999991111",
    email: "mariana@example.com",
    descricao: "Especialista em reabilitação musculoesquelética e recuperação funcional."
  },
  {
    id: "demo-2",
    nome: "Dr. Felipe Costa",
    especialidade: "Fisioterapia Ortopédica",
    cidade: "São Paulo",
    bairro: "Tatuapé",
    atendimento: "Clínica",
    telefone: "11999990002",
    email: "felipe@example.com",
    descricao: "Atendimento focado em coluna, joelho e pós-lesão esportiva."
  },
  {
    id: "demo-3",
    nome: "Dra. Beatriz Nogueira",
    especialidade: "Fisioterapia Esportiva",
    cidade: "São Paulo",
    bairro: "Pinheiros",
    atendimento: "Clínica e domiciliar",
    telefone: "11999990003",
    email: "beatriz@example.com",
    descricao: "Recuperação esportiva com foco em retorno seguro ao treino."
  },
  {
    id: "demo-4",
    nome: "Dr. André Souza",
    especialidade: "Fisioterapia Geriátrica",
    cidade: "São Paulo",
    bairro: "Santana",
    atendimento: "Domiciliar",
    telefone: "11999990004",
    email: "andre@example.com",
    descricao: "Atendimento voltado à mobilidade, equilíbrio e autonomia do idoso."
  },
  {
    id: "demo-5",
    nome: "Dra. Camila Rocha",
    especialidade: "Pós-operatório",
    cidade: "São Paulo",
    bairro: "Vila Mariana",
    atendimento: "Clínica",
    telefone: "11999990005",
    email: "camila@example.com",
    descricao: "Recuperação pós-cirúrgica com plano progressivo e acompanhamento próximo."
  },
  {
    id: "demo-6",
    nome: "Dra. Larissa Prado",
    especialidade: "Fisioterapia Respiratória",
    cidade: "São Paulo",
    bairro: "Saúde",
    atendimento: "Clínica e domiciliar",
    telefone: "11999990006",
    email: "larissa@example.com",
    descricao: "Suporte respiratório com foco em qualidade de vida e condicionamento."
  },
  {
    id: "demo-7",
    nome: "Dr. Lucas Ferreira",
    especialidade: "Fisioterapia Esportiva",
    cidade: "Sorocaba",
    bairro: "Campolim",
    atendimento: "Clínica",
    telefone: "11999992222",
    email: "lucas@example.com",
    descricao: "Atendimento voltado à recuperação esportiva e prevenção de recaídas."
  },
  {
    id: "demo-8",
    nome: "Dra. Renata Moura",
    especialidade: "Fisioterapia Neurológica",
    cidade: "Sorocaba",
    bairro: "Centro",
    atendimento: "Domiciliar",
    telefone: "11999993333",
    email: "renata@example.com",
    descricao: "Reabilitação funcional em condições neurológicas."
  },
  {
    id: "demo-9",
    nome: "Dr. Bruno Martins",
    especialidade: "Fisioterapia Ortopédica",
    cidade: "Sorocaba",
    bairro: "Jardim Europa",
    atendimento: "Clínica e domiciliar",
    telefone: "11999990009",
    email: "bruno@example.com",
    descricao: "Atuação em dor lombar, ombro e joelho com foco em retorno às atividades."
  },
  {
    id: "demo-10",
    nome: "Dra. Patrícia Lima",
    especialidade: "Fisioterapia Respiratória",
    cidade: "Itapetininga",
    bairro: "Centro",
    atendimento: "Clínica e domiciliar",
    telefone: "11999994444",
    email: "patricia@example.com",
    descricao: "Suporte respiratório com foco em qualidade de vida."
  },
  {
    id: "demo-11",
    nome: "Dr. Heitor Sampaio",
    especialidade: "Fisioterapia Geriátrica",
    cidade: "Itapetininga",
    bairro: "Vila Barth",
    atendimento: "Domiciliar",
    telefone: "11999990011",
    email: "heitor@example.com",
    descricao: "Mobilidade, fortalecimento e prevenção de quedas."
  },
  {
    id: "demo-12",
    nome: "Dra. Júlia Moraes",
    especialidade: "Pós-operatório",
    cidade: "Itapetininga",
    bairro: "Jardim Itália",
    atendimento: "Clínica",
    telefone: "11999990012",
    email: "julia@example.com",
    descricao: "Atuação em recuperação pós-operatória com reavaliação contínua."
  }
];

let currentFilteredResults = [];

// =======================
// HELPERS
// =======================
function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resolveCityName(value) {
  const normalized = normalizeText(value);
  return cityAliases[normalized] || value || "";
}

function toTitleCase(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildWhatsAppLink(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "#";
  const fullNumber = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${fullNumber}`;
}

function getLoggedUser() {
  const id = localStorage.getItem("loggedPhysioId");
  if (!id) return null;

  const perfis = JSON.parse(localStorage.getItem("physioProfiles")) || [];
  return perfis.find((p) => p.id === id) || null;
}

function logout() {
  localStorage.removeItem("loggedPhysioId");
  window.location.reload();
}

function getAllProfiles() {
  const perfisSalvos = JSON.parse(localStorage.getItem("physioProfiles")) || [];
  return [...demoProfiles, ...perfisSalvos];
}

function getNeighborhoodListByCity(city) {
  const cityKey = normalizeText(resolveCityName(city));
  return bairrosPorCidade[cityKey] || [];
}

function getAllNeighborhoods() {
  return Array.from(new Set(Object.values(bairrosPorCidade).flat())).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function getCoordsForProfile(profile) {
  const explicitLat = toNumber(profile?.lat);
  const explicitLng = toNumber(profile?.lng);

  if (explicitLat !== null && explicitLng !== null) {
    return { lat: explicitLat, lng: explicitLng };
  }

  const cityKey = normalizeText(profile?.cidade);
  const base = cityCoordinates[cityKey];
  if (!base) return null;

  const bairros = getNeighborhoodListByCity(profile?.cidade);
  const bairroIndex = bairros.findIndex((item) => normalizeText(item) === normalizeText(profile?.bairro));

  const spreadIndex = bairroIndex >= 0 ? bairroIndex : Math.abs((profile?.nome || "").length % 12);
  const latOffset = ((spreadIndex % 6) - 2.5) * 0.012;
  const lngOffset = ((Math.floor(spreadIndex / 6) % 6) - 2.5) * 0.012;

  return {
    lat: base.lat + latOffset,
    lng: base.lng + lngOffset
  };
}

function getNeighborhoodBadge(profile) {
  const cidade = profile?.cidade || "";
  const bairro = profile?.bairro || "";
  return [cidade, bairro].filter(Boolean).join(" • ") || "Localização não informada";
}

function scoreNeighborhoodMatch(searchNeighborhood, profileNeighborhood) {
  const search = normalizeText(searchNeighborhood);
  const profile = normalizeText(profileNeighborhood);

  if (!search) return 0;
  if (!profile) return 999;
  if (profile === search) return 0;
  if (profile.startsWith(search)) return 1;
  if (profile.includes(search) || search.includes(profile)) return 2;
  return 999;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =======================
// AUTH UI
// =======================
function renderAuthArea() {
  const authArea = document.getElementById("authArea");
  if (!authArea) return;

  const user = getLoggedUser();

  if (!user) {
    authArea.innerHTML = `
      <a href="login.html" class="btn btn-outline">Entrar</a>
      <a href="cadastro.html" class="btn btn-primary">Cadastrar</a>
    `;
    return;
  }

  const firstName = (user.nome || "Profissional").split(" ")[0];
  authArea.innerHTML = `
    <span class="user-greeting">Olá, ${escapeHtml(firstName)}</span>
    <a href="profile.html?id=${encodeURIComponent(user.id)}" class="btn btn-outline">Meu perfil</a>
    <button class="btn btn-secondary" onclick="logout()">Sair</button>
  `;
}

function updateCTAProfileButton() {
  const btn = document.getElementById("ctaProfileBtn");
  if (!btn) return;

  const user = getLoggedUser();
  if (!user) return;

  btn.textContent = "Meu perfil";
  btn.href = `profile.html?id=${user.id}`;
}

// =======================
// AUTOCOMPLETE
// =======================
function setupAutocomplete(inputId, listId, getOptions) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  if (!input || !list) return;

  function hideList() {
    list.innerHTML = "";
    list.classList.remove("show");
  }

  function renderSuggestions(value) {
    const term = normalizeText(value);
    const options = typeof getOptions === "function" ? getOptions() : getOptions;

    list.innerHTML = "";

    if (!term) {
      hideList();
      return;
    }

    const filtered = (options || [])
      .filter(Boolean)
      .filter((option) => normalizeText(option).includes(term))
      .slice(0, 8);

    if (filtered.length === 0) {
      hideList();
      return;
    }

    filtered.forEach((option) => {
      const li = document.createElement("li");
      li.textContent = option;
      li.addEventListener("click", () => {
        input.value = option;
        hideList();
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      list.appendChild(li);
    });

    list.classList.add("show");
  }

  input.addEventListener("input", () => renderSuggestions(input.value));
  input.addEventListener("focus", () => renderSuggestions(input.value));
  input.addEventListener("blur", () => {
    setTimeout(hideList, 150);
  });

  document.addEventListener("click", (event) => {
    if (!input.contains(event.target) && !list.contains(event.target)) {
      hideList();
    }
  });
}

function setupNeighborhoodFieldSync(cityInputId, bairroInputId, bairroListId) {
  const cityInput = document.getElementById(cityInputId);
  const bairroInput = document.getElementById(bairroInputId);
  const bairroList = document.getElementById(bairroListId);

  if (!cityInput || !bairroInput || !bairroList) return;

  const updatePlaceholder = () => {
    const options = getNeighborhoodListByCity(cityInput.value);

    if (options.length > 0) {
      bairroInput.placeholder = `Ex.: ${options.slice(0, 3).join(", ")}`;
      return;
    }

    bairroInput.placeholder = "Ex.: Centro, Tatuapé, Campolim";
  };

  cityInput.addEventListener("input", updatePlaceholder);
  cityInput.addEventListener("change", updatePlaceholder);
  updatePlaceholder();

  setupAutocomplete(bairroInputId, bairroListId, () => {
    const byCity = getNeighborhoodListByCity(cityInput.value);
    return byCity.length > 0 ? byCity : getAllNeighborhoods();
  });
}

// =======================
// SIGN UP
// =======================
function setupCadastroForm() {
  const cadastroForm = document.getElementById("cadastroForm");
  const cadastroMensagem = document.getElementById("cadastroMensagem");
  const fotoInput = document.getElementById("foto");
  const fotoPreview = document.getElementById("fotoPreview");
  const senhaInput = document.getElementById("senha");
  const confirmarInput = document.getElementById("confirmarSenha");
  const senhaErro = document.getElementById("senhaErro");

  if (!cadastroForm || !cadastroMensagem) return;

  let fotoBase64 = "";

  if (fotoInput && fotoPreview) {
    fotoInput.addEventListener("change", () => {
      const file = fotoInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        cadastroMensagem.textContent = "Escolha um arquivo de imagem válido.";
        cadastroMensagem.style.color = "#b91c1c";
        fotoInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = function (event) {
        fotoBase64 = event.target.result;
        fotoPreview.src = fotoBase64;
        fotoPreview.style.display = "block";
      };
      reader.readAsDataURL(file);
    });
  }

  if (senhaInput && confirmarInput && senhaErro) {
    confirmarInput.addEventListener("input", () => {
      if (!confirmarInput.value) {
        senhaErro.textContent = "";
        return;
      }

      senhaErro.textContent = confirmarInput.value !== senhaInput.value
        ? "As senhas não coincidem."
        : "";
    });
  }

  cadastroForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(cadastroForm);
    const senha = String(formData.get("senha") || "");
    const confirmarSenha = document.getElementById("confirmarSenha")?.value || "";

    if (senhaErro) senhaErro.textContent = "";

    if (senha !== confirmarSenha) {
      if (senhaErro) senhaErro.textContent = "As senhas não coincidem.";
      return;
    }

    if (senha.length < 6) {
      if (senhaErro) senhaErro.textContent = "A senha deve ter pelo menos 6 caracteres.";
      return;
    }

    const novoPerfil = {
      id: Date.now().toString(),
      nome: String(formData.get("nome") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      senha: senha.trim(),
      telefone: String(formData.get("telefone") || "").trim(),
      especialidade: String(formData.get("especialidade") || "").trim(),
      cidade: resolveCityName(String(formData.get("cidade") || "").trim()),
      bairro: String(formData.get("bairro") || "").trim(),
      atendimento: String(formData.get("atendimento") || "").trim(),
      lat: toNumber(formData.get("lat")),
      lng: toNumber(formData.get("lng")),
      instagram: String(formData.get("instagram") || "").trim(),
      linkedin: String(formData.get("linkedin") || "").trim(),
      foto: fotoBase64,
      descricao: String(formData.get("descricao") || "").trim()
    };

    const perfisSalvos = JSON.parse(localStorage.getItem("physioProfiles")) || [];
    const emailJaExiste = perfisSalvos.some(
      (perfil) => normalizeText(perfil.email) === normalizeText(novoPerfil.email)
    );

    if (emailJaExiste) {
      cadastroMensagem.textContent = "Já existe uma conta com esse e-mail.";
      cadastroMensagem.style.color = "#b91c1c";
      return;
    }

    if (!novoPerfil.foto) {
      const nomeCodificado = encodeURIComponent(novoPerfil.nome || "Perfil");
      novoPerfil.foto = `https://ui-avatars.com/api/?name=${nomeCodificado}&background=2563eb&color=fff&size=256`;
    }

    perfisSalvos.push(novoPerfil);
    localStorage.setItem("physioProfiles", JSON.stringify(perfisSalvos));
    localStorage.setItem("loggedPhysioId", novoPerfil.id);

    cadastroMensagem.textContent = "Conta criada com sucesso! Redirecionando...";
    cadastroMensagem.style.color = "#166534";

    cadastroForm.reset();
    if (fotoPreview) {
      fotoPreview.src = "";
      fotoPreview.style.display = "none";
    }

    setTimeout(() => {
      window.location.href = `profile.html?id=${novoPerfil.id}`;
    }, 700);
  });
}

// =======================
// RESULTS
// =======================
function buildResultsSummaryText(total, filters, usedNeighborhoodFallback) {
  const parts = [];
  if (filters.especialidade) parts.push(filters.especialidade);
  if (filters.cidade) parts.push(filters.cidade);
  if (filters.bairro) parts.push(filters.bairro);

  const suffix = parts.length > 0 ? ` para ${parts.join(" • ")}` : "";
  const fallback = usedNeighborhoodFallback
    ? " Não houve bairro exato, então os resultados mais próximos da mesma cidade foram exibidos."
    : "";

  return `${total} profissional(is) encontrado(s)${suffix}.${fallback}`;
}

function renderLocationPanel(results, filters, usedNeighborhoodFallback) {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  const cityLabel = filters.cidade || "Brasil";
  const exactNeighborhoodCount = filters.bairro
    ? results.filter((item) => normalizeText(item.bairro) === normalizeText(filters.bairro)).length
    : 0;

  const grouped = {};
  results.forEach((item) => {
    const key = item.bairro || item.cidade || "Área não informada";
    grouped[key] = (grouped[key] || 0) + 1;
  });

  const pills = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => `<span class="area-pill">${escapeHtml(name)} · ${count}</span>`)
    .join("");

  mapElement.className = "local-map-panel";
  mapElement.innerHTML = `
    <div class="local-map-panel__content">
      <p class="eyebrow">Cobertura</p>
      <h3>${escapeHtml(cityLabel)}</h3>
      <p>
        ${filters.bairro
          ? usedNeighborhoodFallback
            ? `Busca em <strong>${escapeHtml(filters.bairro)}</strong> sem correspondência exata. Mostrando resultados da mesma cidade para não deixar a página morrer à toa.`
            : `Busca com foco em <strong>${escapeHtml(filters.bairro)}</strong>. ${exactNeighborhoodCount} resultado(s) batendo exatamente com o bairro.`
          : "Resultados agrupados por bairro e cidade, sem depender de Google Maps nem de um boleto surpresa."}
      </p>
      <div class="area-pill-row">${pills || '<span class="area-pill">Sem áreas mapeadas</span>'}</div>
    </div>
  `;
}

function renderizarResultados() {
  const resultsGrid = document.getElementById("resultsGrid");
  const resultadoResumo = document.getElementById("resultadoResumo");
  if (!resultsGrid || !resultadoResumo) return;

  const params = new URLSearchParams(window.location.search);
  const filters = {
    especialidade: String(params.get("especialidade") || "").trim(),
    cidade: resolveCityName(String(params.get("cidade") || "").trim()),
    bairro: String(params.get("bairro") || "").trim()
  };

  const normEsp = normalizeText(filters.especialidade);
  const normCidade = normalizeText(filters.cidade);
  const normBairro = normalizeText(filters.bairro);

  const allProfiles = getAllProfiles();

  let filtered = allProfiles.filter((profile) => {
    const espMatch = !normEsp || normalizeText(profile.especialidade) === normEsp;
    const cityMatch = !normCidade || normalizeText(profile.cidade) === normCidade;
    const neighborhoodScore = scoreNeighborhoodMatch(filters.bairro, profile.bairro);
    const neighborhoodMatch = !normBairro || neighborhoodScore <= 2;

    return espMatch && cityMatch && neighborhoodMatch;
  });

  let usedNeighborhoodFallback = false;

  if (filtered.length === 0 && normBairro) {
    filtered = allProfiles.filter((profile) => {
      const espMatch = !normEsp || normalizeText(profile.especialidade) === normEsp;
      const cityMatch = !normCidade || normalizeText(profile.cidade) === normCidade;
      return espMatch && cityMatch;
    });
    usedNeighborhoodFallback = filtered.length > 0;
  }

  filtered = filtered
    .map((profile) => ({
      ...profile,
      _neighborhoodScore: scoreNeighborhoodMatch(filters.bairro, profile.bairro)
    }))
    .sort((a, b) => {
      if (a._neighborhoodScore !== b._neighborhoodScore) {
        return a._neighborhoodScore - b._neighborhoodScore;
      }

      const cityCompare = String(a.cidade || "").localeCompare(String(b.cidade || ""), "pt-BR");
      if (cityCompare !== 0) return cityCompare;

      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });

  currentFilteredResults = filtered;
  resultsGrid.innerHTML = "";

  if (filtered.length === 0) {
    resultadoResumo.textContent = "Nenhum profissional encontrado para essa busca.";
    renderLocationPanel([], filters, false);
    resultsGrid.innerHTML = `
      <article class="result-card">
        <h3>Nenhum resultado</h3>
        <p>Tente outra especialidade, cidade ou bairro. O sistema agora pelo menos não depende da benção paga do Google para existir.</p>
        <div class="card-actions">
          <a href="buscar.html" class="btn btn-primary">Nova busca</a>
          <a href="cadastro.html" class="btn btn-secondary">Cadastrar perfil</a>
        </div>
      </article>
    `;
    return;
  }

  resultadoResumo.textContent = buildResultsSummaryText(filtered.length, filters, usedNeighborhoodFallback);
  renderLocationPanel(filtered, filters, usedNeighborhoodFallback);

  filtered.forEach((profissional) => {
    const card = document.createElement("article");
    card.className = "result-card";

    const whatsappLink = buildWhatsAppLink(profissional.telefone);
    const exactNeighborhoodMatch = normBairro && normalizeText(profissional.bairro) === normBairro;

    card.innerHTML = `
      <h3>${escapeHtml(profissional.nome)}</h3>
      <p><strong>Especialidade:</strong> ${escapeHtml(profissional.especialidade || "-")}</p>
      <p><strong>Local:</strong> ${escapeHtml(getNeighborhoodBadge(profissional))}</p>
      <p><strong>Atendimento:</strong> ${escapeHtml(profissional.atendimento || "-")}</p>
      ${exactNeighborhoodMatch ? '<p class="result-highlight">Bairro exato encontrado</p>' : ""}
      <div class="card-actions">
        <a href="profile.html?id=${encodeURIComponent(profissional.id)}" class="btn btn-secondary">Ver perfil</a>
        ${profissional.telefone ? `<a href="${whatsappLink}" target="_blank" class="btn btn-primary">WhatsApp</a>` : ""}
      </div>
    `;

    resultsGrid.appendChild(card);
  });
}

// =======================
// MOBILE HEADER
// =======================
function setupMobileHeaderBehavior() {
  const header = document.querySelector(".header");
  const authArea = document.getElementById("authArea");
  if (!header) return;

  const isMobile = () => window.innerWidth <= 768;
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const isHomePage = currentPage === "index.html" || currentPage === "";
  let lastScrollY = window.scrollY;

  header.classList.add("header-mobile-hide");

  function applyInitialState() {
    if (!isMobile()) {
      header.classList.remove("header-collapsed");
      return;
    }

    if (!isHomePage) {
      header.classList.add("header-collapsed");
    } else {
      header.classList.remove("header-collapsed");
    }
  }

  function handleScroll() {
    if (!isMobile()) {
      header.classList.remove("header-collapsed");
      return;
    }

    const currentScrollY = window.scrollY;
    const scrollingDown = currentScrollY > lastScrollY;
    const scrolledEnough = currentScrollY > 40;

    if (!isHomePage) {
      header.classList.add("header-collapsed");
      lastScrollY = currentScrollY;
      return;
    }

    if (scrollingDown && scrolledEnough) {
      header.classList.add("header-collapsed");
    } else {
      header.classList.remove("header-collapsed");
    }

    lastScrollY = currentScrollY;
  }

  applyInitialState();
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", applyInitialState);

  if (authArea) {
    const observer = new MutationObserver(() => applyInitialState());
    observer.observe(authArea, { childList: true, subtree: true });
  }
}

// =======================
// INIT
// =======================
setupAutocomplete("specialtyInput", "suggestionsList", especialidades);
setupAutocomplete("buscarEspecialidade", "buscarSuggestions", especialidades);
setupAutocomplete("buscarCidade", "cidadeSuggestions", cidades);
setupNeighborhoodFieldSync("buscarCidade", "buscarBairro", "bairroSuggestions");
setupNeighborhoodFieldSync("cidadeCadastro", "bairro", "bairroCadastroSuggestions");
setupNeighborhoodFieldSync("cityIndexSelect", "buscarBairroIndex", "bairroIndexSuggestions");

setupCadastroForm();
renderizarResultados();
renderAuthArea();
updateCTAProfileButton();
setupMobileHeaderBehavior();
