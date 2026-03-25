const container = document.getElementById("profileContainer");

// GET ID FROM URL
const params = new URLSearchParams(window.location.search);
const profileId = params.get("id");

// GET DATA
const perfisSalvos = JSON.parse(localStorage.getItem("physioProfiles")) || [];
const loggedPhysioId = localStorage.getItem("loggedPhysioId");

// FIND PROFILE
const profissional = perfisSalvos.find((perfil) => perfil.id === profileId);

// =========================
// NOT FOUND
// =========================
if (!container) {
  console.error("Elemento #profileContainer não encontrado.");
} else if (!profissional) {
  container.innerHTML = `
    <article class="profile-card-full">
      <h2>Perfil não encontrado</h2>
      <p>Esse perfil não existe ou ainda não foi criado.</p>

      <div class="profile-actions">
        <a href="cadastro.html" class="btn btn-primary">Cadastrar perfil</a>
        <a href="buscar.html" class="btn btn-secondary">Voltar para busca</a>
      </div>
    </article>
  `;
}

// =========================
// PROFILE FOUND
// =========================
else {
  const isOwner = loggedPhysioId === profissional.id;

 const fotoHTML = profissional.foto
  ? `<img src="${profissional.foto}" alt="${profissional.nome}" class="clickable-avatar">`
  : `<span>${profissional.nome.charAt(0).toUpperCase()}</span>`;

  const whatsappLink = profissional.telefone
    ? `https://wa.me/55${profissional.telefone.replace(/\D/g, "")}`
    : "#";

  container.innerHTML = `
    <article class="profile-card-full">

      <!-- HEADER -->
      <div class="profile-header">
        <div class="profile-avatar-big">
          ${fotoHTML}
        </div>

        <div class="profile-head-info">
          <h1>${profissional.nome}</h1>
          <p class="profile-specialty">${profissional.especialidade}</p>
          <p class="profile-city">${profissional.cidade}</p>
        </div>
      </div>

      <!-- BADGES -->
      <div class="profile-badges">
        ${
          profissional.atendimento
            ? `<span class="profile-badge">${profissional.atendimento}</span>`
            : ""
        }
        ${
          profissional.cidade
            ? `<span class="profile-badge">${profissional.cidade}</span>`
            : ""
        }
      </div>

      <!-- ABOUT -->
      <section class="profile-section">
        <h3>Sobre</h3>
        <p>
          ${
            profissional.descricao
              ? profissional.descricao
              : "Esse profissional ainda não adicionou uma descrição."
          }
        </p>
      </section>

      <!-- CONTACT -->
      <section class="profile-section">
        <h3>Contato</h3>

        <div class="profile-contact-list">
          <p><strong>E-mail:</strong> ${profissional.email || "-"}</p>
          <p><strong>Telefone:</strong> ${profissional.telefone || "-"}</p>
        </div>

        <div class="profile-actions">

          <!-- WHATSAPP -->
          ${
            profissional.telefone
              ? `<a href="${whatsappLink}" target="_blank" class="btn btn-primary">
                  Falar no WhatsApp
                </a>`
              : ""
          }

          <!-- INSTAGRAM -->
          ${
            profissional.instagram
              ? `<a href="${profissional.instagram}" target="_blank" class="btn btn-outline">
                  📸 Instagram
                </a>`
              : ""
          }

          <!-- LINKEDIN -->
          ${
            profissional.linkedin
              ? `<a href="${profissional.linkedin}" target="_blank" class="btn btn-outline">
                  💼 LinkedIn
                </a>`
              : ""
          }

          <!-- EDIT (ONLY OWNER) -->
          ${
            isOwner
              ? `<a href="editar-perfil.html" class="btn btn-secondary">
                  ✏️ Editar perfil
                </a>`
              : ""
          }

          <!-- BACK -->
          <a href="buscar.html" class="btn btn-secondary">
            Voltar
          </a>

        </div>
      </section>

    </article>
  `;
}

// =========================
// AVATAR CLICK (OPEN IMAGE)
// =========================
const avatar = container.querySelector(".clickable-avatar");
const modal = document.getElementById("imgModal");
const modalImg = document.getElementById("imgModalContent");

if (avatar && modal && modalImg) {
  avatar.addEventListener("click", () => {
    modal.classList.add("show");
    modalImg.src = avatar.src;
  });

  modal.addEventListener("click", () => {
    modal.classList.remove("show");
  });
}