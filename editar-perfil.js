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
  const select = document.getElementById(selectId);
  if (!select) return;

  const optionExists = Array.from(select.options).some((option) => option.value === value);
  select.value = optionExists ? value : '';
}

function getProfileField(profile, ...fields) {
  for (const field of fields) {
    if (profile?.[field]) return profile[field];
  }
  return '';
}

async function loadMyProfile() {
  const auth = window.physioApi.getStoredAuth();
  if (!auth?.token) {
    window.location.href = 'login.html';
    return null;
  }

  try {
    const data = await window.physioApi.me();
    const profile = data.user?.profiles?.[0];
    if (!profile) {
      editarMensagem.textContent = 'Nenhum perfil está vinculado à sua conta.';
      editarMensagem.style.color = '#b91c1c';
      return null;
    }

    document.getElementById('telefone').value = profile.phone || profile.telefone || '';
    document.getElementById('bairro').value = profile.neighborhood || profile.bairro || '';

    setSelectValue(
      'especialidade',
      getProfileField(profile, 'specialty', 'especialidade', 'specialization')
    );

    setSelectValue(
      'especialidadeSecundaria',
      getProfileField(profile, 'secondarySpecialty', 'especialidadeSecundaria', 'specialty2', 'extraSpecialty')
    );

    document.getElementById('instagram').value = profile.instagram || '';
    document.getElementById('linkedin').value = profile.linkedin || '';
    document.getElementById('descricao').value = profile.bio || profile.descricao || '';
    fotoBase64 = profile.photoUrl || profile.foto || '';

    if (fotoBase64) {
      fotoPreview.src = fotoBase64;
      fotoPreview.style.display = 'block';
    }

    return profile;
  } catch (error) {
    editarMensagem.textContent = error.message || 'Sua sessão expirou.';
    editarMensagem.style.color = '#b91c1c';
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
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
    fotoBase64 = await fileToBase64(file);
    fotoPreview.src = fotoBase64;
    fotoPreview.style.display = 'block';
  });
}

if (editarForm) {
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
        phone: document.getElementById('telefone').value.trim() || null,
        neighborhood: document.getElementById('bairro').value.trim() || null,
        specialty: especialidade || null,
        secondarySpecialty: especialidadeSecundaria || null,
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
