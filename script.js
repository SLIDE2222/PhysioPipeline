// =======================
// DATA
// =======================
const especialidades = [
  "Fisioterapia Ortopédica",
  "Fisioterapia Esportiva",
  "Fisioterapia Neurológica",
  "Fisioterapia Geriátrica",
  "Fisioterapia Respiratória",
  "Pós-operatório"
];

const cidades = [
  "São Paulo",
  "Sorocaba",
  "Itapetininga"
];

const profissionais = [
  {
    nome: "Dra. Mariana Alves",
    especialidade: "Fisioterapia Ortopédica",
    cidade: "São Paulo",
    atendimento: "Clínica e domiciliar",
    contato: "https://wa.me/5511999991111"
  },
  {
    nome: "Dr. Lucas Ferreira",
    especialidade: "Fisioterapia Esportiva",
    cidade: "Sorocaba",
    atendimento: "Clínica",
    contato: "https://wa.me/5511999992222"
  },
  {
    nome: "Dra. Renata Moura",
    especialidade: "Fisioterapia Neurológica",
    cidade: "Sorocaba",
    atendimento: "Domiciliar",
    contato: "https://wa.me/5511999993333"
  },
  {
    nome: "Dra. Patrícia Lima",
    especialidade: "Fisioterapia Respiratória",
    cidade: "Itapetininga",
    atendimento: "Clínica e domiciliar",
    contato: "https://wa.me/5511999994444"
  },
  {
    nome: "Dr. André Souza",
    especialidade: "Fisioterapia Geriátrica",
    cidade: "São Paulo",
    atendimento: "Domiciliar",
    contato: "https://wa.me/5511999995555"
  },
  {
    nome: "Dra. Camila Rocha",
    especialidade: "Pós-operatório",
    cidade: "Itapetininga",
    atendimento: "Clínica",
    contato: "https://wa.me/5511999996666"
  }
];

// =======================
// AUTH (GLOBAL)
// =======================
function getLoggedUser() {
  const id = localStorage.getItem("loggedPhysioId");
  if (!id) return null;

  const perfis = JSON.parse(localStorage.getItem("physioProfiles")) || [];
  return perfis.find((p) => p.id === id);
}

function logout() {
  localStorage.removeItem("loggedPhysioId");
  window.location.reload();
}

function renderAuthArea() {
  const authArea = document.getElementById("authArea");
  if (!authArea) return;

  const user = getLoggedUser();

  if (!user) {
    authArea.innerHTML = `
      <a href="login.html" class="btn btn-outline">Entrar</a>
      <a href="cadastro.html" class="btn btn-primary">Cadastrar</a>
    `;
  } else {
    const firstName = user.nome.split(" ")[0];

    authArea.innerHTML = `
      <span class="user-greeting">Olá, ${firstName}</span>

      <a href="profile.html?id=${user.id}" class="btn btn-outline">
        Meu perfil
      </a>

      <button class="btn btn-secondary" onclick="logout()">
        Sair
      </button>
    `;
  }
}

function updateCTAProfileButton() {
  const btn = document.getElementById("ctaProfileBtn");
  if (!btn) return;

  const user = getLoggedUser();

  if (user) {
    btn.textContent = "Meu perfil";
    btn.href = `profile.html?id=${user.id}`;
  } else {
    btn.textContent = "Criar perfil";
    btn.href = "cadastro.html";
  }
}

// =======================
// MAP HELPERS
// =======================
function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCoordsForProfile(profile) {
  const explicitLat = toNumber(profile?.lat);
  const explicitLng = toNumber(profile?.lng);

  if (explicitLat !== null && explicitLng !== null) {
    return { lat: explicitLat, lng: explicitLng };
  }

  const cityKey = (profile?.cidade || "").trim().toLowerCase();
  const base = cityCoordinates[cityKey];
  if (!base) return null;

  const bairro = (profile?.bairro || "").trim();
  if (!bairro) return base;

  let hash = 0;
  for (let i = 0; i < bairro.length; i += 1) {
    hash += bairro.charCodeAt(i) * (i + 1);
  }

  const latOffset = ((hash % 17) - 8) * 0.003;
  const lngOffset = (((Math.floor(hash / 17)) % 17) - 8) * 0.003;

  return {
    lat: base.lat + latOffset,
    lng: base.lng + lngOffset
  };
}

function buildWhatsAppLink(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "#";
  const fullNumber = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${fullNumber}`;
}

function clearMapMarkers() {
  resultsMarkers.forEach((marker) => marker.setMap(null));
  resultsMarkers = [];
}

function renderPhysiosOnMap(filteredPhysios = null) {
  if (!resultsMap || typeof google === "undefined") return;

  clearMapMarkers();

  const physios = Array.isArray(filteredPhysios) ? filteredPhysios : currentFilteredResults;
  const bounds = new google.maps.LatLngBounds();
  let hasMarkers = false;

  physios.forEach((physio) => {
    const coords = getCoordsForProfile(physio);
    if (!coords) return;

    const marker = new google.maps.Marker({
      position: coords,
      map: resultsMap,
      title: physio.nome || "Fisioterapeuta"
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="max-width:220px; line-height:1.45;">
          <strong>${physio.nome || "Fisioterapeuta"}</strong><br>
          <span>${physio.especialidade || ""}</span><br>
          <span>${physio.cidade || ""}${physio.bairro ? " - " + physio.bairro : ""}</span>
        </div>
      `
    });

    marker.addListener("click", () => {
      infoWindow.open(resultsMap, marker);
    });

    resultsMarkers.push(marker);
    bounds.extend(marker.getPosition());
    hasMarkers = true;
  });

  if (hasMarkers) {
    resultsMap.fitBounds(bounds);
    if (physios.length === 1) {
      resultsMap.setZoom(13);
    }
    return;
  }

  resultsMap.setCenter(cityCoordinates["campinas"]);
  resultsMap.setZoom(7);
}

function initMap() {
  const mapElement = document.getElementById("map");
  if (!mapElement || typeof google === "undefined") return;

  resultsMap = new google.maps.Map(mapElement, {
    center: cityCoordinates["campinas"],
    zoom: 7,
    mapTypeControl: false,
    streetViewControl: false
  });

  renderPhysiosOnMap(currentFilteredResults);
}

window.initMap = initMap;

// =======================
// AUTOCOMPLETE
// =======================
function setupAutocomplete(inputId, listId, options) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  if (!input || !list) return;

  function hideList() {
    list.innerHTML = "";
    list.classList.remove("show");
  }

  function renderSuggestions(value) {
    const term = value.trim().toLowerCase();
    list.innerHTML = "";

    if (!term) {
      hideList();
      return;
    }

    const filtered = options.filter((option) =>
      option.toLowerCase().includes(term)
    );

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
      });

      list.appendChild(li);
    });

    list.classList.add("show");
  }

  input.addEventListener("input", () => {
    renderSuggestions(input.value);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      const typedValue = input.value.trim().toLowerCase();

      const validOption = options.find(
        (option) => option.toLowerCase() === typedValue
      );

      if (!validOption) {
        input.value = "";
      }

      hideList();
    }, 150);
  });

  document.addEventListener("click", (event) => {
    if (!input.contains(event.target) && !list.contains(event.target)) {
      hideList();
    }
  });
}

// =======================
// CADASTRO (SIGN UP)
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

      if (confirmarInput.value !== senhaInput.value) {
        senhaErro.textContent = "As senhas não coincidem.";
      } else {
        senhaErro.textContent = "";
      }
    });
  }

  cadastroForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(cadastroForm);

    const senha = formData.get("senha");
    const confirmarSenha = document.getElementById("confirmarSenha").value;

    senhaErro.textContent = "";

    if (senha !== confirmarSenha) {
      senhaErro.textContent = "As senhas não coincidem.";
      return;
    }

    if (!senha || senha.length < 6) {
      senhaErro.textContent = "A senha deve ter pelo menos 6 caracteres.";
      return;
    }

    const novoPerfil = {
      id: Date.now().toString(),
      nome: formData.get("nome")?.trim() || "",
      email: formData.get("email")?.trim() || "",
      senha: formData.get("senha")?.trim() || "",
      telefone: formData.get("telefone")?.trim() || "",
      especialidade: formData.get("especialidade")?.trim() || "",
      cidade: formData.get("cidade")?.trim() || "",
      bairro: formData.get("bairro")?.trim() || "",
      atendimento: formData.get("atendimento")?.trim() || "",
      lat: toNumber(formData.get("lat")),
      lng: toNumber(formData.get("lng")),
      instagram: formData.get("instagram")?.trim() || "",
      linkedin: formData.get("linkedin")?.trim() || "",
      foto: fotoBase64,
      descricao: formData.get("descricao")?.trim() || ""
    };

    const perfisSalvos =
      JSON.parse(localStorage.getItem("physioProfiles")) || [];

    const emailJaExiste = perfisSalvos.some(
      (perfil) => perfil.email.toLowerCase() === novoPerfil.email.toLowerCase()
    );

    if (emailJaExiste) {
      cadastroMensagem.textContent = "Já existe uma conta com esse e-mail.";
      cadastroMensagem.style.color = "#b91c1c";
      return;
    }

    if (!novoPerfil.foto) {
      const nomeCodificado = encodeURIComponent(novoPerfil.nome);
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
// RESULTADOS
// =======================
function renderizarResultados() {
  const resultsGrid = document.getElementById("resultsGrid");
  const resultadoResumo = document.getElementById("resultadoResumo");

  if (!resultsGrid || !resultadoResumo) return;

  const params = new URLSearchParams(window.location.search);
  const especialidade = (params.get("especialidade") || "").trim().toLowerCase();
  const cidade = (params.get("cidade") || "").trim().toLowerCase();
  const bairro = (params.get("bairro") || "").trim().toLowerCase();

  const perfisSalvos =
    JSON.parse(localStorage.getItem("physioProfiles")) || [];

  const baseProfissionais = [
    {
      id: "demo-1",
      nome: "Dra. Mariana Alves",
      especialidade: "Fisioterapia Ortopédica",
      cidade: "São Paulo",
      bairro: "Moema",
      atendimento: "Clínica e domiciliar",
      telefone: "11999991111",
      email: "mariana@example.com",
      descricao: "Especialista em reabilitação musculoesquelética."
    },
    {
      id: "demo-2",
      nome: "Dr. Lucas Ferreira",
      especialidade: "Fisioterapia Esportiva",
      cidade: "Sorocaba",
      bairro: "Campolim",
      atendimento: "Clínica",
      telefone: "11999992222",
      email: "lucas@example.com",
      descricao: "Atendimento voltado à recuperação esportiva."
    },
    {
      id: "demo-3",
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
      id: "demo-4",
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
      id: "demo-5",
      nome: "Dr. André Souza",
      especialidade: "Fisioterapia Geriátrica",
      cidade: "São Paulo",
      bairro: "Tatuapé",
      atendimento: "Domiciliar",
      telefone: "11999995555",
      email: "andre@example.com",
      descricao: "Atendimento para idosos com foco em mobilidade."
    },
    {
      id: "demo-6",
      nome: "Dra. Camila Rocha",
      especialidade: "Pós-operatório",
      cidade: "Itapetininga",
      bairro: "Vila Barth",
      atendimento: "Clínica",
      telefone: "11999996666",
      email: "camila@example.com",
      descricao: "Recuperação pós-cirúrgica estruturada."
    }
  ];

  const todosProfissionais = [...baseProfissionais, ...perfisSalvos];

  const resultadosFiltrados = todosProfissionais.filter((p) => {
    const esp = (p.especialidade || "").trim().toLowerCase();
    const cid = (p.cidade || "").trim().toLowerCase();
    const bai = (p.bairro || "").trim().toLowerCase();

    return (
      (!especialidade || esp === especialidade) &&
      (!cidade || cid === cidade) &&
      (!bairro || bai === bairro)
    );
  });

  currentFilteredResults = resultadosFiltrados;
  resultsGrid.innerHTML = "";

  if (resultadosFiltrados.length === 0) {
    resultadoResumo.textContent = "Nenhum profissional encontrado para essa busca.";
    clearMapMarkers();

    resultsGrid.innerHTML = `
      <article class="result-card">
        <h3>Nenhum resultado</h3>
        <p>Tente buscar outra especialidade, cidade ou bairro.</p>
        <div class="card-actions">
          <a href="buscar.html" class="btn btn-primary">Nova busca</a>
          <a href="cadastro.html" class="btn btn-secondary">Cadastrar perfil</a>
        </div>
      </article>
    `;

    if (resultsMap) {
      resultsMap.setCenter(cityCoordinates["campinas"]);
      resultsMap.setZoom(7);
    }
    return;
  }

  resultadoResumo.textContent = `${resultadosFiltrados.length} profissional(is) encontrado(s).`;

  resultadosFiltrados.forEach((profissional) => {
    const card = document.createElement("article");
    card.className = "result-card";

    const whatsappLink = buildWhatsAppLink(profissional.telefone);

    card.innerHTML = `
      <h3>${profissional.nome}</h3>
      <p><strong>Especialidade:</strong> ${profissional.especialidade || "-"}</p>
      <p><strong>Cidade:</strong> ${profissional.cidade || "-"}${profissional.bairro ? " - " + profissional.bairro : ""}</p>
      <p><strong>Atendimento:</strong> ${profissional.atendimento || "-"}</p>

      <div class="card-actions">
        <a href="profile.html?id=${profissional.id}" class="btn btn-secondary">
          Ver perfil
        </a>
        ${
          profissional.telefone
            ? `<a href="${whatsappLink}" target="_blank" class="btn btn-primary">
                WhatsApp
              </a>`
            : ""
        }
      </div>
    `;

    resultsGrid.appendChild(card);
  });

  renderPhysiosOnMap(resultadosFiltrados);
}

// =======================
// MOBILE HEADER BEHAVIOR
// =======================
function setupMobileHeaderBehavior() {
  const header = document.querySelector(".header");
  const authArea = document.getElementById("authArea");

  if (!header) return;

  const isMobile = () => window.innerWidth <= 768;
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const isHomePage =
    currentPage === "index.html" || currentPage === "";

  let lastScrollY = window.scrollY;

  header.classList.add("header-mobile-hide");

  function applyInitialState() {
    if (!isMobile()) {
      header.classList.remove("header-collapsed");
      return;
    }

    // Hide auth/buttons by default on pages other than home
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

    // On non-home pages, keep collapsed basically always
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

  // Optional: if auth area changes after login render, keep state correct
  if (authArea) {
    const observer = new MutationObserver(() => {
      applyInitialState();
    });

    observer.observe(authArea, { childList: true, subtree: true });
  }
}

// =======================
// INIT
// =======================
setupAutocomplete("specialtyInput", "suggestionsList", especialidades);
setupAutocomplete("buscarEspecialidade", "buscarSuggestions", especialidades);
setupAutocomplete("buscarCidade", "cidadeSuggestions", cidades);

setupCadastroForm();
renderizarResultados();
renderAuthArea();
updateCTAProfileButton();
setupMobileHeaderBehavior();