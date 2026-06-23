const editarForm = document.getElementById('editarPerfilForm');
const editarMensagem = document.getElementById('editarMensagem');
const fotoInput = document.getElementById('foto');
const fotoPreview = document.getElementById('fotoPreview');
const profileClinicLinkRequests = document.getElementById('profileClinicLinkRequests');
const profileLinkedClinics = document.getElementById('profileLinkedClinics');
const ownerReviewsList = document.getElementById('ownerReviewsList');
const VISIBLE_PROFILE_CLINIC_LINK_STATUSES = new Set(['PENDING', 'ACCEPTED']);

let fotoBase64 = '';

function escapeEditarHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


function setSelectValue(selectId, value) {
  setInputValue(selectId, value);
}

function setInputValue(inputId, value) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.value = value || '';
}


const EDITAR_SPECIALTY_OPTIONS_FALLBACK = [
  'Fisioterapia Ortopédica',
  'Fisioterapia Esportiva',
  'Fisioterapia Neurológica',
  'Fisioterapia Geriátrica',
  'Fisioterapia Respiratória',
  'Fisioterapia Pediátrica',
  'Fisioterapia do Trabalho',
  'Fisioterapia Ocupacional',
  'Fisioterapia Dermatofuncional',
  'Fisioterapia Pélvica',
  'Fisioterapia Cardiovascular',
  'Fisioterapia Aquática',
  'Fisioterapia Home Care',
  'Fisioterapia Domiciliar',
  'Quiropraxia',
  'Pilates',
  'Domiciliar',
  'Ocupacional',
  'Ergonomia',
  'Pós-operatório'
];

function getEditarSpecialtyOptions() {
  return window.physioSearchOptions?.getSpecialties?.() ||
    window.PhysioTaxonomy?.profileSpecialtyOptions ||
    EDITAR_SPECIALTY_OPTIONS_FALLBACK;
}

function setupSimpleAutocomplete(inputId, suggestionsId, options) {
  const input = document.getElementById(inputId);
  const suggestions = document.getElementById(suggestionsId);

  if (!input || !suggestions) return;

  function renderSuggestions() {
    const term = input.value.trim().toLowerCase();
    const availableOptions = typeof options === 'function' ? options() : options;

    const filteredOptions = availableOptions.filter((option) =>
      option.toLowerCase().includes(term)
    );

    suggestions.innerHTML = '';

    filteredOptions.forEach((option) => {
      const item = document.createElement('li');
      item.textContent = option;

      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        input.value = option;
        suggestions.innerHTML = '';
      });

      suggestions.appendChild(item);
    });

    suggestions.style.display = filteredOptions.length ? 'block' : 'none';
  }

  input.addEventListener('input', renderSuggestions);
  input.addEventListener('focus', renderSuggestions);

  input.addEventListener('blur', () => {
    setTimeout(() => {
      suggestions.innerHTML = '';
      suggestions.style.display = 'none';
    }, 120);
  });
}

function getProfileField(profile, ...fields) {
  for (const field of fields) {
    if (profile?.[field]) return profile[field];
  }
  return '';
}

async function loadMyProfile() {
  try {
    const profile = await window.physioApi.fetchMyProfile();

    if (!profile) {
      editarMensagem.textContent = 'Nenhum perfil está vinculado à sua conta.';
      editarMensagem.style.color = '#b91c1c';
      return null;
    }

    document.getElementById('telefone').value = profile.telefone || profile.phone || '';

    document.getElementById('nomeCompleto').value =
      profile.nome ||
      profile.name ||
      '';

    const cidadeInput = document.getElementById('editarCidade');
    if (cidadeInput) {
      cidadeInput.value = profile.cidade || profile.city || '';
      cidadeInput.dispatchEvent(new Event('input', { bubbles: true }));
      cidadeInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    document.getElementById('bairro').value = profile.bairro || profile.neighborhood || '';

    setInputValue(
      'especialidade',
      getProfileField(profile, 'especialidade', 'specialty', 'specialization')
    );

    setInputValue(
      'especialidadeSecundaria',
      getProfileField(profile, 'especialidadeSecundaria', 'secondarySpecialty')
    );

    setInputValue(
      'especialidadeTerciaria',
      getProfileField(profile, 'especialidadeTerciaria', 'tertiarySpecialty', 'specialty2', 'extraSpecialty')
    );

    setInputValue(
      'atendimento',
      getProfileField(profile, 'atendimento', 'attendance')
    );

    document.getElementById('instagram').value = profile.instagram || '';
    document.getElementById('linkedin').value = profile.linkedin || '';
    document.getElementById('descricao').value = profile.descricao || profile.bio || '';
    fotoBase64 = profile.foto || profile.photoUrl || '';

    if (fotoBase64) {
      fotoPreview.src = fotoBase64;
      fotoPreview.style.display = 'block';
    }

    return profile;
  } catch (error) {
    editarMensagem.textContent = error.message || 'Sua sessão expirou.';
    editarMensagem.style.color = '#b91c1c';
    return null;
  }
}

function renderClinicLinkCard(link, actions = '') {
  const clinic = link.clinic || {};
  const location = [clinic.city, clinic.neighborhood].filter(Boolean).join(' • ') || 'Localização não informada';

  return `
    <article class="clinic-link-card">
      <strong>${escapeEditarHtml(clinic.clinicName || 'Clínica')}</strong>
      <p class="clinic-link-card__meta">${escapeEditarHtml(location)}</p>
      ${link.message ? `<p class="clinic-link-card__meta">${escapeEditarHtml(link.message)}</p>` : ''}
      ${actions ? `<div class="clinic-link-actions">${actions}</div>` : ''}
    </article>
  `;
}

function getOwnerReviewStatusMeta(status) {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  switch (normalizedStatus) {
    case 'published':
      return { label: 'Publicada', tone: 'published' };
    case 'reported':
      return { label: 'Reportada', tone: 'reported' };
    case 'rejected':
      return { label: 'Removida', tone: 'rejected' };
    default:
      return { label: 'Pendente', tone: 'pending' };
  }
}

function renderOwnerReviewCard(review) {
  const statusMeta = getOwnerReviewStatusMeta(review?.status);
  const canReport = ['published', 'reported'].includes(String(review?.status || '').toLowerCase());

  return `
    <article class="profile-review-card" data-owner-review-id="${escapeEditarHtml(review.id)}">
      <div class="profile-review-card__header">
        <div>
          <strong>${escapeEditarHtml(review.authorName || 'Paciente')}</strong>
          ${review.title ? `<p class="profile-review-card__title">${escapeEditarHtml(review.title)}</p>` : ''}
        </div>
        <span class="review-status-badge review-status-badge--${escapeEditarHtml(statusMeta.tone)}">${escapeEditarHtml(statusMeta.label)}</span>
      </div>
      <p class="profile-review-card__body">${escapeEditarHtml(review.body || '')}</p>
      <div class="profile-review-card__footer">
        <span>${escapeEditarHtml(review.createdAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(review.createdAt)) : 'Agora')}</span>
        ${canReport ? `<button type="button" class="btn btn-outline btn-small" data-owner-report-review="${escapeEditarHtml(review.id)}">${String(review.status || '').toLowerCase() === 'reported' ? 'Atualizar reporte' : 'Reportar review'}</button>` : ''}
      </div>
      ${review.reportReason ? `<p class="profile-review-card__report-reason"><strong>Motivo do reporte:</strong> ${escapeEditarHtml(review.reportReason)}</p>` : ''}
    </article>
  `;
}

async function loadOwnerReviews() {
  if (!ownerReviewsList || !window.physioApi?.fetchMyReviews) return;

  try {
    const response = await window.physioApi.fetchMyReviews();
    const reviews = Array.isArray(response?.reviews) ? response.reviews : [];

    ownerReviewsList.innerHTML = reviews.length
      ? reviews.map(renderOwnerReviewCard).join('')
      : '<p class="form-hint clinic-link-empty-state">Nenhuma avaliação vinculada ao seu perfil no momento.</p>';
  } catch (error) {
    console.error('Owner reviews load failed:', error);
    ownerReviewsList.innerHTML = '<p class="form-hint">Não foi possível carregar suas avaliações agora.</p>';
  }
}

async function loadClinicLinkRequests() {
  if (!profileClinicLinkRequests || !profileLinkedClinics || !window.physioApi?.fetchMyClinicLinkRequests) return;

  try {
    const links = (await window.physioApi.fetchMyClinicLinkRequests())
      .filter((link) => VISIBLE_PROFILE_CLINIC_LINK_STATUSES.has(String(link?.status || '').toUpperCase()));
    const pending = links.filter((link) => link.status === 'PENDING');
    const accepted = links.filter((link) => link.status === 'ACCEPTED');
    const emptyStateHtml = '<p class="form-hint clinic-link-empty-state">Nenhum vínculo ativo ou solicitação pendente no momento.</p>';

    profileClinicLinkRequests.innerHTML = pending.length
      ? pending.map((link) => renderClinicLinkCard(
          link,
          `
            <button type="button" class="btn btn-primary" data-accept-clinic-link="${escapeEditarHtml(link.id)}">Aceitar vínculo</button>
            <button type="button" class="btn btn-outline" data-reject-clinic-link="${escapeEditarHtml(link.id)}">Recusar vínculo</button>
          `
        )).join('')
      : '<p class="form-hint">Nenhuma solicitação pendente.</p>';

    profileLinkedClinics.innerHTML = accepted.length
      ? accepted.map((link) => renderClinicLinkCard(
          link,
          `<button type="button" class="btn btn-outline" data-unlink-clinic-link="${escapeEditarHtml(link.id)}">Desvincular clínica</button>`
        )).join('')
      : '<p class="form-hint">Nenhuma clínica vinculada.</p>';
    if (!pending.length && !accepted.length) {
      profileClinicLinkRequests.innerHTML = emptyStateHtml;
      profileLinkedClinics.innerHTML = emptyStateHtml;
    }
  } catch (error) {
    console.error('Profile clinic links load failed:', error);
    profileClinicLinkRequests.innerHTML = '<p class="form-hint">Não foi possível carregar solicitações agora.</p>';
    profileLinkedClinics.innerHTML = '<p class="form-hint clinic-link-empty-state">Nenhum vínculo ativo ou solicitação pendente no momento.</p>';
  }
}

if (fotoInput) {
  async function openPhotoEditor(source) {
    try {
      const croppedPhoto = typeof window.openImageCropper === 'function'
        ? await window.openImageCropper(source)
        : source;

      if (!croppedPhoto) {
        fotoInput.value = '';
        return;
      }

      fotoBase64 = croppedPhoto;
      fotoPreview.src = fotoBase64;
      fotoPreview.style.display = 'block';
      fotoInput.value = '';
    } catch (error) {
      console.error(error);
      editarMensagem.textContent = 'Não foi possível ajustar essa imagem.';
      editarMensagem.style.color = '#b91c1c';
      fotoInput.value = '';
    }
  }

  fotoInput.addEventListener('change', async () => {
    const file = fotoInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      editarMensagem.textContent = 'Escolha um arquivo de imagem válido.';
      editarMensagem.style.color = '#b91c1c';
      fotoInput.value = '';
      return;
    }

    await openPhotoEditor(file);
  });

  if (fotoPreview) {
    fotoPreview.setAttribute('role', 'button');
    fotoPreview.setAttribute('tabindex', '0');
    fotoPreview.title = 'Clique para ajustar a foto';

    fotoPreview.addEventListener('click', async () => {
      if (fotoBase64) await openPhotoEditor(fotoBase64);
      else fotoInput.click();
    });

    fotoPreview.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (fotoBase64) await openPhotoEditor(fotoBase64);
      else fotoInput.click();
    });
  }
}

if (editarForm) {
  setupSimpleAutocomplete(
    'especialidade',
    'editarEspecialidadeSuggestions',
    getEditarSpecialtyOptions
  );

  setupSimpleAutocomplete(
    'especialidadeSecundaria',
    'editarEspecialidadeSecundariaSuggestions',
    getEditarSpecialtyOptions
  );

  setupSimpleAutocomplete(
    'especialidadeTerciaria',
    'editarEspecialidadeTerciariaSuggestions',
    getEditarSpecialtyOptions
  );

  if (typeof setupCityNeighborhoodAutocomplete === 'function') {
    setupCityNeighborhoodAutocomplete(
      'editarCidade',
      'editarCidadeSuggestions',
      'bairro',
      'editarBairroSuggestions'
    );
  }

  Promise.resolve(window.getLoggedUser ? window.getLoggedUser(true) : null).then((loggedUser) => {
    if (loggedUser?.accountType === 'clinic') {
      window.location.replace('clinic-dashboard.html');
      return;
    }

    loadMyProfile().then(async () => {
      await loadClinicLinkRequests();
      await loadOwnerReviews();
    });
  });

  document.addEventListener('click', async (event) => {
    const acceptButton = event.target.closest('[data-accept-clinic-link]');
    const rejectButton = event.target.closest('[data-reject-clinic-link]');
    const unlinkButton = event.target.closest('[data-unlink-clinic-link]');
    const reportReviewButton = event.target.closest('[data-owner-report-review]');
    const button = acceptButton || rejectButton || unlinkButton || reportReviewButton;
    if (!button) return;

    if (reportReviewButton) {
      const reason = window.prompt('Descreva o motivo do reporte para a equipe de moderação:');
      if (!reason || !reason.trim()) return;

      reportReviewButton.disabled = true;

      try {
        await window.physioApi.reportProfileReview(reportReviewButton.dataset.ownerReportReview, reason.trim());
        editarMensagem.textContent = 'Review reportada para análise administrativa.';
        editarMensagem.style.color = '#166534';
        await loadOwnerReviews();
      } catch (error) {
        console.error('Owner review report failed:', error);
        editarMensagem.textContent = error.message || 'Não foi possível reportar esta review.';
        editarMensagem.style.color = '#b91c1c';
      } finally {
        reportReviewButton.disabled = false;
      }

      return;
    }

    button.disabled = true;

    try {
      if (acceptButton) {
        await window.physioApi.acceptClinicLinkRequest(acceptButton.dataset.acceptClinicLink);
      } else if (rejectButton) {
        await window.physioApi.rejectClinicLinkRequest(rejectButton.dataset.rejectClinicLink);
      } else {
        await window.physioApi.unlinkClinicFromProfile(unlinkButton.dataset.unlinkClinicLink);
      }

      await loadClinicLinkRequests();
    } catch (error) {
      console.error('Clinic link action failed:', error);
      editarMensagem.textContent = error.message || 'Não foi possível atualizar o vínculo.';
      editarMensagem.style.color = '#b91c1c';
    } finally {
      button.disabled = false;
    }
  });

  editarForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const especialidade = document.getElementById('especialidade').value.trim();
    const especialidadeSecundaria = document.getElementById('especialidadeSecundaria').value.trim();

    if (especialidade && especialidadeSecundaria && especialidade === especialidadeSecundaria) {
      editarMensagem.textContent = 'Escolha uma especialização adicional diferente da principal.';
      editarMensagem.style.color = '#b91c1c';
      return;
    }

    const submitBtn = editarForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    const especialidadeTerciaria = document.getElementById('especialidadeTerciaria').value.trim();

    try {
      const profile = await window.physioApi.updateMyProfile({
        name: document.getElementById('nomeCompleto').value.trim() || null,
        phone: document.getElementById('telefone').value.trim() || null,
        city: document.getElementById('editarCidade')?.value.trim() || null,
        neighborhood: document.getElementById('bairro').value.trim() || null,
        specialty: especialidade || null,
        secondarySpecialty: especialidadeSecundaria || null,
        tertiarySpecialty: especialidadeTerciaria || null,
        attendance: document.getElementById('atendimento').value.trim() || null,
        instagram: document.getElementById('instagram').value.trim() || null,
        linkedin: document.getElementById('linkedin').value.trim() || null,
        photoUrl: fotoBase64 || null,
        bio: document.getElementById('descricao').value.trim() || null,
      });

      editarMensagem.textContent = 'Perfil atualizado com sucesso!';
      editarMensagem.style.color = '#166534';

      setTimeout(() => {
        window.location.href = `profile.html?id=${encodeURIComponent(profile.id)}`;
      }, 700);
    } catch (error) {
      editarMensagem.textContent = error.message || 'Não foi possível atualizar o perfil.';
      editarMensagem.style.color = '#b91c1c';
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
