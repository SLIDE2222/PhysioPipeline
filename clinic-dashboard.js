const clinicDashboardForm = document.getElementById('clinicDashboardForm');
const clinicDashboardMessage = document.getElementById('clinicDashboardMessage');
const clinicLogoInput = document.getElementById('clinicLogo');
const clinicLogoPreview = document.getElementById('clinicLogoPreview');

let clinicLogoBase64 = '';

function setClinicMessage(text, color) {
  if (!clinicDashboardMessage) return;
  clinicDashboardMessage.textContent = text;
  clinicDashboardMessage.style.color = color;
}

function fillClinicForm(profile) {
  document.getElementById('clinicName').value = profile?.clinicName || '';
  document.getElementById('clinicAddress').value = profile?.address || '';
  document.getElementById('clinicCity').value = profile?.city || '';
  document.getElementById('clinicPhone').value = profile?.phone || '';
  document.getElementById('clinicWhatsapp').value = profile?.whatsapp || '';
  document.getElementById('clinicDescription').value = profile?.description || '';

  clinicLogoBase64 = profile?.logoUrl || '';
  if (clinicLogoBase64 && clinicLogoPreview) {
    clinicLogoPreview.src = clinicLogoBase64;
    clinicLogoPreview.style.display = 'block';
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
  } catch (error) {
    setClinicMessage(error.message || 'Nao foi possivel carregar os dados da clinica.', '#b91c1c');
  }
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
      setClinicMessage('Nao foi possivel ajustar essa imagem.', '#b91c1c');
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
      await window.physioApi.updateMyClinicProfile({
        clinicName: document.getElementById('clinicName').value.trim() || null,
        address: document.getElementById('clinicAddress').value.trim() || null,
        city: document.getElementById('clinicCity').value.trim() || null,
        phone: document.getElementById('clinicPhone').value.trim() || null,
        whatsapp: document.getElementById('clinicWhatsapp').value.trim() || null,
        logoUrl: clinicLogoBase64 || null,
        description: document.getElementById('clinicDescription').value.trim() || null,
      });

      setClinicMessage('Dados da clinica salvos com sucesso!', '#166534');
    } catch (error) {
      setClinicMessage(error.message || 'Nao foi possivel salvar os dados da clinica.', '#b91c1c');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  loadClinicDashboard();
}
