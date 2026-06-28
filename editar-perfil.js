const editarForm = document.getElementById('editarPerfilForm');
const editarMensagem = document.getElementById('editarMensagem');
const fotoInput = document.getElementById('foto');
const fotoPreview = document.getElementById('fotoPreview');
const profileClinicLinkRequests = document.getElementById('profileClinicLinkRequests');
const profileLinkedClinics = document.getElementById('profileLinkedClinics');
const profilePhotosEditor = window.PhysioProfilePhotos?.createEditor?.({
  listId: 'profilePhotosList',
  addButtonId: 'addProfilePhotoButton',
  messageId: 'profilePhotosMessage',
  persistPhotos: async (photos) => {
    const updatedProfile = await window.physioApi.updateMyProfile({ photos });
    currentProfileId = updatedProfile?.id || currentProfileId || '';
    return getPersistedProfilePhotos(updatedProfile);
  },
});
const VISIBLE_PROFILE_CLINIC_LINK_STATUSES = new Set(['PENDING', 'ACCEPTED']);

const MAIN_PROFILE_IMAGE_BUCKET = 'profile-images';
let fotoBase64 = '';
let currentProfileId = '';

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

function ensureMainProfileSupabaseClient() {
  if (window.supabaseClient?.storage) return window.supabaseClient;

  if (typeof window.initializePhysioSupabaseClient === 'function') {
    const client = window.initializePhysioSupabaseClient();
    if (client?.storage) return client;
  }

  return null;
}

function normalizeMainProfileImageContentType(fileLike) {
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

function sanitizeMainProfileImageFileName(fileName) {
  return String(fileName || 'foto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '') || 'foto';
}

function dataUrlToBlob(dataUrl) {
  const matches = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Nao foi possivel preparar a foto para envio.');
  }

  const mimeType = matches[1];
  const binary = atob(matches[2]);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function uploadMainProfileImage(source, profileId, imageKind = 'avatar') {
  const normalizedSource = String(source || '').trim();
  if (!normalizedSource) return '';
  if (/^https?:\/\//i.test(normalizedSource)) return normalizedSource;
  if (!/^data:image\//i.test(normalizedSource)) return normalizedSource;

  const supabaseClient = ensureMainProfileSupabaseClient();
  if (!supabaseClient?.storage || !supabaseClient?.auth?.getSession) {
    throw new Error('Nao foi possivel conectar ao armazenamento de imagens agora.');
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) {
    console.error('Main profile image session lookup failed:', sessionError);
    throw new Error('Nao foi possivel validar sua sessao. Faca login novamente.');
  }

  const user = sessionData?.session?.user;
  if (!user?.id) {
    throw new Error('Nao foi possivel enviar a foto agora. Verifique se voce esta logado e tente novamente.');
  }

  const blob = dataUrlToBlob(normalizedSource);
  const contentType = normalizeMainProfileImageContentType({
    name: `${imageKind}.jpg`,
    type: blob.type || 'image/jpeg',
  });

  if (!contentType) {
    throw new Error('Envie uma imagem valida nos formatos JPG, PNG ou WEBP.');
  }

  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${imageKind}.${extension}`;
  const safeFileName = sanitizeMainProfileImageFileName(`${profileId || 'profile'}-${Date.now()}-${fileName}`);
  const filePath = `${user.id}/${safeFileName}`;
  const file = new File([blob], fileName, { type: contentType });

  const { error: uploadError } = await supabaseClient.storage
    .from(MAIN_PROFILE_IMAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    });

  if (uploadError) {
    console.error('Main profile image upload failed:', uploadError);
    throw new Error('Nao foi possivel enviar a foto agora. Verifique se voce esta logado e tente novamente.');
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from(MAIN_PROFILE_IMAGE_BUCKET)
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData?.publicUrl || '';
  if (!publicUrl) {
    throw new Error('Nao foi possivel gerar a URL publica da foto.');
  }

  return publicUrl;
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
  'Fisioterapia OrtopÃ©dica',
  'Fisioterapia Esportiva',
  'Fisioterapia NeurolÃ³gica',
  'Fisioterapia GeriÃ¡trica',
  'Fisioterapia RespiratÃ³ria',
  'Fisioterapia PediÃ¡trica',
  'Fisioterapia do Trabalho',
  'Fisioterapia Ocupacional',
  'Fisioterapia Dermatofuncional',
  'Fisioterapia PÃ©lvica',
  'Fisioterapia Cardiovascular',
  'Fisioterapia AquÃ¡tica',
  'Fisioterapia Home Care',
  'Fisioterapia Domiciliar',
  'Quiropraxia',
  'Pilates',
  'Domiciliar',
  'Ocupacional',
  'Ergonomia',
  'PÃ³s-operatÃ³rio'
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

function getPersistedProfilePhotos(profile) {
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
    currentProfileId = profile.id || currentProfileId || '';
    fotoBase64 = profile.foto || profile.photoUrl || '';

    if (fotoBase64) {
      fotoPreview.src = fotoBase64;
      fotoPreview.style.display = 'block';
    } else if (fotoPreview) {
      fotoPreview.removeAttribute('src');
      fotoPreview.style.display = 'none';
    }

    profilePhotosEditor?.setContext?.({ profileId: profile.id, accountType: 'physio' });
    profilePhotosEditor?.setValue?.(getPersistedProfilePhotos(profile));

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
    });
  });

  document.addEventListener('click', async (event) => {
    const acceptButton = event.target.closest('[data-accept-clinic-link]');
    const rejectButton = event.target.closest('[data-reject-clinic-link]');
    const unlinkButton = event.target.closest('[data-unlink-clinic-link]');
    const button = acceptButton || rejectButton || unlinkButton;
    if (!button) return;

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
    const profilePhotoValidation = profilePhotosEditor?.validate?.();

    if (profilePhotoValidation && !profilePhotoValidation.valid) {
      editarMensagem.textContent = profilePhotoValidation.message;
      editarMensagem.style.color = '#b91c1c';
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    try {
      const photos = profilePhotoValidation?.value || profilePhotosEditor?.getValue?.() || [];
      const persistedPhotoUrl = await uploadMainProfileImage(
        fotoBase64,
        currentProfileId || 'profile',
        'avatar'
      );

      if (persistedPhotoUrl) {
        fotoBase64 = persistedPhotoUrl;
        if (fotoPreview) {
          fotoPreview.src = persistedPhotoUrl;
          fotoPreview.style.display = 'block';
        }
      }

      const payload = {
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
        photoUrl: persistedPhotoUrl || null,
        photos,
        bio: document.getElementById('descricao').value.trim() || null,
      };

      const profile = await window.physioApi.updateMyProfile(payload);
      currentProfileId = profile?.id || currentProfileId || '';
      profilePhotosEditor?.setContext?.({ profileId: currentProfileId, accountType: 'physio' });
      profilePhotosEditor?.setValue?.(getPersistedProfilePhotos(profile));

      editarMensagem.textContent = 'Perfil atualizado com sucesso.';
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



