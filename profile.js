const profileContainer = document.getElementById('profileContainer');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildWhatsAppLink(phone, professionalName) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '#';

  const firstName = String(professionalName || '').trim().split(' ')[0];
  const message = `Ola Dr(a). ${firstName}, encontrei voce atraves do site PhysioPipeline e gostaria de agendar uma consulta.`;
  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
}

function buildClinicWhatsAppLink(clinic) {
  const digits = String(clinic?.whatsapp || clinic?.telefone || '').replace(/\D/g, '');
  if (!digits) return '#';

  const clinicName = clinic?.nomeClinica || clinic?.nome || 'a clínica';
  const message = `Ola, encontrei ${clinicName} no PhysioPipeline e gostaria de saber mais sobre os atendimentos.`;
  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
}

function getClinicLocationParts(clinic) {
  return [
    clinic?.endereco || clinic?.address,
    clinic?.bairro || clinic?.neighborhood,
    clinic?.cidade || clinic?.city,
  ]
    .map((part) => String(part || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function buildClinicMapsUrl(clinic) {
  const query = getClinicLocationParts(clinic).join(', ');
  if (!query) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function renderClinicMapSection(clinic) {
  const locationParts = getClinicLocationParts(clinic);
  const mapsUrl = buildClinicMapsUrl(clinic);

  if (!locationParts.length || !mapsUrl) return '';

  return `
    <section class="profile-section clinic-map-section">
      <h3>Localização</h3>
      <div class="clinic-map-card">
        <div>
          <strong>Endereço da clínica</strong>
          <p>${escapeHtml(locationParts.join(', '))}</p>
        </div>
        <a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Ver no Google Maps</a>
      </div>
    </section>
  `;
}

function getNeighborhoodBadge(profissional) {
  return [profissional.cidade, profissional.bairro].filter(Boolean).join(' â€¢ ') || 'Localizacao nao informada';
}

function getClinicLocationBadge(clinic) {
  return [clinic?.cidade, clinic?.bairro].filter(Boolean).join(' â€¢ ') || 'Localizacao nao informada';
}

function getAccountBadge(accountType) {
  return window.PhysioAccountTypes?.getAccountTypeMeta?.(accountType)?.badge || 'ðŸ§‘ Fisioterapeuta';
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
    '              <h3>Ultimos 30 dias</h3>',
    '            </div>',
    '            <span class="performance-badge">Somente voce ve</span>',
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
      ['Visualizacoes do perfil', getLeadCount(summary, 'PROFILE_VIEW')],
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
      'Nao foi possivel carregar a performance agora.',
      '</div>'
    ].join('');
  }
}

function getProfileSpecialties(profissional) {
  const explicitList = Array.isArray(profissional?.specialties)
    ? profissional.specialties
    : Array.isArray(profissional?.especialidades)
      ? profissional.especialidades
      : [];

  const mainSpecialty =
    profissional.especialidade ||
    profissional.specialty ||
    profissional.specialization ||
    '';

  const secondSpecialty =
    profissional.especialidadeSecundaria ||
    profissional.secondarySpecialty ||
    '';

  const thirdSpecialty =
    profissional.especialidadeTerciaria ||
    profissional.tertiarySpecialty ||
    profissional.specialty2 ||
    profissional.extraSpecialty ||
    '';

  const seen = new Set();

  return [...explicitList, mainSpecialty, secondSpecialty, thirdSpecialty]
    .map((specialty) => String(specialty || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((specialty) => {
      const key = specialty
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderBadgeList(items) {
  return (items || [])
    .filter(Boolean)
    .map((item) => `<span class="profile-badge">${escapeHtml(item)}</span>`)
    .join('');
}

function renderTeamMembers(team) {
  const members = Array.isArray(team)
    ? team.filter((member) => member?.name && member?.specialty)
    : [];

  if (!members.length) {
    return '<p>Essa clínica ainda não adicionou fisioterapeutas da equipe.</p>';
  }

  return `
    <div class="clinic-team-list">
      ${members.map((member) => `
        <article class="clinic-team-card">
          <strong>${escapeHtml(member.name)}</strong>
          <span>${escapeHtml(member.specialty)}</span>
        </article>
      `).join('')}
    </div>
  `;
}

function renderClinicProfileMarkup(clinic, isOwner, showClaimButton) {
  const clinicName = clinic?.nomeClinica || clinic?.nome || 'Clínica';
  const services = clinic?.servicesList || clinic?.servicosLista || [];
  const team = clinic?.physioTeamList || clinic?.fisioterapeutas || [];
  const logoHTML = clinic?.logo
    ? `<img src="${escapeHtml(clinic.logo)}" alt="${escapeHtml(clinicName)}" class="clickable-avatar" loading="lazy" decoding="async">`
    : `<span>${escapeHtml((clinicName || '?').charAt(0).toUpperCase())}</span>`;

  return `
    <article class="profile-card-full">
      <div class="profile-header">
        <div class="profile-avatar-big">${logoHTML}</div>
        <div class="profile-head-info">
          <h1>${escapeHtml(clinicName)}</h1>
          <p class="profile-specialty">${escapeHtml(clinic.responsavel || 'Clínica')}</p>
          <p class="profile-city">${escapeHtml(getClinicLocationBadge(clinic))}</p>
        </div>
      </div>

      <div class="profile-badges">
        <span class="profile-badge">${escapeHtml(getAccountBadge('clinic'))}</span>
        ${clinic.cidade ? `<span class="profile-badge">${escapeHtml(clinic.cidade)}</span>` : ''}
        ${clinic.bairro ? `<span class="profile-badge">${escapeHtml(clinic.bairro)}</span>` : ''}
        ${renderBadgeList(services)}
      </div>

      <section class="profile-section">
        <h3>Sobre a clínica</h3>
        <p>${escapeHtml(clinic.descricao || 'Essa clínica ainda não adicionou uma descrição.')}</p>
      </section>

      <section class="profile-section">
        <h3>Fisioterapeutas da clínica</h3>
        ${renderTeamMembers(team)}
      </section>

      <section class="profile-section">
        <h3>Contato</h3>
        <div class="profile-contact-list">
          <p><strong>Responsavel:</strong> ${escapeHtml(clinic.responsavel || '-')}</p>
          <p><strong>Telefone:</strong> ${escapeHtml(clinic.telefone || '-')}</p>
          <p><strong>WhatsApp:</strong> ${escapeHtml(clinic.whatsapp || '-')}</p>
          <p><strong>Endereco:</strong> ${escapeHtml(clinic.endereco || '-')}</p>
        </div>

        <div class="profile-actions">
          ${clinic.whatsapp || clinic.telefone ? `<a href="${buildClinicWhatsAppLink(clinic)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Falar no WhatsApp</a>` : ''}
          ${clinic.instagram ? `<a href="${escapeHtml(clinic.instagram)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Instagram</a>` : ''}
          ${showClaimButton ? `<a href="claim-clinic.html?id=${encodeURIComponent(clinic.id)}" class="btn btn-outline">Reivindicar clínica</a>` : ''}
          ${isOwner ? '<a href="clinic-dashboard.html" class="btn btn-secondary">Editar perfil</a>' : ''}
          <a href="buscar.html" class="btn btn-secondary">Voltar</a>
        </div>
        ${showClaimButton ? '<p class="claim-profile-warning">Esta clínica é sua? Reivindique para atualizar as informações.</p>' : ''}
      </section>

      ${renderClinicMapSection(clinic)}
    </article>
  `;
}

function renderPhysioProfileMarkup(profissional, isOwner, showClaimButton) {
  const specialties = getProfileSpecialties(profissional);
  const specialtiesText = specialties.length ? specialties.join(' â€¢ ') : '-';
  const fotoHTML = profissional.foto
    ? `<img src="${escapeHtml(profissional.foto)}" alt="${escapeHtml(profissional.nome)}" class="clickable-avatar" loading="lazy" decoding="async">`
    : `<span>${escapeHtml((profissional.nome || '?').charAt(0).toUpperCase())}</span>`;

  const whatsappLink = buildWhatsAppLink(profissional.telefone, profissional.nome);

  return `
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
        ${profissional.isClaimed ? '<span class="profile-badge">Perfil reivindicado</span>' : '<span class="profile-badge">Perfil nao reivindicado</span>'}
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
          ${profissional.instagram ? `<a href="${escapeHtml(profissional.instagram)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" data-lead-type="INSTAGRAM_CLICK">Instagram</a>` : ''}
          ${profissional.linkedin ? `<a href="${escapeHtml(profissional.linkedin)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" data-lead-type="LINKEDIN_CLICK">LinkedIn</a>` : ''}
          ${isOwner ? '<a href="editar-perfil.html" class="btn btn-secondary">Editar perfil</a>' : ''}
          ${showClaimButton ? `<a href="claim-profile.html?id=${encodeURIComponent(profissional.id)}" class="btn btn-outline">Reivindicar perfil</a>` : ''}
          <a href="buscar.html" class="btn btn-secondary">Voltar</a>
          ${showClaimButton ? '<p class="claim-profile-warning">Esse perfil é seu? Reivindique para atualizar as informações.</p>' : ''}
        </div>
      </section>
    </article>
  `;
}

async function resolveClinicProfileForSession(loggedUser) {
  console.info('PhysioPipeline clinic profile lookup accountType:', loggedUser?.accountType || null);

  if (loggedUser?.clinicProfile?.id) {
    console.info('PhysioPipeline clinic profile lookup route called: auth cache');
    return loggedUser.clinicProfile;
  }

  if (!window.physioApi?.fetchMyClinicProfile) return loggedUser?.clinicProfile || null;

  try {
    console.info('PhysioPipeline clinic profile lookup route called: /clinics/me');
    const clinicProfile = await window.physioApi.fetchMyClinicProfile();
    return clinicProfile || null;
  } catch (error) {
    console.error('PhysioPipeline clinic profile lookup failed:', error);
    return loggedUser?.clinicProfile || null;
  }
}

async function resolvePhysioProfileForSession(loggedUser) {
  if (loggedUser?.profile?.id) return loggedUser.profile;
  if (!window.physioApi?.fetchMyProfile) return null;

  try {
    console.info('PhysioPipeline physio profile lookup route called: /profiles/me');
    return await window.physioApi.fetchMyProfile();
  } catch (error) {
    console.info('PhysioPipeline physio profile lookup result: none', error?.message || error);
    return null;
  }
}

async function renderProfilePage() {
  if (!profileContainer) return;

  const params = new URLSearchParams(window.location.search);
  const profileId = params.get('id');
  const profileType = params.get('type') === 'clinic' ? 'clinic' : 'physio';

  if (!profileId) {
    const loggedUser = await (window.getLoggedUser ? window.getLoggedUser(true) : Promise.resolve(null));

    console.info('PhysioPipeline profile lookup current user id:', loggedUser?.id || null);
    console.info('PhysioPipeline profile lookup detected role/type:', loggedUser?.accountType || null);

    const [physioProfile, clinicProfile] = await Promise.all([
      resolvePhysioProfileForSession(loggedUser),
      resolveClinicProfileForSession(loggedUser),
    ]);

    console.info('PhysioPipeline profile lookup physiotherapist profile result:', physioProfile?.id || null);
    console.info('PhysioPipeline profile lookup clinic profile result:', clinicProfile?.id || null);

    if (clinicProfile?.id) {
      console.info('PhysioPipeline profile lookup final selected profile type:', 'clinic');
      window.location.replace(`profile.html?type=clinic&id=${encodeURIComponent(clinicProfile.id)}`);
      return;
    }

    if (physioProfile?.id) {
      console.info('PhysioPipeline profile lookup final selected profile type:', 'physio');
      window.location.replace(`profile.html?id=${encodeURIComponent(physioProfile.id)}`);
      return;
    }

    console.info('PhysioPipeline profile lookup final selected profile type:', null);

    const completeHref = loggedUser?.accountType === 'clinic'
      ? 'clinic-dashboard.html'
      : 'cadastro.html?completeProfile=true';

    profileContainer.innerHTML = `
      <article class="profile-card-full">
        <h2>Perfil ainda não encontrado</h2>
        <p>Não encontramos um perfil publicado ligado a esta sessão.</p>
        <div class="profile-actions">
          <a href="${completeHref}" class="btn btn-primary">Completar cadastro</a>
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
    const loggedUser = await (window.getLoggedUser ? window.getLoggedUser() : Promise.resolve(null));

    if (profileType === 'clinic') {
      const clinic = await window.physioApi.fetchClinic(profileId);
      if (!clinic) throw new Error('Essa clínica não existe ou não pode ser carregada.');

      const isClinicOwner = loggedUser?.accountType === 'clinic' && loggedUser?.id === clinic?.userId;
      const showClinicClaimButton = !isClinicOwner && Boolean(clinic?.isClaimable);
      profileContainer.innerHTML = renderClinicProfileMarkup(clinic, isClinicOwner, showClinicClaimButton);
      setupImageModal();
      return;
    }

    const profissional = await window.physioApi.fetchProfile(profileId);
    if (!profissional) throw new Error('Esse perfil não existe ou não pode ser carregado.');

    const linkedProfileId = loggedUser?.profile?.id || null;
    const isOwner = linkedProfileId === profissional.id;
    const showClaimButton = !isOwner && !profissional.isClaimed;

    if (!isOwner) {
      recordProfileLeadEvent(profissional, 'PROFILE_VIEW');
    }

    profileContainer.innerHTML = renderPhysioProfileMarkup(profissional, isOwner, showClaimButton);

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
        <h2>Perfil nao encontrado</h2>
        <p>${escapeHtml(error.message || 'Esse perfil não existe ou não pode ser carregado.')}</p>
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





