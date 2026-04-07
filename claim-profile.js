const claimForm = document.getElementById("claimForm");
const claimMensagem = document.getElementById("claimMensagem");
const claimProfilePreview = document.getElementById("claimProfilePreview");
const claimIntro = document.getElementById("claimIntro");
const CLAIM_API_URL = "http://localhost:3000/claims/request";

const params = new URLSearchParams(window.location.search);
const profileId = params.get("id");

function setClaimMessage(message, color = "#b91c1c") {
  if (!claimMensagem) return;
  claimMensagem.textContent = message;
  claimMensagem.style.color = color;
}

function renderClaimPreview(profile) {
  if (!claimProfilePreview || !profile) return;

  claimProfilePreview.innerHTML = `
    <div class="result-card">
      <h3>${escapeHtml(profile.nome)}</h3>
      <p><strong>Especialidade:</strong> ${escapeHtml(profile.especialidade || "-")}</p>
      <p><strong>Local:</strong> ${escapeHtml(getNeighborhoodBadge(profile))}</p>
      <p><strong>Status:</strong> ${
        profile.isClaimed
          ? "Perfil já reivindicado"
          : "Perfil público disponível para claim"
      }</p>
    </div>
  `;
}

async function loadClaimPage() {
  if (!profileId) {
    if (claimIntro) claimIntro.textContent = "Nenhum perfil foi informado para reivindicação.";
    if (claimForm) claimForm.style.display = "none";
    return;
  }

  try {
    const profile = await window.physioApi.fetchProfile(profileId);
    renderClaimPreview(profile);

    if (profile.isClaimed) {
      if (claimIntro) claimIntro.textContent = "Esse perfil já foi reivindicado.";
      if (claimForm) claimForm.style.display = "none";
    }
  } catch (error) {
    if (claimIntro) claimIntro.textContent = error.message || "Não conseguimos carregar esse perfil.";
    if (claimForm) claimForm.style.display = "none";
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };

    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo enviado."));

    reader.readAsDataURL(file);
  });
}

async function submitClaim(event) {
  event.preventDefault();

  if (!claimForm) return;

  const emailInput = document.getElementById("claimEmail");
  const degreeInput = document.getElementById("claimDegreeFile");
  const consentInput = document.getElementById("claimConsentContact");
  const submitBtn = claimForm.querySelector('button[type="submit"]');

  const email = String(emailInput?.value || "").trim().toLowerCase();
  const degreeFile = degreeInput?.files?.[0] || null;
  const consentChecked = Boolean(consentInput?.checked);

  setClaimMessage("");

  if (!profileId) return setClaimMessage("Perfil inválido para claim.");
  if (!email) return setClaimMessage("Informe seu e-mail.");
  if (!degreeFile) return setClaimMessage("Adicione seu diploma para continuar.");

  const isPdf = degreeFile.type === "application/pdf" || degreeFile.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return setClaimMessage("O diploma precisa estar em PDF.");
  if (!consentChecked) return setClaimMessage("Você precisa autorizar o contato por e-mail.");

  try {
    if (submitBtn) submitBtn.disabled = true;

    setClaimMessage("Enviando claim...", "#2563eb");

    const fileContentBase64 = await fileToBase64(degreeFile);

    const response = await fetch(CLAIM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        profileId: String(profileId),
        email,
        consentContact: true,
        fileName: degreeFile.name,
        fileMime: degreeFile.type || "application/pdf",
        fileContentBase64
      })
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : {};

    if (!response.ok) {
      throw new Error(data.error || data.message || "Não foi possível enviar a reivindicação.");
    }

    setClaimMessage(data.message || "Pedido enviado com sucesso.", "#166534");
    claimForm.reset();
  } catch (error) {
    console.error("Claim request failed:", error);
    setClaimMessage(error.message || "Não foi possível enviar a reivindicação.");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

if (claimForm) {
  loadClaimPage();
  claimForm.addEventListener("submit", submitClaim);
}
