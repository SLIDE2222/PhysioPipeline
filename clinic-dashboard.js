const clinicDashboardForm = document.getElementById('clinicDashboardForm');
const clinicDashboardMessage = document.getElementById('clinicDashboardMessage');
const clinicLogoInput = document.getElementById('clinicLogo');
const clinicLogoPreview = document.getElementById('clinicLogoPreview');
const clinicPhysioSearchButton = document.getElementById('clinicPhysioSearchButton');
const clinicPhysioSearchResults = document.getElementById('clinicPhysioSearchResults');
const clinicPhysioLinksList = document.getElementById('clinicPhysioLinksList');
const clinicPhysioLinkMessage = document.getElementById('clinicPhysioLinkMessage');
const clinicEditor = window.PhysioClinicForm?.createClinicEditor?.({
  serviceInputId: 'clinicServiceInput',
  serviceListId: 'clinicServicesTags',
  hiddenServicesInputId: 'clinicServices',
  addServiceButtonId: 'addClinicService',
  serviceLimitMessageId: 'clinicServiceLimitMessage',
  teamRowsId: 'clinicTeamRows',
  addTeamButtonId: 'addClinicTeamRow',
});

let clinicLogoBase64 = '';

const CLINIC_LINK_STATUS_LABELS = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceito',
  REJECTED: 'Recusado',
  UNLINKED: 'Desvinculado',
};

function escapeClinicDashboardHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setClinicMessage(text, color) {
  if (!clinicDashboardMessage) return;
  clinicDashboardMessage.textContent = text;
  clinicDashboardMessage.style.color = color;
}

function fillClinicForm(profile) {
  document.getElementById('clinicName').value = profile?.nomeClinica || profile?.clinicName || '';
  document.getElementById('clinicResponsible').value = profile?.responsavel || profile?.responsibleName || '';
  document.getElementById('clinicAddress').value = profile?.endereco || profile?.address || '';
  document.getElementById('clinicCity').value = profile?.cidade || profile?.city || '';
  document.getElementById('clinicNeighborhood').value = profile?.bairro || profile?.neighborhood || '';
  document.getElementById('clinicPhone').value = profile?.telefone || profile?.phone || '';
  document.getElementById('clinicWhatsapp').value = profile?.whatsapp || '';
  document.getElementById('clinicDescription').value = profile?.descricao || profile?.description || '';

  clinicEditor?.setValue({
    services: profile?.servicesList || profile?.servicosLista || profile?.servicos || profile?.services || [],
    team: profile?.physioTeamList || profile?.fisioterapeutas || profile?.physioTeam || [],
  });

  clinicLogoBase64 = profile?.logo || profile?.logoUrl || '';
  if (clinicLogoBase64 && clinicLogoPreview) {
    clinicLogoPreview.src = clinicLogoBase64;
    clinicLogoPreview.style.display = 'block';
  }
}

function setClinicLinkMessage(text, color = '#475569') {
  if (!clinicPhysioLinkMessage) return;
  clinicPhysioLinkMessage.textContent = text;
  clinicPhysioLinkMessage.style.color = color;
}

function getPhysioSpecialtyText(profile) {
  const specialties = Array.isArray(profile?.specialties)
    ? profile.specialties
    : [profile?.specialty, profile?.secondarySpecialty, profile?.tertiarySpecialty].filter(Boolean);

  return specialties.filter(Boolean).join(' • ') || 'Especialidade não informada';
}

async function loadClinicPhysioLinks() {
  if (!clinicPhysioLinksList || !window.physioApi?.fetchMyClinicPhysioLinks) return;

  try {
    const links = await window.physioApi.fetchMyClinicPhysioLinks();

    if (!links.length) {
      clinicPhysioLinksList.innerHTML = '<p class="form-hint">Nenhuma solicitação enviada ainda.</p>';
      return;
    }

    clinicPhysioLinksList.innerHTML = links.map((link) => {
      const profile = link.profile || {};
      const status = CLINIC_LINK_STATUS_LABELS[link.status] || link.status || 'Pendente';
      const canUnlink = link.status === 'ACCEPTED' || link.status === 'PENDING';

      return `
        <article class="clinic-link-card">
          <strong>${escapeClinicDashboardHtml(profile.name || 'Fisioterapeuta')}</strong>
          <p class="clinic-link-card__meta">${escapeClinicDashboardHtml(getPhysioSpecialtyText(profile))}</p>
          <span class="profile-badge clinic-link-status">${escapeClinicDashboardHtml(status)}</span>
          ${canUnlink ? `
            <div class="clinic-link-actions">
              <button type="button" class="btn btn-outline" data-unlink-clinic-physio="${escapeClinicDashboardHtml(link.id)}">Desvincular</button>
            </div>
          ` : ''}
        </article>
      `;
    }).join('');
  } catch (error) {
    clinicPhysioLinksList.innerHTML = '<p class="form-hint">Não foi possível carregar os vínculos agora.</p>';
    console.error('Clinic physio links load failed:', error);
  }
}

async function searchClinicPhysios() {
  if (!clinicPhysioSearchResults || !window.physioApi?.searchPhysiotherapistsForClinic) return;

  setClinicLinkMessage('');
  clinicPhysioSearchResults.innerHTML = '<p class="form-hint">Buscando fisioterapeutas...</p>';

  try {
    const profiles = await window.physioApi.searchPhysiotherapistsForClinic({
      name: document.getElementById('clinicPhysioSearchName')?.value.trim(),
      city: document.getElementById('clinicPhysioSearchCity')?.value.trim(),
      specialty: document.getElementById('clinicPhysioSearchSpecialty')?.value.trim(),
    });

    if (!profiles.length) {
      clinicPhysioSearchResults.innerHTML = '<p class="form-hint">Nenhum fisioterapeuta encontrado.</p>';
      return;
    }

    clinicPhysioSearchResults.innerHTML = profiles.map((profile) => `
      <article class="clinic-link-card">
        <strong>${escapeClinicDashboardHtml(profile.nome || profile.name || 'Fisioterapeuta')}</strong>
        <p class="clinic-link-card__meta">${escapeClinicDashboardHtml(getPhysioSpecialtyText(profile))}</p>
        <p class="clinic-link-card__meta">${escapeClinicDashboardHtml([profile.cidade || profile.city, profile.bairro || profile.neighborhood].filter(Boolean).join(' • ') || 'Localização não informada')}</p>
        <div class="clinic-link-actions">
          <button type="button" class="btn btn-primary" data-request-clinic-physio="${escapeClinicDashboardHtml(profile.id)}">
            Enviar solicitação de vínculo
          </button>
        </div>
      </article>
    `).join('');
  } catch (error) {
    clinicPhysioSearchResults.innerHTML = '<p class="form-hint">Não foi possível buscar fisioterapeutas agora.</p>';
    console.error('Clinic physio search failed:', error);
  }
}

async function loadClinicDashboard() {
  const loggedUser = await (window.getLoggedUser ? window.getLoggedUser(true) : Promise.resolve(null));

  if (!loggedUser) {
    window.location.replace('login.html');
    return;
  }

  if (loggedUser.accountType !== 'clinic') {
    window.location.replace(window.physioApi.resolveUserHomePath(loggedUser));
    return;
  }

  try {
    const clinicProfile = await window.physioApi.fetchMyClinicProfile();
    fillClinicForm(clinicProfile);
    await loadClinicPhysioLinks();
  } catch (error) {
    setClinicMessage(error.message || 'Não foi possível carregar os dados da clínica.', '#b91c1c');
  }
}

if (clinicPhysioSearchButton) {
  clinicPhysioSearchButton.addEventListener('click', searchClinicPhysios);
}

if (clinicPhysioSearchResults) {
  clinicPhysioSearchResults.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-request-clinic-physio]');
    if (!button) return;

    button.disabled = true;
    setClinicLinkMessage('');

    try {
      await window.physioApi.requestClinicPhysioLink({
        profileId: button.dataset.requestClinicPhysio,
      });
      setClinicLinkMessage('Solicitação enviada', '#166534');
      await loadClinicPhysioLinks();
    } catch (error) {
      console.error('Clinic physio request failed:', error);
      setClinicLinkMessage(error.message || 'Não foi possível enviar a solicitação.', '#b91c1c');
    } finally {
      button.disabled = false;
    }
  });
}

if (clinicPhysioLinksList) {
  clinicPhysioLinksList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-unlink-clinic-physio]');
    if (!button) return;

    button.disabled = true;
    setClinicLinkMessage('');

    try {
      await window.physioApi.unlinkClinicPhysioLink(button.dataset.unlinkClinicPhysio);
      setClinicLinkMessage('Vínculo atualizado.', '#166534');
      await loadClinicPhysioLinks();
    } catch (error) {
      console.error('Clinic physio unlink failed:', error);
      setClinicLinkMessage(error.message || 'Não foi possível desvincular.', '#b91c1c');
    } finally {
      button.disabled = false;
    }
  });
}

if (clinicLogoInput) {
  async function openClinicLogoEditor(source) {
    try {
      const croppedLogo = typeof window.openImageCropper === 'function'
        ? await window.openImageCropper(source)
        : '';

      if (!croppedLogo) {
        clinicLogoInput.value = '';
        return;
      }

      clinicLogoBase64 = croppedLogo;
      clinicLogoPreview.src = clinicLogoBase64;
      clinicLogoPreview.style.display = 'block';
      clinicLogoInput.value = '';
    } catch (error) {
      console.error(error);
      setClinicMessage('Não foi possível ajustar essa imagem.', '#b91c1c');
      clinicLogoInput.value = '';
    }
  }

  clinicLogoInput.addEventListener('change', async () => {
    const file = clinicLogoInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setClinicMessage('Escolha um arquivo de imagem valido.', '#b91c1c');
      clinicLogoInput.value = '';
      return;
    }

    await openClinicLogoEditor(file);
  });

  if (clinicLogoPreview) {
    clinicLogoPreview.setAttribute('role', 'button');
    clinicLogoPreview.setAttribute('tabindex', '0');
    clinicLogoPreview.title = 'Clique para ajustar a logo';

    clinicLogoPreview.addEventListener('click', async () => {
      if (clinicLogoBase64) await openClinicLogoEditor(clinicLogoBase64);
      else clinicLogoInput.click();
    });

    clinicLogoPreview.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (clinicLogoBase64) await openClinicLogoEditor(clinicLogoBase64);
      else clinicLogoInput.click();
    });
  }
}

if (clinicDashboardForm) {
  clinicDashboardForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitBtn = clinicDashboardForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setClinicMessage('', '#166534');

    try {
      const clinicEditorValue = clinicEditor?.getValue?.() || { services: [], team: [] };

      await window.physioApi.updateMyClinicProfile({
        clinicName: document.getElementById('clinicName').value.trim() || null,
        responsibleName: document.getElementById('clinicResponsible').value.trim() || null,
        address: document.getElementById('clinicAddress').value.trim() || null,
        city: document.getElementById('clinicCity').value.trim() || null,
        neighborhood: document.getElementById('clinicNeighborhood').value.trim() || null,
        phone: document.getElementById('clinicPhone').value.trim() || null,
        whatsapp: document.getElementById('clinicWhatsapp').value.trim() || null,
        services: clinicEditorValue.services,
        physioTeam: clinicEditorValue.team,
        logoUrl: clinicLogoBase64 || null,
        description: document.getElementById('clinicDescription').value.trim() || null,
      });

      setClinicMessage('Dados da clínica salvos com sucesso!', '#166534');
    } catch (error) {
      setClinicMessage(error.message || 'Não foi possível salvar os dados da clínica.', '#b91c1c');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  clinicEditor?.setValue({ services: [], team: [] });
  loadClinicDashboard();
}


