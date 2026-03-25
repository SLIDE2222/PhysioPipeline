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
      atendimento: formData.get("atendimento")?.trim() || "",
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
  const especialidade = params.get("especialidade") || "";
  const cidade = params.get("cidade") || "";

  const resultadosFiltrados = profissionais.filter((p) => {
    return (
      (!especialidade || p.especialidade === especialidade) &&
      (!cidade || p.cidade === cidade)
    );
  });

  resultsGrid.innerHTML = "";

  resultadosFiltrados.forEach((profissional, index) => {
    const card = document.createElement("article");
    card.className = "result-card";

    card.innerHTML = `
      <h3>${profissional.nome}</h3>

      <p><strong>Especialidade:</strong> ${profissional.especialidade}</p>
      <p><strong>Cidade:</strong> ${profissional.cidade}</p>
      <p><strong>Atendimento:</strong> ${profissional.atendimento}</p>

      <div class="card-actions">
        <a href="profile.html?id=${index}" class="btn btn-secondary">Perfil</a>
        <a href="${profissional.contato}" target="_blank" class="btn btn-primary">
          Entrar em contato
        </a>
      </div>
    `;

    resultsGrid.appendChild(card);
  });
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