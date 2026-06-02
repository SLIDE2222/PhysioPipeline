const clinicClaimForm = document.getElementById('clinicClaimForm');
const clinicClaimMessage = document.getElementById('clinicClaimMessage');
const clinicClaimProfilePreview = document.getElementById('clinicClaimProfilePreview');
const clinicClaimIntro = document.getElementById('clinicClaimIntro');

const clinicClaimParams = new URLSearchParams(window.location.search);
const clinicProfileId = clinicClaimParams.get('id');

function setClinicClaimMessage(message, color = '#b91c1c') {
  if (!clinicClaimMessage) return;
  clinicClaimMessage.textContent = message;
  clinicClaimMessage.style.color = color;
}

function renderClinicClaimPreview(clinic) {
  if (!clinicClaimProfilePreview || !clinic) return;

  const services = Array.isArray(clinic.servicesList)
    ? clinic.servicesList
    : Array.isArray(clinic.servicosLista)
      ? clinic.servicosLista
      : [];

  const locationText = [clinic.cidade, clinic.bairro].filter(Boolean).join(' - ') || '-';

  clinicClaimProfilePreview.innerHTML = [
    '<div class="result-card">',
    `  <h3>${escapeHtml(clinic.nomeClinica || clinic.nome || 'Clinica')}</h3>`,
    `  <p><strong>Badge:</strong> ${escapeHtml(getAccountBadge('clinic'))}</p>`,
    `  <p><strong>Local:</strong> ${escapeHtml(locationText)}</p>`,
    `  <p><strong>Endereco:</strong> ${escapeHtml(clinic.endereco || '-')}</p>`,
    `  <p><strong>Especialidades:</strong> ${escapeHtml(services.join(' | ') || '-')}</p>`,
    `  <p><strong>Status:</strong> ${clinic.isClaimable ? 'Perfil disponivel para reivindicacao' : 'Perfil ja vinculado a uma conta'}</p>`,
    '</div>',
  ].join('');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };

    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo enviado.'));
    reader.readAsDataURL(file);
  });
}

async function loadClinicClaimPage() {
  if (!clinicProfileId) {
    if (clinicClaimIntro) clinicClaimIntro.textContent = 'Nenhum perfil de clinica foi informado para reivindicacao.';
    if (clinicClaimForm) clinicClaimForm.style.display = 'none';
    return;
  }

  try {
    const clinic = await window.physioApi.fetchClinic(clinicProfileId);
    renderClinicClaimPreview(clinic);

    if (clinic?.nomeClinica) {
      const clinicNameField = document.getElementById('clinicClaimName');
      if (clinicNameField) clinicNameField.value = clinic.nomeClinica;
    }

    if (!clinic?.isClaimable) {
      if (clinicClaimIntro) clinicClaimIntro.textContent = 'Essa clinica ja esta vinculada a uma conta.';
      if (clinicClaimForm) clinicClaimForm.style.display = 'none';
    }
  } catch (error) {
    console.error('Erro ao carregar clinica para reivindicacao:', error);
    if (clinicClaimIntro) clinicClaimIntro.textContent = error.message || 'Nao conseguimos carregar esse perfil de clinica.';
    if (clinicClaimForm) clinicClaimForm.style.display = 'none';
  }
}

async function submitClinicClaim(event) {
  event.preventDefault();

  if (!clinicClaimForm) return;

  const submitButton = clinicClaimForm.querySelector('button[type="submit"]');
  const clinicName = String(document.getElementById('clinicClaimName')?.value || '').trim();
  const cnpj = String(document.getElementById('clinicClaimCnpj')?.value || '').trim();
  const responsibleName = String(document.getElementById('clinicClaimResponsibleName')?.value || '').trim();
  const responsibleEmail = String(document.getElementById('clinicClaimResponsibleEmail')?.value || '').trim().toLowerCase();
  const whatsapp = String(document.getElementById('clinicClaimWhatsapp')?.value || '').trim();
  const roleOrRelation = String(document.getElementById('clinicClaimRole')?.value || '').trim();
  const authorizationConfirmed = Boolean(document.getElementById('clinicClaimAuthorization')?.checked);
  const website = String(document.getElementById('clinicClaimWebsite')?.value || '').trim();
  const proofFile = document.getElementById('clinicClaimProofFile')?.files?.[0] || null;

  setClinicClaimMessage('');

  if (website) return setClinicClaimMessage('Pedido bloqueado por validacao anti-spam.');
  if (!clinicProfileId) return setClinicClaimMessage('Perfil de clinica invalido para reivindicacao.');
  if (!clinicName) return setClinicClaimMessage('Informe o nome da clinica.');
  if (!cnpj) return setClinicClaimMessage('Informe o CNPJ.');
  if (!responsibleName) return setClinicClaimMessage('Informe o nome do responsavel.');
  if (!responsibleEmail) return setClinicClaimMessage('Informe o e-mail do responsavel.');
  if (!whatsapp) return setClinicClaimMessage('Informe o WhatsApp.');
  if (!roleOrRelation) return setClinicClaimMessage('Informe seu cargo ou vinculo com a clinica.');
  if (!proofFile) return setClinicClaimMessage('Envie um comprovante do CNPJ ou do vinculo com a clinica.');
  if (!authorizationConfirmed) return setClinicClaimMessage('Confirme que voce tem autorizacao para solicitar acesso a este perfil.');

  try {
    if (submitButton) submitButton.disabled = true;

    setClinicClaimMessage('Enviando solicitacao...', '#2563eb');

    const fileContentBase64 = await fileToBase64(proofFile);
    const response = await window.physioApi.request('/claims/clinic-request', {
      method: 'POST',
      body: {
        clinicProfileId: String(clinicProfileId),
        clinicName,
        cnpj,
        responsibleName,
        responsibleEmail,
        whatsapp,
        roleOrRelation,
        authorizationConfirmed: true,
        fileName: proofFile.name,
        fileMime: proofFile.type || 'application/pdf',
        fileContentBase64,
        website,
      },
      timeoutMs: 30000,
    });

    setClinicClaimMessage(response.message || 'Solicitacao enviada com sucesso.', '#166534');
    clinicClaimForm.reset();
  } catch (error) {
    console.error('Erro ao enviar reivindicacao de clinica:', error);
    setClinicClaimMessage(error.message || 'Nao foi possivel enviar a reivindicacao da clinica.');
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

if (clinicClaimForm) {
  loadClinicClaimPage();
  clinicClaimForm.addEventListener('submit', submitClinicClaim);
}
