const editarForm = document.getElementById("editarPerfilForm");
const editarMensagem = document.getElementById("editarMensagem");
const fotoInput = document.getElementById("foto");
const fotoPreview = document.getElementById("fotoPreview");

const loggedId = localStorage.getItem("loggedPhysioId");
const perfis = JSON.parse(localStorage.getItem("physioProfiles")) || [];

const perfilIndex = perfis.findIndex((p) => p.id === loggedId);

if (!loggedId || perfilIndex === -1) {
  window.location.href = "login.html";
}

const perfil = perfis[perfilIndex];
let fotoBase64 = perfil.foto || "";

// preload existing values
document.getElementById("telefone").value = perfil.telefone || "";
document.getElementById("bairro").value = perfil.bairro || "";
document.getElementById("instagram").value = perfil.instagram || "";
document.getElementById("linkedin").value = perfil.linkedin || "";
document.getElementById("descricao").value = perfil.descricao || "";

// show existing photo preview
if (fotoBase64) {
  fotoPreview.src = fotoBase64;
  fotoPreview.style.display = "block";
}

// preview newly selected image
fotoInput.addEventListener("change", () => {
  const file = fotoInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    editarMensagem.textContent = "Escolha um arquivo de imagem válido.";
    editarMensagem.style.color = "#b91c1c";
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

editarForm.addEventListener("submit", (event) => {
  event.preventDefault();

  perfis[perfilIndex] = {
    ...perfis[perfilIndex],
    telefone: document.getElementById("telefone").value.trim(),
    bairro: document.getElementById("bairro").value.trim(),
    instagram: document.getElementById("instagram").value.trim(),
    linkedin: document.getElementById("linkedin").value.trim(),
    foto: fotoBase64,
    descricao: document.getElementById("descricao").value.trim()
  };

  if (!perfis[perfilIndex].foto) {
    const nomeCodificado = encodeURIComponent(perfis[perfilIndex].nome);
    perfis[perfilIndex].foto = `https://ui-avatars.com/api/?name=${nomeCodificado}&background=2563eb&color=fff&size=256`;
  }

  localStorage.setItem("physioProfiles", JSON.stringify(perfis));

  editarMensagem.textContent = "Perfil atualizado com sucesso!";
  editarMensagem.style.color = "#166534";

  setTimeout(() => {
    window.location.href = `profile.html?id=${perfis[perfilIndex].id}`;
  }, 700);
});