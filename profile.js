const profileContainer = document.getElementById('profileContainer');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeWhatsAppNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';

  const withoutLeadingZeros = digits.replace(/^0+/, '');
  if (!withoutLeadingZeros) return '';
  if (withoutLeadingZeros.startsWith('55')) return withoutLeadingZeros;
  if (withoutLeadingZeros.length === 10 || withoutLeadingZeros.length === 11) {
    return `55${withoutLeadingZeros}`;
  }

  return withoutLeadingZeros;
}

function buildWhatsAppLink(phone, professionalName) {
  const digits = normalizeWhatsAppNumber(phone);
  if (!digits) return '';
  const firstName = String(professionalName || '').trim().split(' ')[0];
  const message = `Encontrei você através do site PhysioPipeline e gostaria de agendar uma consulta.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function buildClinicWhatsAppLink(clinic) {
  const digits = normalizeWhatsAppNumber(clinic?.whatsapp || clinic?.telefone);
  if (!digits) return '';

  const clinicName = clinic?.nomeClinica || clinic?.nome || 'a clínica';
  const message = `Encontrei ${clinicName} através do site PhysioPipeline e gostaria de agendar uma consulta.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
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
  return [profissional.cidade, profissional.bairro].filter(Boolean).join(' • ') || 'Localização não informada';
}

function getClinicLocationBadge(clinic) {
  return [clinic?.cidade, clinic?.bairro].filter(Boolean).join(' • ') || 'Localização não informada';
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

function showProfileToast(message, tone = 'success') {
  const toast = document.createElement('div');
  toast.className = `profile-inline-toast profile-inline-toast--${tone}`;
  toast.innerHTML = `
    <span class="profile-inline-toast__icon" aria-hidden="true">${tone === 'success' ? '✓' : tone === 'info' ? 'i' : '!'}</span>
    <span class="profile-inline-toast__text">${escapeHtml(message)}</span>
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

function renderProfileRequestState(label, tone = 'pending') {
  return `<span class="profile-request-state profile-request-state--${escapeHtml(tone)}" role="status">${escapeHtml(label)}</span>`;
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

function getReviewStatusMeta(status) {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  switch (normalizedStatus) {
    case 'approved':
    case 'published':
      return { label: 'Publicada', tone: 'published' };
    case 'pending_owner':
      return { label: 'Pendente de aprovaÃ§Ã£o', tone: 'pending' };
    case 'pending_admin':
      return { label: 'Pendente de anÃ¡lise', tone: 'pending' };
    case 'reported':
      return { label: 'Reportada', tone: 'reported' };
    case 'rejected':
      return { label: 'Removida', tone: 'rejected' };
    default:
      return { label: 'Pendente', tone: 'pending' };
  }
}

function formatReviewDate(value) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
  }).format(parsed);
}

function renderStarsMarkup(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  if (!safeRating) return '';
  return '&#9733;'.repeat(safeRating) + '&#9734;'.repeat(5 - safeRating);
}

function renderReviewStars(value, className = 'profile-review-stars') {
  const rating = Math.max(0, Math.min(Number(value || 0), 5));
  if (!rating) return '';

  return `
    <span class="${className}" aria-label="${rating} de 5 estrelas">
      <span class="${className}__value">${renderStarsMarkup(rating)}</span>
    </span>
  `;
}

function renderReviewCard(review, options = {}) {
  const statusMeta = getReviewStatusMeta(review?.status);
  const allowOwnerReport = Boolean(options.isOwner && ['published', 'reported'].includes(String(review?.status || '').toLowerCase()));
  const ratingMarkup = renderReviewStars(review?.rating, 'profile-review-card__rating');

  return `
    <article class="profile-review-card" data-review-id="${escapeHtml(review.id)}">
      <div class="profile-review-card__header">
        <div>
          <strong>${escapeHtml(review.authorName || 'Paciente')}</strong>
          ${review.title ? `<p class="profile-review-card__title">${escapeHtml(review.title)}</p>` : ''}
        </div>
        ${options.showStatus ? `<span class="review-status-badge review-status-badge--${escapeHtml(statusMeta.tone)}">${escapeHtml(statusMeta.label)}</span>` : ''}
      </div>
      ${ratingMarkup}
      <p class="profile-review-card__body">${escapeHtml(review.body || '')}</p>
      <div class="profile-review-card__footer">
        <span>${escapeHtml(formatReviewDate(review.createdAt) || 'Agora')}</span>
        ${allowOwnerReport
          ? `<button type="button" class="btn btn-outline btn-small" data-report-review="${escapeHtml(review.id)}">${String(review.status || '').toLowerCase() === 'reported' ? 'Atualizar reporte' : 'Reportar review'}</button>`
          : ''
        }
      </div>
      ${options.showStatus && review.reportReason
        ? `<p class="profile-review-card__report-reason"><strong>Motivo do reporte:</strong> ${escapeHtml(review.reportReason)}</p>`
        : ''
      }
    </article>
  `;
}

function renderReviewSubmissionForm(profileId) {
  return `
    <div class="profile-review-composer" data-profile-review-composer>
      <div class="profile-review-toggle-row">
      <button
        type="button"
        class="btn btn-outline profile-review-toggle"
        data-profile-review-toggle
        aria-expanded="false"
        aria-controls="profileReviewFormPanel"
      >
        <span class="profile-review-toggle__text">+ Avaliar</span>
      </button>
      </div>
      <div
        class="profile-review-form-panel"
        id="profileReviewFormPanel"
        data-profile-review-form-panel
        hidden
      >
        <form class="profile-review-form" data-profile-review-form>
          <div class="profile-review-form__grid">
            <label class="profile-review-form__field">
              <span>Seu nome</span>
              <input type="text" name="authorName" maxlength="120" placeholder="Como você gostaria de aparecer" required />
            </label>
            <label class="profile-review-form__field">
              <span>E-mail (opcional)</span>
              <input type="email" name="authorEmail" maxlength="255" placeholder="voce@email.com" />
            </label>
          </div>
          <label class="profile-review-form__field">
            <span>Título (opcional)</span>
            <input type="text" name="title" maxlength="160" placeholder="Resumo curto da sua experiência" />
          </label>
          <fieldset class="profile-review-form__field profile-review-rating-fieldset">
            <legend>Nota</legend>
            <div class="profile-review-rating-stars" role="radiogroup" aria-label="Nota da avaliação">
              <input id="review-rating-5" type="radio" name="rating" value="5" required />
              <label for="review-rating-5" aria-label="5 estrelas">★</label>
              <input id="review-rating-4" type="radio" name="rating" value="4" />
              <label for="review-rating-4" aria-label="4 estrelas">★</label>
              <input id="review-rating-3" type="radio" name="rating" value="3" />
              <label for="review-rating-3" aria-label="3 estrelas">★</label>
              <input id="review-rating-2" type="radio" name="rating" value="2" />
              <label for="review-rating-2" aria-label="2 estrelas">★</label>
              <input id="review-rating-1" type="radio" name="rating" value="1" />
              <label for="review-rating-1" aria-label="1 estrela">★</label>
            </div>
          </fieldset>
          <label class="profile-review-form__field">
            <span>Avaliação</span>
            <textarea name="body" rows="5" maxlength="4000" placeholder="Conte como foi sua experiência com este profissional." required></textarea>
          </label>
          <input type="hidden" name="profileId" value="${escapeHtml(profileId)}" />
          <div class="profile-review-form__actions">
            <button type="submit" class="btn btn-primary">Enviar avaliação</button>
            <span class="form-hint" data-profile-review-message aria-live="polite"></span>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderReviewsSection(profissional, isOwner) {
  return `
    <section class="profile-section profile-reviews-section" id="profileReviewsSection">
      <div class="profile-section-heading">
        <div>
          <h3>Avaliações</h3>
          <p class="form-hint">
            ${isOwner
              ? 'Você pode visualizar todas as avaliações do seu perfil e reportar casos que precisem de moderação.'
              : 'Avaliações de pacientes e visitantes do perfil.'}
          </p>
        </div>
      </div>
      <div class="profile-reviews-list" data-profile-reviews-list>
        <p class="form-hint">Carregando avaliações...</p>
      </div>
      ${isOwner ? '' : renderReviewSubmissionForm(profissional.id)}
    </section>
  `;
}

function renderReviewsDrawer(profissional, isOwner) {
  return `
    <section class="profile-reviews-shell">
      <button
        type="button"
        class="profile-reviews-launcher"
        data-profile-reviews-toggle
        aria-expanded="false"
        aria-controls="profileReviewsDrawer"
      >
        <span class="profile-reviews-launcher__icon" data-profile-reviews-toggle-icon aria-hidden="true">+</span>
        <span class="profile-reviews-launcher__text" data-profile-reviews-toggle-text>Avaliações</span>
      </button>
      <div class="profile-reviews-drawer" id="profileReviewsDrawer" data-profile-reviews-drawer hidden>
        <article class="profile-card-full profile-reviews-drawer__card">
          ${renderReviewsSection(profissional, isOwner)}
        </article>
      </div>
    </section>
  `;
}

function getGalleryPhotos(entity) {
  const explicitList = Array.isArray(entity?.photosList)
    ? entity.photosList
    : Array.isArray(entity?.photos)
      ? entity.photos
      : [];

  const seen = new Set();

  return explicitList
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderProfileGallerySection(entity) {
  const photos = getGalleryPhotos(entity);
  if (!photos.length) return '';

  return `
    <section class="profile-gallery-section">
      <article class="profile-card-full profile-gallery-card">
        <div class="profile-section-heading">
          <div>
            <h3>Fotos</h3>
            <p class="form-hint">Imagens adicionais deste perfil.</p>
          </div>
        </div>
        <div class="profile-gallery-grid">
          ${photos.map((photoUrl, index) => `
            <figure class="profile-gallery-item">
              <img src="${escapeHtml(photoUrl)}" alt="Foto do perfil ${index + 1}" loading="lazy" decoding="async" />
            </figure>
          `).join('')}
        </div>
      </article>
    </section>
  `;
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

function renderLinkedPhysiotherapists(links) {
  const acceptedLinks = Array.isArray(links)
    ? links.filter((link) => link?.profile?.id)
    : [];

  if (!acceptedLinks.length) return '';

  return acceptedLinks.map((link) => {
    const profile = link.profile;
    const specialties = Array.isArray(profile.specialties)
      ? profile.specialties
      : [profile.specialty].filter(Boolean);

    return `
      <article class="clinic-team-card">
        <strong>${escapeHtml(profile.name || 'Fisioterapeuta')}</strong>
        <span>${escapeHtml(specialties.join(' • ') || 'Especialidade não informada')}</span>
        <a href="profile.html?id=${encodeURIComponent(profile.id)}" class="profile-inline-link">Ver perfil</a>
      </article>
    `;
  }).join('');
}

function renderClinicTeamSection(clinic, manualTeam) {
  const linkedHtml = renderLinkedPhysiotherapists(clinic?.linkedPhysiotherapists);
  const manualMembers = Array.isArray(manualTeam)
    ? manualTeam.filter((member) => member?.name && member?.specialty)
    : [];
  const manualHtml = manualMembers.map((member) => `
    <article class="clinic-team-card">
      <strong>${escapeHtml(member.name)}</strong>
      <span>${escapeHtml(member.specialty)}</span>
    </article>
  `).join('');

  if (!linkedHtml && !manualMembers.length) {
    return '<p>Essa clínica ainda não adicionou fisioterapeutas da equipe.</p>';
  }

  return `<div class="clinic-team-list">${linkedHtml}${manualHtml}</div>`;
}

function renderLinkedClinics(links) {
  const acceptedLinks = Array.isArray(links)
    ? links.filter((link) => link?.clinic?.id)
    : [];

  if (!acceptedLinks.length) return '';

  return `
    <section class="profile-section">
      <h3>Clínicas vinculadas</h3>
      <div class="clinic-team-list">
        ${acceptedLinks.map((link) => {
          const clinic = link.clinic;
          const location = [clinic.city, clinic.neighborhood].filter(Boolean).join(' • ') || 'Localização não informada';
          return `
            <article class="clinic-team-card">
              <strong>${escapeHtml(clinic.clinicName || 'Clínica')}</strong>
              <span>${escapeHtml(location)}</span>
              <a href="profile.html?type=clinic&id=${encodeURIComponent(clinic.id)}" class="profile-inline-link">Ver clínica</a>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderPhysioClinicRequestCta(clinic, clinicLinkState) {
  if (!clinicLinkState?.isPhysioViewer) return '';

  const clinicId = encodeURIComponent(clinic.id);
  const status = clinicLinkState.status || 'NONE';

  if (status === 'PENDING') {
    return `<div class="profile-request-action" data-clinic-link-state>${renderProfileRequestState('Solicitação pendente', 'pending')}</div>`;
  }

  if (status === 'ACCEPTED') {
    return `<div class="profile-request-action" data-clinic-link-state>${renderProfileRequestState('Vínculo ativo', 'active')}</div>`;
  }

  return `
    <div class="profile-request-action" data-clinic-link-state>
      <button type="button" class="btn btn-primary" data-request-clinic-link="${clinicId}">
        Solicitar vínculo
      </button>
      <span class="form-hint" data-clinic-link-request-message aria-live="polite"></span>
    </div>
  `;
}

function renderClinicProfileMarkup(clinic, isOwner, showClaimButton, clinicLinkState = null) {
  const clinicName = clinic?.nomeClinica || clinic?.nome || 'Clínica';
  const services = clinic?.servicesList || clinic?.servicosLista || [];
  const team = clinic?.physioTeamList || clinic?.fisioterapeutas || [];
  const clinicWhatsAppLink = buildClinicWhatsAppLink(clinic);
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
        ${renderClinicTeamSection(clinic, team)}
      </section>

      <section class="profile-section">
        <h3>Contato</h3>
        <div class="profile-contact-list">
          <p><strong>Responsável:</strong> ${escapeHtml(clinic.responsavel || '-')}</p>
          <p><strong>Telefone:</strong> ${escapeHtml(clinic.telefone || '-')}</p>
          <p><strong>WhatsApp:</strong> ${escapeHtml(clinic.whatsapp || '-')}</p>
          <p><strong>Endereço:</strong> ${escapeHtml(clinic.endereco || '-')}</p>
        </div>

        <div class="profile-actions">
          ${clinicWhatsAppLink ? `<a href="${clinicWhatsAppLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Falar no WhatsApp</a>` : ''}
          ${clinic.instagram ? `<a href="${escapeHtml(clinic.instagram)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline">Instagram</a>` : ''}
          ${renderPhysioClinicRequestCta(clinic, clinicLinkState)}
          ${showClaimButton ? `<a href="claim-clinic.html?id=${encodeURIComponent(clinic.id)}" class="btn btn-outline">Reivindicar clínica</a>` : ''}
          ${isOwner ? '<a href="clinic-dashboard.html" class="btn btn-secondary">Editar perfil</a>' : ''}
          <a href="buscar.html" class="btn btn-secondary">Voltar</a>
        </div>
        ${showClaimButton ? '<p class="claim-profile-warning">Esta clínica é sua? Reivindique para atualizar as informações.</p>' : ''}
      </section>

      ${renderClinicMapSection(clinic)}
    </article>

    ${renderProfileGallerySection(clinic)}
  `;
}

function renderClinicLinkRequestCta(profissional, clinicLinkState) {
  if (!clinicLinkState?.isClinicViewer) return '';
  if (!profissional?.ownerUserId) return '';

  const status = clinicLinkState.status || 'NONE';
  const profileId = encodeURIComponent(profissional.id);

  if (status === 'PENDING') {
    return `<div class="profile-request-action" data-profile-clinic-link-state>${renderProfileRequestState('Solicitação pendente', 'pending')}</div>`;
  }

  if (status === 'ACCEPTED') {
    return `<div class="profile-request-action" data-profile-clinic-link-state>${renderProfileRequestState('Vínculo ativo', 'active')}</div>`;
  }

  return `
    <div class="profile-request-action" data-profile-clinic-link-state>
      <button type="button" class="btn btn-primary" data-request-profile-clinic-link="${profileId}">
        Solicitar vínculo com a clínica
      </button>
      <span class="form-hint" data-profile-clinic-link-message aria-live="polite"></span>
    </div>
  `;
}

function renderPhysioProfileMarkup(profissional, isOwner, showClaimButton, clinicLinkState = null) {
  const specialties = getProfileSpecialties(profissional);
  const specialtiesText = specialties.length ? specialties.join(' • ') : '-';
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
        ${profissional.isClaimed ? '<span class="profile-badge">Perfil reivindicado</span>' : '<span class="profile-badge">Perfil não reivindicado</span>'}
      </div>

      <section class="profile-section">
        <h3>Sobre</h3>
        <p>${escapeHtml(profissional.descricao || 'Esse profissional ainda não adicionou uma descrição.')}</p>
      </section>

      ${isOwner ? renderLeadSummaryCard() : ''}
      ${renderLinkedClinics(profissional.linkedClinics)}

      <section class="profile-section">
        <h3>Contato</h3>
        <div class="profile-contact-list">
          <p><strong>E-mail:</strong> ${escapeHtml(profissional.email || '-')}</p>
          <p><strong>Telefone:</strong> ${escapeHtml(profissional.telefone || '-')}</p>
          <p><strong>Bairro:</strong> ${escapeHtml(profissional.bairro || '-')}</p>
        </div>

        <div class="profile-actions">
          ${!isOwner && profissional.telefone ? `<a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" data-lead-type="WHATSAPP_CLICK">Falar no WhatsApp</a>` : ''}
          ${profissional.instagram ? `<a href="${escapeHtml(profissional.instagram)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" data-lead-type="INSTAGRAM_CLICK">Instagram</a>` : ''}
          ${profissional.linkedin ? `<a href="${escapeHtml(profissional.linkedin)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" data-lead-type="LINKEDIN_CLICK">LinkedIn</a>` : ''}
          ${renderClinicLinkRequestCta(profissional, clinicLinkState)}
          ${isOwner ? '<a href="editar-perfil.html" class="btn btn-secondary">Editar perfil</a>' : ''}
          ${showClaimButton ? `<a href="claim-profile.html?id=${encodeURIComponent(profissional.id)}" class="btn btn-outline">Reivindicar perfil</a>` : ''}
          <a href="buscar.html" class="btn btn-secondary">Voltar</a>
          ${showClaimButton ? '<p class="claim-profile-warning">Esse perfil é seu? Reivindique para atualizar as informações.</p>' : ''}
        </div>
      </section>
    </article>

    ${renderProfileGallerySection(profissional)}
    ${renderReviewsDrawer(profissional, isOwner)}
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

async function getClinicLinkStateForProfile(loggedUser, profileId) {
  if (loggedUser?.accountType !== 'clinic' || !window.physioApi?.fetchMyClinicPhysioLinks) {
    return { isClinicViewer: false, status: null };
  }

  try {
    const links = await window.physioApi.fetchMyClinicPhysioLinks();
    const link = links.find((item) => item?.profile?.id === profileId);
    const status = link?.status === 'REJECTED' ? 'NONE' : (link?.status || 'NONE');
    return {
      isClinicViewer: true,
      status,
      link,
    };
  } catch (error) {
    console.warn('Could not load clinic link state for profile:', error);
    return { isClinicViewer: true, status: 'NONE' };
  }
}

async function getPhysioLinkStateForClinic(loggedUser, clinicId) {
  if (loggedUser?.accountType !== 'physio' || !window.physioApi?.fetchMyPhysioClinicLinkRequests) {
    return { isPhysioViewer: false, status: null };
  }

  const resolvedProfile = loggedUser?.profile?.id
    ? loggedUser.profile
    : await resolvePhysioProfileForSession(loggedUser);

  if (!resolvedProfile?.id) {
    return { isPhysioViewer: true, status: 'NONE' };
  }

  try {
    const links = await window.physioApi.fetchMyPhysioClinicLinkRequests();
    const link = links.find((item) => item?.clinic?.id === clinicId || item?.clinicProfileId === clinicId);
    const status = link?.status === 'REJECTED' ? 'NONE' : (link?.status || 'NONE');
    return {
      isPhysioViewer: true,
      status,
      link,
    };
  } catch (error) {
    console.warn('Could not load physio clinic link state for clinic:', error);
    return { isPhysioViewer: true, status: 'NONE' };
  }
}

function setupProfileClinicLinkRequest() {
  const button = document.querySelector('[data-request-profile-clinic-link]');
  const stateContainer = document.querySelector('[data-profile-clinic-link-state]');
  const message = document.querySelector('[data-profile-clinic-link-message]');
  if (!button || !window.physioApi?.requestClinicPhysioLink) return;

  button.addEventListener('click', async () => {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Enviando...';
    if (message) {
      message.textContent = '';
      message.style.color = '';
    }

    try {
      const response = await window.physioApi.requestClinicPhysioLink({
        profileId: button.dataset.requestProfileClinicLink,
      });

      const status = response?.status || response?.link?.status || 'PENDING';
      if (message) {
        message.textContent = '';
        message.style.color = '';
      }
      if (stateContainer) {
        stateContainer.innerHTML = status === 'ACCEPTED'
          ? renderProfileRequestState('Vínculo ativo', 'active')
          : renderProfileRequestState('Solicitação pendente', 'pending');
      }
      showProfileToast(
        status === 'ACCEPTED'
          ? 'Este fisioterapeuta já está vinculado à sua clínica.'
          : 'Solicitação enviada ao fisioterapeuta.'
      );

      if (window.renderAuthArea) await window.renderAuthArea();
    } catch (error) {
      if (error?.status === 409) {
        const backendMessage = String(error?.message || '');
        if (/pendente/i.test(backendMessage)) {
          if (message) {
            message.textContent = '';
            message.style.color = '';
          }
          if (stateContainer) {
            stateContainer.innerHTML = renderProfileRequestState('Solicitação pendente', 'pending');
          }
          showProfileToast('Já existe uma solicitação pendente para este fisioterapeuta.', 'info');
          return;
        }

        if (/vinculado/i.test(backendMessage)) {
          if (message) {
            message.textContent = '';
            message.style.color = '';
          }
          if (stateContainer) {
            stateContainer.innerHTML = renderProfileRequestState('Vínculo ativo', 'active');
          }
          showProfileToast('Este fisioterapeuta já está vinculado à sua clínica.', 'info');
          return;
        }
      }

      button.disabled = false;
      button.textContent = originalLabel;
      if (message) {
        message.textContent = "NÃ£o foi possÃ­vel enviar sua avaliaÃ§Ã£o agora. Tente novamente em alguns instantes.";
        message.style.color = '#b91c1c';
      }
      console.error('Profile clinic link request failed:', error);
    }
  });
}

function setupClinicProfileLinkRequest() {
  const button = document.querySelector('[data-request-clinic-link]');
  const stateContainer = document.querySelector('[data-clinic-link-state]');
  const message = document.querySelector('[data-clinic-link-request-message]');
  if (!button || !window.physioApi?.createClinicLinkRequest) return;

  button.addEventListener('click', async () => {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Enviando...';
    if (message) {
      message.textContent = '';
      message.style.color = '';
    }

    try {
      const loggedUser = await (window.getLoggedUser ? window.getLoggedUser(true) : Promise.resolve(null));
      await window.physioApi.createClinicLinkRequest({
        clinicProfileId: button.dataset.requestClinicLink,
        clinicId: button.dataset.requestClinicLink,
        physioProfileId: loggedUser?.profile?.id || null,
        requesterUserId: loggedUser?.id || null,
      });

      if (message) {
        message.textContent = '';
        message.style.color = '';
      }
      if (stateContainer) {
        stateContainer.innerHTML = renderProfileRequestState('Solicitação pendente', 'pending');
      }
      showProfileToast('Vínculo solicitado com sucesso, caso aceito ou negado será notificado');

      if (window.renderAuthArea) await window.renderAuthArea();
    } catch (error) {
      const duplicateStatus = error?.data?.link?.status || null;
      if (error?.status === 409 && duplicateStatus === 'PENDING') {
        if (message) {
          message.textContent = '';
          message.style.color = '';
        }
        if (stateContainer) {
          stateContainer.innerHTML = renderProfileRequestState('Solicitação pendente', 'pending');
        }
        showProfileToast('Você já solicitou vínculo com esta clínica.', 'info');
        return;
      }

      if (error?.status === 409 && duplicateStatus === 'ACCEPTED') {
        if (message) {
          message.textContent = '';
          message.style.color = '';
        }
        if (stateContainer) {
          stateContainer.innerHTML = renderProfileRequestState('Vínculo ativo', 'active');
        }
        showProfileToast('Vínculo ativo', 'info');
        return;
      }

      button.disabled = false;
      button.textContent = originalLabel;
      if (message) {
        message.textContent = "NÃ£o foi possÃ­vel enviar sua avaliaÃ§Ã£o agora. Tente novamente em alguns instantes.";
        message.style.color = '#b91c1c';
      }
      console.error('Clinic profile link request failed:', error);
    }
  });
}

async function refreshProfileReviews(profileId, isOwner) {
  const list = document.querySelector('[data-profile-reviews-list]');
  if (!list) return;

  try {
    const reviews = isOwner
      ? (await window.physioApi.fetchMyReviews()).reviews || []
      : await window.physioApi.fetchProfileReviews(profileId);

    if (!reviews.length) {
      list.innerHTML = `
        <div class="profile-reviews-empty">
          <p>Nenhuma avaliação publicada no momento.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = reviews
      .map((review) =>
        renderReviewCard(review, {
          isOwner,
          showStatus: isOwner,
        })
      )
      .join('');

    setupReviewReportButtons(profileId, isOwner);
  } catch (error) {
    console.error('Could not load profile reviews:', error);
    list.innerHTML = `
      <div class="profile-reviews-empty">
        <p>Não foi possível carregar as avaliações agora.</p>
      </div>
    `;
  }
}

function openReviewReportModal({ reviewId, onSubmit }) {
  const existingModal = document.querySelector('[data-review-report-modal]');
  existingModal?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'notification-review-modal';
  overlay.setAttribute('data-review-report-modal', 'true');
  overlay.innerHTML = `
    <div class="notification-review-modal__backdrop" data-review-report-close></div>
    <div class="notification-review-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="reviewReportTitle">
      <button type="button" class="notification-review-modal__close" aria-label="Fechar" data-review-report-close>&times;</button>
      <div class="notification-review-modal__content">
        <div class="notification-review-modal__header">
          <span class="eyebrow">ModeraÃ§Ã£o</span>
          <h3 id="reviewReportTitle">Reportar review</h3>
          <p>Explique por que esta avaliaÃ§Ã£o precisa de revisÃ£o da equipe do PhysioPipeline.</p>
        </div>
        <label class="profile-review-form__field">
          <span>Motivo do reporte</span>
          <textarea data-review-report-reason rows="5" maxlength="1000" placeholder="Descreva o motivo do reporte." required></textarea>
        </label>
        <p class="form-hint" data-review-report-message aria-live="polite"></p>
        <div class="notification-review-modal__actions">
          <button type="button" class="btn btn-outline" data-review-report-close>Cancelar</button>
          <button type="button" class="btn btn-primary" data-review-report-submit>Enviar reporte</button>
        </div>
      </div>
    </div>
  `;

  function closeModal() {
    overlay.remove();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-review-report-close]')) {
      closeModal();
    }
  });

  const submitButton = overlay.querySelector('[data-review-report-submit]');
  const reasonField = overlay.querySelector('[data-review-report-reason]');
  const messageField = overlay.querySelector('[data-review-report-message]');

  submitButton.addEventListener('click', async () => {
    const reason = String(reasonField.value || '').trim();
    if (!reason) {
      messageField.textContent = 'Informe o motivo do reporte.';
      messageField.style.color = '#b91c1c';
      reasonField.focus();
      return;
    }

    submitButton.disabled = true;
    reasonField.disabled = true;
    messageField.textContent = '';

    try {
      await onSubmit(reason);
      closeModal();
    } catch (error) {
      console.error('Could not report review:', error);
      messageField.textContent = error?.message || 'Não foi possível enviar o reporte agora. Tente novamente em alguns instantes.';
      messageField.style.color = '#b91c1c';
      submitButton.disabled = false;
      reasonField.disabled = false;
    }
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => reasonField.focus());
}

function setupReviewReportButtons(profileId, isOwner) {
  if (!isOwner || !window.physioApi?.reportProfileReview) return;

  document.querySelectorAll('[data-report-review]').forEach((button) => {
    if (button.dataset.reportBound === 'true') return;
    button.dataset.reportBound = 'true';

    button.addEventListener('click', async () => {
      openReviewReportModal({
        reviewId: button.dataset.reportReview,
        onSubmit: async (reason) => {
          const originalLabel = button.textContent;
          button.disabled = true;
          button.textContent = 'Reportando...';

          try {
            console.log('Profile review report request', {
              reviewId: button.dataset.reportReview,
              reasonLength: reason.length,
            });
            const response = await window.physioApi.reportProfileReview(button.dataset.reportReview, reason);
            showProfileToast(
              response?.message || 'Reporte enviado com sucesso. Obrigado por ajudar na moderação.',
              response?.emailSent === false ? 'info' : 'success'
            );
            await refreshProfileReviews(profileId, true);
          } catch (error) {
            console.error('Profile review report request failed:', {
              reviewId: button.dataset.reportReview,
              status: error?.status,
              message: error?.message,
              data: error?.data,
              responseText: error?.responseText,
            });
            throw error;
          } finally {
            button.disabled = false;
            button.textContent = originalLabel;
          }
        },
      });
    });
  });
}

function setupReviewsDrawer() {
  const toggleButton = document.querySelector('[data-profile-reviews-toggle]');
  const drawer = document.querySelector('[data-profile-reviews-drawer]');
  const toggleText = document.querySelector('[data-profile-reviews-toggle-text]');
  const toggleIcon = document.querySelector('[data-profile-reviews-toggle-icon]');
  if (!toggleButton || !drawer) return;

  let closeTimer = null;

  function setDrawerOpen(isOpen) {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    toggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggleButton.classList.toggle('is-open', isOpen);
    toggleText.textContent = 'Avaliações';
    toggleIcon.textContent = isOpen ? '−' : '+';

    if (isOpen) {
      drawer.hidden = false;
      requestAnimationFrame(() => {
        drawer.classList.add('is-open');
      });
      return;
    }

    drawer.classList.remove('is-open');
    closeTimer = setTimeout(() => {
      drawer.hidden = true;
    }, 220);
  }

  toggleButton.addEventListener('click', () => {
    toggleButton.classList.remove('is-pressed');
    void toggleButton.offsetWidth;
    toggleButton.classList.add('is-pressed');

    const isOpen = toggleButton.getAttribute('aria-expanded') === 'true';
    setDrawerOpen(!isOpen);
  });
}

function setupReviewForm(profileId, isOwner) {
  if (isOwner || !window.physioApi?.submitProfileReview) return;

  const toggleButton = document.querySelector('[data-profile-review-toggle]');
  const formPanel = document.querySelector('[data-profile-review-form-panel]');
  const form = document.querySelector('[data-profile-review-form]');
  const message = document.querySelector('[data-profile-review-message]');
  const toggleText = toggleButton?.querySelector('.profile-review-toggle__text');
  if (!toggleButton || !formPanel || !form) return;

  let closeTimer = null;

  function setReviewFormOpen(isOpen) {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    toggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    toggleButton.classList.toggle('is-open', isOpen);
    if (toggleText) {
      toggleText.textContent = isOpen ? 'Cancelar avaliação' : '+ Avaliar';
    } else {
      toggleButton.textContent = isOpen ? 'Cancelar avaliação' : '+ Avaliar';
    }

    if (isOpen) {
      formPanel.hidden = false;
      requestAnimationFrame(() => {
        formPanel.classList.add('is-open');
      });
      requestAnimationFrame(() => {
        const firstInput = form.querySelector('input[name="authorName"]');
        firstInput?.focus();
      });
      return;
    }

    formPanel.classList.remove('is-open');
    closeTimer = setTimeout(() => {
      formPanel.hidden = true;
    }, 220);
  }

  toggleButton.addEventListener('click', () => {
    toggleButton.classList.remove('is-pressed');
    void toggleButton.offsetWidth;
    toggleButton.classList.add('is-pressed');

    const isOpen = toggleButton.getAttribute('aria-expanded') === 'true';
    setReviewFormOpen(!isOpen);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Enviando...';
    }

    if (message) {
      message.textContent = '';
      message.style.color = '';
    }

    try {
      const response = await window.physioApi.submitProfileReview({
        profileId,
        authorName: String(formData.get('authorName') || '').trim(),
        authorEmail: String(formData.get('authorEmail') || '').trim(),
        title: String(formData.get('title') || '').trim(),
        rating: Number(formData.get('rating') || 0),
        body: String(formData.get('body') || '').trim(),
      });

      form.reset();
      const moderationStatus = String(response?.moderation?.status || response?.review?.status || '').toLowerCase();
      const successMessage = moderationStatus === 'pending_owner'
        ? 'Sua avaliaÃ§Ã£o foi enviada ao profissional e ficarÃ¡ visÃ­vel apÃ³s aprovaÃ§Ã£o.'
        : moderationStatus === 'pending_admin'
          ? 'Sua avaliaÃ§Ã£o foi enviada para anÃ¡lise e ficarÃ¡ visÃ­vel apÃ³s aprovaÃ§Ã£o.'
          : 'Sua avaliaÃ§Ã£o foi enviada com sucesso.';

      if (message) {
        message.textContent = successMessage;
        message.style.color = '#166534';
      }
      showProfileToast(successMessage);
      await refreshProfileReviews(profileId, false);
      setReviewFormOpen(false);
    } catch (error) {
      console.error('Could not submit review:', error);
      if (message) {
        message.textContent = "NÃ£o foi possÃ­vel enviar sua avaliaÃ§Ã£o agora. Tente novamente em alguns instantes.";
        message.style.color = '#b91c1c';
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar avaliação';
      }
    }
  });
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
      const physioClinicLinkState = !isClinicOwner
        ? await getPhysioLinkStateForClinic(loggedUser, clinic.id)
        : { isPhysioViewer: false, status: null };
      profileContainer.innerHTML = renderClinicProfileMarkup(clinic, isClinicOwner, showClinicClaimButton, physioClinicLinkState);
      setupClinicProfileLinkRequest();
      setupImageModal();
      return;
    }

    const profissional = await window.physioApi.fetchProfile(profileId);
    if (!profissional) throw new Error('Esse perfil não existe ou não pode ser carregado.');

    const linkedProfileId = loggedUser?.profile?.id || null;
    const loggedUserId = loggedUser?.id || null;
    const isOwner =
      linkedProfileId === profissional.id ||
      (Boolean(loggedUserId) &&
        [profissional.ownerUserId, profissional.userId, profissional.ownerId]
          .filter(Boolean)
          .includes(loggedUserId));
    const showClaimButton = !isOwner && !profissional.isClaimed;
    const clinicLinkState = !isOwner
      ? await getClinicLinkStateForProfile(loggedUser, profissional.id)
      : { isClinicViewer: false };

    if (!isOwner) {
      recordProfileLeadEvent(profissional, 'PROFILE_VIEW');
    }

    profileContainer.innerHTML = renderPhysioProfileMarkup(profissional, isOwner, showClaimButton, clinicLinkState);
    setupProfileClinicLinkRequest();
    setupReviewsDrawer();
    setupReviewForm(profissional.id, isOwner);
    await refreshProfileReviews(profissional.id, isOwner);

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





