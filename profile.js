const profileContainer = document.getElementById('profileContainer');

const SPECIALTY_OPTIONS = [
  'Fisioterapia Ortopédica',
  'Fisioterapia Esportiva',
  'Fisioterapia Neurológica',
  'Fisioterapia Geriátrica',
  'Fisioterapia Respiratória',
  'Pós-operatório'
];

const CITY_OPTIONS = [
  'São Paulo',
  'Campinas',
  'Sorocaba',
  'Itapetininga',
  'Rio de Janeiro',
  'Belo Horizonte'
];

const NEIGHBORHOOD_OPTIONS = {
  'São Paulo': [
    'Moema',
    'Tatuapé',
    'Bela Vista',
    'Centro'
  ],

  'Sorocaba': [
    'Campolim',
    'Centro'
  ],

  'Itapetininga': [
    'Centro',
    'Vila Barth'
  ]
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildWhatsAppLink(phone, professionalName) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (!digits) return '#';

  const firstName = String(professionalName || '')
    .trim()
    .split(' ')[0];

  const message =
    `Olá Dr(a). ${firstName}, encontrei você através do site PhysioPipeline e gostaria de agendar uma consulta.`;

  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
}

function getNeighborhoodBadge(profissional) {
  return [profissional.cidade, profissional.bairro]
    .filter(Boolean)
    .join(' • ') || 'Localização não informada';
}

function getAccountBadge(accountType) {
  return window.PhysioAccountTypes?.getAccountTypeMeta?.(accountType)?.badge || '🧑 Fisioterapeuta';
}

function recordProfileLeadEvent(profissional, type, source = 'profile') {
  if (!profissional?.id || !window.physioApi?.recordLeadEvent) return Promise.resolve(null);

  return window.physioApi.recordLeadEvent({
    profileId: profissional.id,
    type,
    source,
    city: profissional.cidade || profissional.city || null,
    specialty: profissional.especialidade || profissional.specialty || null,
  });
}

function getLeadCount(summary, type) {
  return Number(summary?.[type] || 0);
}

function renderLeadSummaryCard() {
  return [
    '        <section class="profile-section profile-performance-section" id="leadPerformanceSection">',
    '          <div class="performance-heading">',
    '            <div>',
    '              <p class="performance-eyebrow">Performance</p>',
    '              <h3>Últimos 30 dias</h3>',
    '            </div>',
    '            <span class="performance-badge">Somente você vê</span>',
    '          </div>',
    '          <div id="leadSummaryContent" class="performance-grid">',
    '            <div class="performance-loading">Carregando dados...</div>',
    '          </div>',
    '        </section>'
  ].join('\n');
}

async function loadLeadSummary() {
  const target = document.getElementById('leadSummaryContent');
  if (!target || !window.physioApi?.fetchMyLeadSummary) return;

  try {
    const data = await window.physioApi.fetchMyLeadSummary();
    const summary = data?.summary || {};

    const metrics = [
      ['Visualizações do perfil', getLeadCount(summary, 'PROFILE_VIEW')],
      ['Cliques no WhatsApp', getLeadCount(summary, 'WHATSAPP_CLICK')],
      ['Cliques no Instagram', getLeadCount(summary, 'INSTAGRAM_CLICK')],
      ['Cliques no LinkedIn', getLeadCount(summary, 'LINKEDIN_CLICK')],
    ];

    target.innerHTML = metrics.map(([label, value]) => `
      <article class="performance-metric">
        <strong>${value}</strong>
        <span>${escapeHtml(label)}</span>
      </article>
    `).join('');
  } catch (error) {
    target.innerHTML = [
      '<div class="performance-loading performance-error">',
      'Não foi possível carregar a performance agora.',
      '</div>'
    ].join('');
  }
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
    const loggedUser = await (window.getLoggedUser
      ? window.getLoggedUser(true)
      : Promise.resolve(null));

    if (loggedUser?.accountType === 'clinic') {
      window.location.replace('clinic-dashboard.html');
      return;
    }

    if (loggedUser?.profile?.id) {
      window.location.replace(`profile.html?id=${encodeURIComponent(loggedUser.profile.id)}`);
      return;
    }

    profileContainer.innerHTML = `
      <article class="profile-card-full">
        <h2>Perfil ainda não encontrado</h2>
        <p>Não encontramos um perfil publicado ligado a esta sessão.</p>
        <div class="profile-actions">
          <a href="cadastro.html?completeProfile=true" class="btn btn-primary">Completar cadastro</a>
          <a href="buscar.html" class="btn btn-secondary">Buscar fisioterapeuta</a>
        </div>
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
      ? `<img src="${escapeHtml(profissional.foto)}" alt="${escapeHtml(profissional.nome)}" class="clickable-avatar" loading="lazy" decoding="async">`
      : `<span>${escapeHtml((profissional.nome || '?').charAt(0).toUpperCase())}</span>`;

   const whatsappLink = buildWhatsAppLink(
  profissional.telefone,
  profissional.nome
);

    const showClaimButton =
      !isOwner &&
      !profissional.isClaimed;

    if (!isOwner) {
      recordProfileLeadEvent(profissional, 'PROFILE_VIEW');
    }

    profileContainer.innerHTML = `
      <article class="profile-card-full">
        <div class="profile-header">
          <div class="profile-avatar-big">${fotoHTML}</div>
          <div class="profile-head-info">
            <h1>${escapeHtml(profissional.nome)}</h1>
            <p class="profile-specialty">${escapeHtml(specialtiesText)}</p>
            <p class="profile-city">${escapeHtml(getNeighborhoodBadge(profissional))}</p>
            <p class="profile-city">${escapeHtml(getAccountBadge('physio'))}</p>
          </div>
        </div>

        <div class="profile-badges">
          ${profissional.atendimento ? `<span class="profile-badge">${escapeHtml(profissional.atendimento)}</span>` : ''}
          ${profissional.cidade ? `<span class="profile-badge">${escapeHtml(profissional.cidade)}</span>` : ''}
          ${profissional.bairro ? `<span class="profile-badge">${escapeHtml(profissional.bairro)}</span>` : ''}
          ${specialties.map((specialty) => `<span class="profile-badge">${escapeHtml(specialty)}</span>`).join('')}
          ${profissional.isClaimed ? '<span class="profile-badge">Perfil reivindicado</span>' : '<span class="profile-badge">Perfil não reivindicado</span>'}
        </div>

        <section class="profile-section">
          <h3>Sobre</h3>
          <p>${escapeHtml(profissional.descricao || 'Esse profissional ainda não adicionou uma descrição.')}</p>
        </section>

        ${isOwner ? renderLeadSummaryCard() : ''}

        <section class="profile-section">
          <h3>Contato</h3>
          <div class="profile-contact-list">
            <p><strong>E-mail:</strong> ${escapeHtml(profissional.email || '-')}</p>
            <p><strong>Telefone:</strong> ${escapeHtml(profissional.telefone || '-')}</p>
            <p><strong>Bairro:</strong> ${escapeHtml(profissional.bairro || '-')}</p>
          </div>

          <div class="profile-actions">
            ${profissional.telefone ? `<a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" data-lead-type="WHATSAPP_CLICK">Falar no WhatsApp</a>` : ''}
            ${profissional.instagram ? `<a href="${escapeHtml(profissional.instagram)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" data-lead-type="INSTAGRAM_CLICK">📸 Instagram</a>` : ''}
            ${profissional.linkedin ? `<a href="${escapeHtml(profissional.linkedin)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" data-lead-type="LINKEDIN_CLICK">💼 LinkedIn</a>` : ''}
            ${isOwner ? `
  <a href="editar-perfil.html" class="btn btn-secondary">
    Editar perfil
  </a>
` : ''}

${showClaimButton ? `
  <a
    href="claim-profile.html?id=${encodeURIComponent(profissional.id)}"
    class="btn btn-outline"
  >
    Reivindicar perfil
  </a>
` : ''}

<a href="buscar.html" class="btn btn-secondary">
  Voltar
</a>

${showClaimButton ? `
  <p class="claim-profile-warning">
    Esse perfil é seu? Reivindique para atualizar as informações.
  </p>
` : ''}

</div>
</section>
</article>
`;

    if (isOwner) {
      loadLeadSummary();
    }

    document.querySelectorAll('[data-lead-type]').forEach((link) => {
      link.addEventListener('click', () => {
        if (!isOwner) {
          recordProfileLeadEvent(profissional, link.dataset.leadType);
        }
      });
    });

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
