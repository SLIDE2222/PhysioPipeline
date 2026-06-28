const clinicDashboardForm = document.getElementById('clinicDashboardForm');
const clinicDashboardMessage = document.getElementById('clinicDashboardMessage');
const clinicLogoInput = document.getElementById('clinicLogo');
const clinicLogoPreview = document.getElementById('clinicLogoPreview');
const clinicPhysioSearchButton = document.getElementById('clinicPhysioSearchButton');
const clinicPhysioSearchResults = document.getElementById('clinicPhysioSearchResults');
const clinicPhysioLinksList = document.getElementById('clinicPhysioLinksList');
const clinicPhysioLinkMessage = document.getElementById('clinicPhysioLinkMessage');
const clinicPhotosEditor = window.PhysioProfilePhotos?.createEditor?.({
  listId: 'clinicProfilePhotosList',
  addButtonId: 'addClinicProfilePhotoButton',
  messageId: 'clinicProfilePhotosMessage',
  persistPhotos: async (photos) => {
    const updatedClinicProfile = await window.physioApi.updateMyClinicProfile({ photos });
    currentClinicProfileId = updatedClinicProfile?.id || currentClinicProfileId || '';
    return getPersistedClinicPhotos(updatedClinicProfile);
  },
});
const clinicEditor = window.PhysioClinicForm?.createClinicEditor?.({
  serviceInputId: 'clinicServiceInput',
  serviceListId: 'clinicServicesTags',
  hiddenServicesInputId: 'clinicServices',
  addServiceButtonId: 'addClinicService',
  serviceLimitMessageId: 'clinicServiceLimitMessage',
  teamRowsId: 'clinicTeamRows',
  addTeamButtonId: 'addClinicTeamRow',
});

const MAIN_CLINIC_IMAGE_BUCKET = 'profile-images';
let clinicLogoBase64 = '';
let currentClinicProfileId = '';

const CLINIC_LINK_STATUS_LABELS = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceito',
  REJECTED: 'Recusado',
  UNLINKED: 'Desvinculado',
};
const VISIBLE_CLINIC_LINK_STATUSES = new Set(['PENDING', 'ACCEPTED']);

function escapeClinicDashboardHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureClinicMainImageSupabaseClient() {
  if (window.supabaseClient?.storage) return window.supabaseClient;

  if (typeof window.initializePhysioSupabaseClient === 'function') {
    const client = window.initializePhysioSupabaseClient();
    if (client?.storage) return client;
  }

  return null;
}

function normalizeClinicMainImageContentType(fileLike) {
  const name = String(fileLike?.name || '').toLowerCase();
  const type = String(fileLike?.type || '').toLowerCase();

  if (type === 'image/jpg' || type === 'image/jpeg') return 'image/jpeg';
  if (type === 'image/png') return 'image/png';
  if (type === 'image/webp') return 'image/webp';

  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';

  return '';
}

function sanitizeClinicMainImageFileName(fileName) {
  return String(fileName || 'logo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '') || 'logo';
}

function clinicDataUrlToBlob(dataUrl) {
  const matches = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Nao foi possivel preparar a imagem para envio.');
  }

  const mimeType = matches[1];
  const binary = atob(matches[2]);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function uploadClinicMainImage(source, profileId, imageKind = 'logo') {
  const normalizedSource = String(source || '').trim();
  if (!normalizedSource) return '';
  if (/^https?:\/\//i.test(normalizedSource)) return normalizedSource;
  if (!/^data:image\//i.test(normalizedSource)) return normalizedSource;

  const supabaseClient = ensureClinicMainImageSupabaseClient();
  if (!supabaseClient?.storage || !supabaseClient?.auth?.getSession) {
    throw new Error('Nao foi possivel conectar ao armazenamento de imagens agora.');
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) {
    console.error('Clinic logo session lookup failed:', sessionError);
    throw new Error('Nao foi possivel validar sua sessao. Faca login novamente.');
  }

  const user = sessionData?.session?.user;
  if (!user?.id) {
    throw new Error('Nao foi possivel enviar a foto agora. Verifique se voce esta logado e tente novamente.');
  }

  const blob = clinicDataUrlToBlob(normalizedSource);
  const contentType = normalizeClinicMainImageContentType({
    name: `${imageKind}.jpg`,
    type: blob.type || 'image/jpeg',
  });

  if (!contentType) {
    throw new Error('Envie uma imagem valida nos formatos JPG, PNG ou WEBP.');
  }

  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${imageKind}.${extension}`;
  const safeFileName = sanitizeClinicMainImageFileName(`${profileId || 'clinic'}-${Date.now()}-${fileName}`);
  const filePath = `${user.id}/${safeFileName}`;
  const file = new File([blob], fileName, { type: contentType });

  const { error: uploadError } = await supabaseClient.storage
    .from(MAIN_CLINIC_IMAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    });

  if (uploadError) {
    console.error('Clinic main image upload failed:', uploadError);
    throw new Error('Nao foi possivel enviar a foto agora. Verifique se voce esta logado e tente novamente.');
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from(MAIN_CLINIC_IMAGE_BUCKET)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData?.publicUrl || '';
  if (!publicUrl) {
    throw new Error('Nao foi possivel gerar a URL publica da foto.');
  }

  return publicUrl;
}

function setClinicMessage(text, color) {
  if (!clinicDashboardMessage) return;
  clinicDashboardMessage.textContent = text;
  clinicDashboardMessage.style.color = color;
}

function getPersistedClinicPhotos(profile) {
  const source = profile?.photosList ?? profile?.photos ?? profile?.fotos ?? [];

  if (Array.isArray(source)) {
    return source.filter(Boolean).slice(0, 5);
  }

  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source);
      return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 5) : [];
    } catch (_) {
      return source ? [source] : [];
    }
  }

  return [];
}

function getClinicPublicProfileHref(profile) {
  const clinicId =
    profile?.id ||
    profile?.clinicProfile?.id ||
    window.physioApi?.getStoredAuth?.()?.user?.clinicProfile?.id ||
    null;

  return clinicId
    ? `profile.html?type=clinic&id=${encodeURIComponent(clinicId)}`
    : 'profile.html?type=clinic';
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

  currentClinicProfileId = profile?.id || currentClinicProfileId || '';
  clinicLogoBase64 = profile?.logo || profile?.logoUrl || '';
  if (clinicLogoBase64 && clinicLogoPreview) {
    clinicLogoPreview.src = clinicLogoBase64;
    clinicLogoPreview.style.display = 'block';
  } else if (clinicLogoPreview) {
    clinicLogoPreview.removeAttribute('src');
    clinicLogoPreview.style.display = 'none';
  }

  clinicPhotosEditor?.setContext?.({ profileId: profile?.id, accountType: 'clinic' });
  clinicPhotosEditor?.setValue?.(getPersistedClinicPhotos(profile));
}

function setClinicLinkMessage(text, color = '#475569') {
  if (!clinicPhysioLinkMessage) return;
  clinicPhysioLinkMessage.textContent = text;
  clinicPhysioLinkMessage.style.color = color;
}

function showClinicDashboardToast(message, tone = 'success') {
  const toast = document.createElement('div');
  toast.className = `profile-inline-toast profile-inline-toast--${tone}`;
  toast.innerHTML = `
    <span class="profile-inline-toast__icon" aria-hidden="true">${tone === 'success' ? 'âœ“' : tone === 'info' ? 'i' : '!'}</span>
    <span class="profile-inline-toast__text">${escapeClinicDashboardHtml(message)}</span>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 260);
  }, 4000);
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
    const links = (await window.physioApi.fetchMyClinicPhysioLinks())
      .filter((link) => VISIBLE_CLINIC_LINK_STATUSES.has(String(link?.status || '').toUpperCase()));

    if (!links.length) {
      clinicPhysioLinksList.innerHTML = '<p class="form-hint clinic-link-empty-state">Nenhum vínculo ativo ou solicitação pendente no momento.</p>';
      return;
    }

    clinicPhysioLinksList.innerHTML = links.map((link) => {
      const profile = link.profile || {};
      const status = CLINIC_LINK_STATUS_LABELS[link.status] || link.status || 'Pendente';
      const canUnlink = link.status === 'PENDING' || link.status === 'ACCEPTED';
      const actionLabel = link.status === 'PENDING' ? 'Cancelar solicitação' : 'Desvincular';
      const statusClass = link.status === 'ACCEPTED'
        ? 'clinic-link-status--active'
        : 'clinic-link-status--pending';

      return `
        <article class="clinic-link-card">
          <strong>${escapeClinicDashboardHtml(profile.name || 'Fisioterapeuta')}</strong>
          <p class="clinic-link-card__meta">${escapeClinicDashboardHtml(getPhysioSpecialtyText(profile))}</p>
          <span class="profile-badge clinic-link-status ${statusClass}">${escapeClinicDashboardHtml(status)}</span>
          ${canUnlink ? `
            <div class="clinic-link-actions">
              <button type="button" class="btn btn-outline" data-unlink-clinic-physio="${escapeClinicDashboardHtml(link.id)}">${actionLabel}</button>
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
      setClinicLinkMessage('');
      showClinicDashboardToast('Solicitação enviada ao fisioterapeuta.');
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
      setClinicLinkMessage('');
      showClinicDashboardToast('Vínculo atualizado com sucesso.');
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
      setClinicMessage('Escolha um arquivo de imagem válido.', '#b91c1c');
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

    const photoValidation = clinicPhotosEditor?.validate?.();
    if (photoValidation && !photoValidation.valid) {
      setClinicMessage(photoValidation.message, '#b91c1c');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    try {
      const clinicEditorValue = clinicEditor?.getValue?.() || { services: [], team: [] };

      const persistedLogoUrl = await uploadClinicMainImage(
        clinicLogoBase64,
        currentClinicProfileId || 'clinic',
        'logo'
      );

      if (persistedLogoUrl) {
        clinicLogoBase64 = persistedLogoUrl;
        if (clinicLogoPreview) {
          clinicLogoPreview.src = persistedLogoUrl;
          clinicLogoPreview.style.display = 'block';
        }
      }

      const updatedClinicProfile = await window.physioApi.updateMyClinicProfile({
        clinicName: document.getElementById('clinicName').value.trim() || null,
        responsibleName: document.getElementById('clinicResponsible').value.trim() || null,
        address: document.getElementById('clinicAddress').value.trim() || null,
        city: document.getElementById('clinicCity').value.trim() || null,
        neighborhood: document.getElementById('clinicNeighborhood').value.trim() || null,
        phone: document.getElementById('clinicPhone').value.trim() || null,
        whatsapp: document.getElementById('clinicWhatsapp').value.trim() || null,
        services: clinicEditorValue.services,
        physioTeam: clinicEditorValue.team,
        logoUrl: persistedLogoUrl || null,
        photos: photoValidation?.value || clinicPhotosEditor?.getValue?.() || [],
        description: document.getElementById('clinicDescription').value.trim() || null,
      });

      currentClinicProfileId = updatedClinicProfile?.id || currentClinicProfileId || '';
      clinicPhotosEditor?.setContext?.({ profileId: currentClinicProfileId, accountType: 'clinic' });
      clinicPhotosEditor?.setValue?.(getPersistedClinicPhotos(updatedClinicProfile));

      setClinicMessage('Perfil atualizado com sucesso. Redirecionando...', '#166534');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      setTimeout(async () => {
        let redirectTarget = getClinicPublicProfileHref(updatedClinicProfile);

        if (!updatedClinicProfile?.id && window.physioApi?.fetchMyClinicProfile) {
          try {
            const freshClinicProfile = await window.physioApi.fetchMyClinicProfile();
            redirectTarget = getClinicPublicProfileHref(freshClinicProfile);
          } catch (error) {
            console.warn('Could not refresh clinic profile before redirect:', error);
          }
        }

        window.location.href = redirectTarget;
      }, 1000);
    } catch (error) {
      setClinicMessage(error.message || 'Não foi possível salvar os dados da clínica.', '#b91c1c');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  clinicEditor?.setValue({ services: [], team: [] });
  loadClinicDashboard();
}



