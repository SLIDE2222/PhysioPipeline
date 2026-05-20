const editarForm = document.getElementById('editarPerfilForm');
const editarMensagem = document.getElementById('editarMensagem');
const fotoInput = document.getElementById('foto');
const fotoPreview = document.getElementById('fotoPreview');

let fotoBase64 = '';

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


const EDITAR_SPECIALTY_OPTIONS = [
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

function setupSimpleAutocomplete(inputId, suggestionsId, options) {
  const input = document.getElementById(inputId);
  const suggestions = document.getElementById(suggestionsId);

  if (!input || !suggestions) return;

  function renderSuggestions() {
    const term = input.value.trim().toLowerCase();

    const filteredOptions = options.filter((option) =>
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
      getProfileField(profile, 'especialidadeSecundaria', 'secondarySpecialty', 'specialty2', 'extraSpecialty')
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

if (fotoInput) {
  fotoInput.addEventListener('change', async () => {
    const file = fotoInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      editarMensagem.textContent = 'Escolha um arquivo de imagem válido.';
      editarMensagem.style.color = '#b91c1c';
      fotoInput.value = '';
      return;
    }

    try {
      const croppedPhoto = typeof window.openImageCropper === 'function'
        ? await window.openImageCropper(file)
        : await fileToBase64(file);

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
  });
}

if (editarForm) {
  setupSimpleAutocomplete(
    'especialidade',
    'editarEspecialidadeSuggestions',
    EDITAR_SPECIALTY_OPTIONS
  );

  setupSimpleAutocomplete(
    'especialidadeSecundaria',
    'editarEspecialidadeSecundariaSuggestions',
    EDITAR_SPECIALTY_OPTIONS
  );

  if (typeof setupCityNeighborhoodAutocomplete === 'function') {
    setupCityNeighborhoodAutocomplete(
      'editarCidade',
      'editarCidadeSuggestions',
      'bairro',
      'editarBairroSuggestions'
    );
  }

  loadMyProfile();

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

    try {
      const profile = await window.physioApi.updateMyProfile({
        name: document.getElementById('nomeCompleto').value.trim() || null,
        phone: document.getElementById('telefone').value.trim() || null,
        city: document.getElementById('editarCidade')?.value.trim() || null,
        neighborhood: document.getElementById('bairro').value.trim() || null,
        specialty: especialidade || null,
        secondarySpecialty: especialidadeSecundaria || null,
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
