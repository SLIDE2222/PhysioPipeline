const profileContainer = document.getElementById('profileContainer');

const SPECIALTY_OPTIONS = [
  'Fisioterapia Ortopédica',
  'Fisioterapia Esportiva',
  'Fisioterapia Neurológica',
  'Fisioterapia Geriátrica',
  'Fisioterapia Respiratória',
  'Pós-operatório'
];

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildWhatsAppLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '#';
  return `https://wa.me/55${digits}`;
}

function getNeighborhoodBadge(profissional) {
  return [profissional.cidade, profissional.bairro]
    .filter(Boolean)
    .join(' • ') || 'Localização não informada';
}

function getProfileSpecialties(profissional) {
  const mainSpecialty =
    profissional.especialidade ||
    profissional.specialty ||
    profissional.specialization ||
    '';

  const secondSpecialty =
    profissional.especialidadeSecundaria ||
    profissional.secondarySpecialty ||
    profissional.specialty2 ||
    profissional.extraSpecialty ||
    '';

  return [mainSpecialty, secondSpecialty]
    .filter(Boolean)
    .filter((specialty, index, arr) => arr.indexOf(specialty) === index);
}

async function renderProfilePage() {
  if (!profileContainer) return;

  const params = new URLSearchParams(window.location.search);
  const profileId = params.get('id');

  if (!profileId) {
    profileContainer.innerHTML = `
      <article class="profile-card-full">
        <h2>Perfil não encontrado</h2>
        <p>Nenhum id de perfil foi informado.</p>
      </article>
    `;
    return;
  }

  profileContainer.innerHTML = `
    <article class="profile-card-full">
      <p>Carregando perfil...</p>
    </article>
  `;

  try {
    const profissional = await window.physioApi.fetchProfile(profileId);

    if (!profissional) {
      throw new Error('Esse perfil não existe ou não pôde ser carregado.');
    }

    const loggedUser = await (window.getLoggedUser
      ? window.getLoggedUser()
      : Promise.resolve(null));

    const linkedProfileId = loggedUser?.profile?.id || null;
    const isOwner = linkedProfileId === profissional.id;

    const specialties = getProfileSpecialties(profissional);
    const specialtiesText = specialties.length ? specialties.join(' • ') : '-';

    const fotoHTML = profissional.foto
      ? `<img src="${escapeHtml(profissional.foto)}" alt="${escapeHtml(profissional.nome)}" class="clickable-avatar">`
      : `<span>${escapeHtml((profissional.nome || '?').charAt(0).toUpperCase())}</span>`;

    const whatsappLink = buildWhatsAppLink(profissional.telefone);

    const showClaimButton =
      !isOwner &&
      !profissional.isClaimed &&
      !profissional.ownerUserId;

    profileContainer.innerHTML = `
      <article class="profile-card-full">
        <div class="profile-header">
          <div class="profile-avatar-big">${fotoHTML}</div>
          <div class="profile-head-info">
            <h1>${escapeHtml(profissional.nome)}</h1>
            <p class="profile-specialty">${escapeHtml(specialtiesText)}</p>
            <p class="profile-city">${escapeHtml(getNeighborhoodBadge(profissional))}</p>
          </div>
        </div>

        <div class="profile-badges">
          ${profissional.atendimento ? `<span class="profile-badge">${escapeHtml(profissional.atendimento)}</span>` : ''}
          ${profissional.cidade ? `<span class="profile-badge">${escapeHtml(profissional.cidade)}</span>` : ''}
          ${profissional.bairro ? `<span class="profile-badge">${escapeHtml(profissional.bairro)}</span>` : ''}
          ${specialties.map((specialty) => `<span class="profile-badge">${escapeHtml(specialty)}</span>`).join('')}
          ${profissional.isClaimed ? '<span class="profile-badge">Perfil reivindicado</span>' : '<span class="profile-badge">Perfil público</span>'}
        </div>

        <section class="profile-section">
          <h3>Sobre</h3>
          <p>${escapeHtml(profissional.descricao || 'Esse profissional ainda não adicionou uma descrição.')}</p>
        </section>

        <section class="profile-section">
          <h3>Contato</h3>
          <div class="profile-contact-list">
            <p><strong>E-mail:</strong> ${escapeHtml(profissional.email || '-')}</p>
            <p><strong>Telefone:</strong> ${escapeHtml(profissional.telefone || '-')}</p>
            <p><strong>Bairro:</strong> ${escapeHtml(profissional.bairro || '-')}</p>
          </div>

          <div class="profile-actions">
            ${profissional.telefone ? `<a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Falar no WhatsApp</a>` : ''}
            ${profissional.instagram ? `<a href="${escapeHtml(profissional.instagram)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">📸 Instagram</a>` : ''}
            ${profissional.linkedin ? `<a href="${escapeHtml(profissional.linkedin)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">💼 LinkedIn</a>` : ''}
            ${isOwner ? `<a href="editar-perfil.html" class="btn btn-secondary">Editar perfil</a>` : ''}
            ${showClaimButton ? `<a href="claim-profile.html?id=${encodeURIComponent(profissional.id)}" class="btn btn-secondary">Claim this profile</a>` : ''}
            <a href="buscar.html" class="btn btn-secondary">Voltar</a>
          </div>
        </section>
      </article>
    `;

    setupImageModal();
  } catch (error) {
    profileContainer.innerHTML = `
      <article class="profile-card-full">
        <h2>Perfil não encontrado</h2>
        <p>${escapeHtml(error.message || 'Esse perfil não existe ou não pôde ser carregado.')}</p>
        <div class="profile-actions">
          <a href="buscar.html" class="btn btn-secondary">Voltar para busca</a>
        </div>
      </article>
    `;
  }
}

function setupImageModal() {
  const modal = document.getElementById('imgModal');
  const modalContent = document.getElementById('imgModalContent');
  const clickableAvatar = document.querySelector('.clickable-avatar');

  if (!modal || !modalContent || !clickableAvatar) return;

  clickableAvatar.style.cursor = 'zoom-in';

  clickableAvatar.addEventListener('click', () => {
    modalContent.src = clickableAvatar.src;
    modal.style.display = 'flex';
  });

  modal.addEventListener('click', () => {
    modal.style.display = 'none';
    modalContent.src = '';
  });
}

renderProfilePage();
