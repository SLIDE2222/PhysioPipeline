(function () {
  const DISMISSED_NOTIFICATIONS_STORAGE_KEY = 'physioDismissedNotifications:v2';
  const notificationDetailsById = new Map();
  const dismissedNotificationIds = new Set();
  let activeNotificationModal = null;
  let currentUserContext = null;

  try {
    const storedDismissedNotifications = JSON.parse(
      sessionStorage.getItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY) || '[]'
    );

    if (Array.isArray(storedDismissedNotifications)) {
      storedDismissedNotifications.forEach((notificationId) => {
        if (notificationId) dismissedNotificationIds.add(String(notificationId));
      });
    }
  } catch (_) {
    // ignore storage hydration issues
  }

  function persistDismissedNotificationIds() {
    try {
      sessionStorage.setItem(
        DISMISSED_NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(Array.from(dismissedNotificationIds))
      );
    } catch (_) {
      // ignore storage write issues
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNotificationDate(value) {
    if (!value) return '';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(parsed);
  }

  function isClinicLinkRequestNotification(notification) {
    const title = String(notification?.title || '').toLowerCase();
    const message = String(notification?.message || '').toLowerCase();

    return notification?.type === 'clinic_link_request' ||
      title.includes('solicitação de vínculo') ||
      title.includes('solicitacao de vinculo') ||
      message.includes('solicitou vínculo') ||
      message.includes('solicitou vinculo');
  }

  function normalizeNotificationStatus(notification) {
    return String(
      notification?.status ||
      notification?.requestStatus ||
      notification?.notificationStatus ||
      ''
    ).trim().toUpperCase();
  }

  function isPendingReviewNotification(notification) {
    const type = String(notification?.type || '').toLowerCase();
    const title = String(notification?.title || '').toLowerCase();
    return type === 'review_pending_owner' ||
      title.includes('nova avaliaÃ§Ã£o pendente') ||
      title.includes('nova avaliacao pendente');
  }

  function canDeleteNotification(notification) {
    if (!notification) return false;
    if (isPendingReviewNotification(notification)) return false;
    if (!isClinicLinkRequestNotification(notification)) return true;

    const status = normalizeNotificationStatus(notification);
    return status !== 'PENDING' && status !== 'REJECTED' && status !== 'DECLINED' && status !== 'REFUSED';
  }

  function getClinicLinkNotificationLinkId(notification) {
    return notification?.relatedRequestId ||
      notification?.clinicLinkRequestId ||
      notification?.linkId ||
      notification?.id ||
      null;
  }

  function getClinicLinkNotificationPhysioId(notification) {
    return notification?.relatedPhysioId ||
      notification?.physioProfileId ||
      notification?.requesterProfileId ||
      notification?.profileId ||
      null;
  }

  function getClinicLinkNotificationClinicId(notification) {
    return notification?.relatedClinicId ||
      notification?.clinicProfileId ||
      notification?.clinicId ||
      null;
  }

  function isClinicAccountUser(user) {
    return Boolean(
      user?.accountType === 'clinic' ||
      user?.clinicProfile?.id ||
      user?.clinicProfileId
    );
  }

  function normalizeClinicLinkNotificationDetails(notification, detailData = null, profileData = null) {
    const physio = detailData?.physio || null;
    const fallbackProfile = profileData || null;
    const clinic = detailData?.clinic || null;

    return {
      ...notification,
      relatedRequestId: getClinicLinkNotificationLinkId(notification),
      relatedPhysioId: getClinicLinkNotificationPhysioId(notification),
      relatedClinicId: getClinicLinkNotificationClinicId(notification),
      requesterName: notification?.requesterName || physio?.name || fallbackProfile?.nome || 'Fisioterapeuta',
      requesterCity: notification?.requesterCity || physio?.city || fallbackProfile?.cidade || '',
      requesterNeighborhood: notification?.requesterNeighborhood || physio?.neighborhood || fallbackProfile?.bairro || '',
      requesterSpecialty: notification?.requesterSpecialty || physio?.specialty || fallbackProfile?.especialidade || '',
      requesterBio: notification?.requesterBio || physio?.bio || fallbackProfile?.descricao || '',
      requesterAvatarUrl: notification?.requesterAvatarUrl || physio?.avatarUrl || fallbackProfile?.foto || '',
      clinicName: notification?.clinicName || clinic?.clinicName || 'Clínica',
      clinicCity: notification?.clinicCity || clinic?.city || '',
      clinicNeighborhood: notification?.clinicNeighborhood || clinic?.neighborhood || '',
      clinicPhone: notification?.clinicPhone || clinic?.phone || '',
      clinicWhatsapp: notification?.clinicWhatsapp || clinic?.whatsapp || '',
      clinicAddress: notification?.clinicAddress || clinic?.address || '',
      clinicResponsibleName: notification?.clinicResponsibleName || clinic?.responsibleName || '',
      clinicLogoUrl: notification?.clinicLogoUrl || clinic?.logoUrl || '',
      requestMessage: notification?.requestMessage || detailData?.message || notification?.message || '',
    };
  }

  async function loadClinicLinkNotificationDetails(notification) {
    let detailData = null;
    const requestId = getClinicLinkNotificationLinkId(notification);
    const physioId = getClinicLinkNotificationPhysioId(notification);

    if (requestId && window.physioApi?.fetchClinicLinkRequest) {
      try {
        detailData = await window.physioApi.fetchClinicLinkRequest(requestId);
      } catch (error) {
        console.warn('Could not load clinic link request details:', error);
      }
    }

    if (!detailData && window.physioApi?.fetchPendingClinicLinkRequestForClinic) {
      try {
        detailData = await window.physioApi.fetchPendingClinicLinkRequestForClinic();
      } catch (error) {
        console.warn('Could not load pending clinic link request fallback:', error);
      }
    }

    let profileData = null;
    const fallbackPhysioId = detailData?.physioProfileId || physioId;
    if (fallbackPhysioId && window.physioApi?.fetchProfile) {
      try {
        profileData = await window.physioApi.fetchProfile(fallbackPhysioId);
      } catch (error) {
        console.warn('Could not load physiotherapist profile fallback for notification:', error);
      }
    }

    const fallbackClinicId = detailData?.clinicId || getClinicLinkNotificationClinicId(notification);
    if ((!detailData?.clinic || !detailData?.clinic?.clinicName) && fallbackClinicId && window.physioApi?.fetchClinic) {
      try {
        const clinicProfile = await window.physioApi.fetchClinic(fallbackClinicId);
        detailData = {
          ...detailData,
          clinic: detailData?.clinic || clinicProfile,
        };
      } catch (error) {
        console.warn('Could not load clinic fallback for notification:', error);
      }
    }

    return normalizeClinicLinkNotificationDetails(notification, detailData, profileData);
  }

  function renderNotificationIcon(unreadCount = 0) {
    const safeCount = Math.max(0, Number(unreadCount || 0));
    const badgeText = safeCount > 9 ? '9+' : String(safeCount);

    return `
      <span class="notification-menu__mark${safeCount > 0 ? ' has-unread' : ''}" aria-hidden="true">
        <svg class="notification-menu__p-icon" viewBox="0 0 76 82" focusable="false">
          <path class="notification-menu__p-curve" d="M12 31 C25 14 60 13 61 36 C62 57 35 62 23 50" />
          <path class="notification-menu__p-slash" d="M36 27 L18 69" />
          <circle class="notification-menu__p-dot" cx="44" cy="74" r="4.2" />
        </svg>
        ${safeCount > 0 ? `<strong class="notification-menu__badge">${badgeText}</strong>` : ''}
      </span>
    `;
  }

  function renderNotificationItem(notification) {
    const unreadClass = notification.unread ? ' is-unread' : '';
    const itemTitle = escapeHtml(notification.title || 'Notificação');
    const itemMessage = escapeHtml(notification.message || '');
    const allowDelete = canDeleteNotification(notification);

    return `
      <article
        class="notification-menu__item notification-item notification-card notification-card-clickable${unreadClass}"
        data-shared-notification-id="${escapeHtml(notification.id)}"
        data-shared-notification-open="true"
        tabindex="0"
        role="button"
        aria-label="${itemTitle}"
      >
        <span class="notification-menu__item-icon" aria-hidden="true">
          <svg class="notification-menu__item-p-icon" viewBox="0 0 76 82" focusable="false">
            <path class="notification-menu__p-curve" d="M12 31 C25 14 60 13 61 36 C62 57 35 62 23 50" />
            <path class="notification-menu__p-slash" d="M36 27 L18 69" />
            <circle class="notification-menu__p-dot" cx="44" cy="74" r="4.2" />
          </svg>
        </span>
        <div class="notification-menu__item-copy">
          <div class="notification-menu__item-topline">
            <strong>${itemTitle}</strong>
            ${allowDelete ? `
            <button
              type="button"
              class="notification-menu__delete"
              data-shared-notification-delete="${escapeHtml(notification.id)}"
              aria-label="Excluir notificação"
            >
              ×
            </button>
            ` : ''}
          </div>
          <p>${itemMessage}</p>
          <small>Clique para ver detalhes</small>
        </div>
      </article>
    `;
  }

  function dismissNotificationLocally(notificationId) {
    if (!notificationId) return;

    dismissedNotificationIds.add(String(notificationId));
    persistDismissedNotificationIds();
    notificationDetailsById.delete(String(notificationId));
  }

  async function rerenderAuthArea() {
    if (typeof window.renderAuthArea === 'function') {
      await window.renderAuthArea();
    }
  }

  function closeNotificationModal() {
    if (!activeNotificationModal) return;
    activeNotificationModal.remove();
    activeNotificationModal = null;
  }

  function createNotificationModalShell(titleId = 'notificationModalTitle') {
    closeNotificationModal();

    const overlay = document.createElement('div');
    overlay.className = 'notification-review-modal';
    overlay.innerHTML = `
      <div class="notification-review-modal__backdrop" data-notification-modal-close></div>
      <div class="notification-review-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(titleId)}">
        <button type="button" class="notification-review-modal__close" aria-label="Fechar" data-notification-modal-close>&times;</button>
        <div class="notification-review-modal__content"></div>
      </div>
    `;

    overlay.addEventListener('click', (event) => {
      if (event.target.closest('[data-notification-modal-close]')) {
        closeNotificationModal();
      }
    });

    document.body.appendChild(overlay);
    activeNotificationModal = overlay;
    return overlay;
  }

  function getNotificationRequesterProfileHref(notification) {
    const physioProfileId = getClinicLinkNotificationPhysioId(notification);
    return physioProfileId
      ? `profile.html?type=physio&id=${encodeURIComponent(physioProfileId)}`
      : 'profile.html';
  }

  async function dismissNotification(notificationId, { rerender = true } = {}) {
    if (!notificationId || !window.physioApi) return;
    let wasDismissed = false;

    try {
      if (window.physioApi.dismissNotification) {
        await window.physioApi.dismissNotification(notificationId);
      } else if (window.physioApi.markNotificationRead) {
        await window.physioApi.markNotificationRead(notificationId);
      }
      wasDismissed = true;
      return true;
    } catch (error) {
      if (error?.status === 409) {
        return false;
      }
      throw error;
    } finally {
      if (wasDismissed) {
        dismissNotificationLocally(notificationId);
      }
      if (wasDismissed && rerender) {
        await rerenderAuthArea();
      }
    }
  }

  function renderGenericNotificationModal(notification) {
    const overlay = createNotificationModalShell();
    const content = overlay.querySelector('.notification-review-modal__content');
    const formattedDate = formatNotificationDate(notification.createdAt || notification.updatedAt);
    const allowDelete = canDeleteNotification(notification);

    content.innerHTML = `
      <div class="notification-review-modal__header">
        <span class="eyebrow">NotificaÃ§Ã£o</span>
        <h3 id="notificationModalTitle">${escapeHtml(notification.title || 'NotificaÃ§Ã£o')}</h3>
        <p>${escapeHtml(notification.message || 'Sem detalhes adicionais.')}</p>
      </div>
      ${formattedDate ? `<p class="notification-review-modal__meta">Recebida em ${escapeHtml(formattedDate)}</p>` : ''}
      <div class="notification-review-modal__actions">
        ${isPendingReviewNotification(notification) ? '<a class="btn btn-primary" href="minhas-avaliacoes.html">Abrir minhas avaliaÃ§Ãµes</a>' : ''}
        <button type="button" class="btn btn-outline" data-notification-modal-close>Fechar</button>
        ${allowDelete ? `<button type="button" class="btn btn-secondary" data-notification-modal-delete="${escapeHtml(notification.id)}">Excluir notificaÃ§Ã£o</button>` : ''}
      </div>
    `;
  }

  function renderClinicLinkNotificationModal(notification) {
    const overlay = createNotificationModalShell('clinicLinkReviewTitle');
    const content = overlay.querySelector('.notification-review-modal__content');
    const profileHref = getNotificationRequesterProfileHref(notification);
    const requesterName = notification.requesterName || notification.profileName || 'Fisioterapeuta';
    const requesterCity = notification.requesterCity || 'Cidade não informada';
    const requesterNeighborhood = notification.requesterNeighborhood || 'Bairro não informado';
    const requesterSpecialty = notification.requesterSpecialty || 'Especialidade não informada';
    const requesterBio = notification.requesterBio || 'Este fisioterapeuta ainda não adicionou uma bio curta.';
    const requesterAvatarUrl = notification.requesterAvatarUrl || '';
    const formattedDate = formatNotificationDate(notification.createdAt || notification.updatedAt);
    const avatarMarkup = requesterAvatarUrl
      ? `<img src="${escapeHtml(requesterAvatarUrl)}" alt="${escapeHtml(requesterName)}" class="notification-review-modal__avatar" />`
      : `<div class="notification-review-modal__avatar notification-review-modal__avatar--fallback" aria-hidden="true">${escapeHtml(requesterName.charAt(0).toUpperCase())}</div>`;
    const canReviewRequest =
      isClinicAccountUser(currentUserContext) &&
      isClinicLinkRequestNotification(notification) &&
      notification.status === 'PENDING';

    content.innerHTML = `
      <div class="notification-review-modal__header">
        <span class="eyebrow">Solicitação de vínculo</span>
        <h3 id="clinicLinkReviewTitle">${escapeHtml(notification.title || 'Solicitação de vínculo')}</h3>
        <p>${escapeHtml(notification.message || `${requesterName} quer fazer parte da equipe desta clínica.`)}</p>
      </div>
      ${formattedDate ? `<p class="notification-review-modal__meta">Recebida em ${escapeHtml(formattedDate)}</p>` : ''}
      <div class="notification-review-modal__profile">
        ${avatarMarkup}
        <div class="notification-review-modal__profile-copy">
          <strong>${escapeHtml(requesterName)}</strong>
          <span>${escapeHtml(requesterCity)}${requesterNeighborhood ? ` • ${escapeHtml(requesterNeighborhood)}` : ''}</span>
          <span>${escapeHtml(requesterSpecialty)}</span>
        </div>
      </div>
      <p class="notification-review-modal__bio">${escapeHtml(requesterBio)}</p>
      <div class="notification-review-modal__actions">
        <a class="btn btn-outline" href="${escapeHtml(profileHref)}" target="_blank" rel="noreferrer">Ver perfil do fisioterapeuta</a>
        ${canReviewRequest ? `<button type="button" class="btn btn-primary" data-notification-modal-accept="${escapeHtml(notification.id)}">Aceitar vínculo</button>` : ''}
        ${canReviewRequest ? `<button type="button" class="btn btn-secondary" data-notification-modal-reject="${escapeHtml(notification.id)}">Recusar vínculo</button>` : ''}
        <button type="button" class="btn btn-outline" data-notification-modal-close>Fechar</button>
        <button type="button" class="btn btn-secondary" data-notification-modal-delete="${escapeHtml(notification.id)}">Excluir notificação</button>
      </div>
    `;
  }

  function renderClinicLinkNotificationModalV2(notification) {
    const overlay = createNotificationModalShell('clinicLinkReviewTitle');
    const content = overlay.querySelector('.notification-review-modal__content');
    const profileHref = getNotificationRequesterProfileHref(notification);
    const isClinicUser = isClinicAccountUser(currentUserContext);
    const requesterName = notification.requesterName || notification.profileName || 'Fisioterapeuta';
    const requesterCity = notification.requesterCity || 'Cidade não informada';
    const requesterNeighborhood = notification.requesterNeighborhood || 'Bairro não informado';
    const requesterSpecialty = notification.requesterSpecialty || 'Especialidade não informada';
    const requesterBio = notification.requesterBio || 'Este fisioterapeuta ainda não adicionou uma bio curta.';
    const requesterAvatarUrl = notification.requesterAvatarUrl || '';
    const clinicName = notification.clinicName || 'Clínica';
    const clinicCity = notification.clinicCity || 'Cidade não informada';
    const clinicNeighborhood = notification.clinicNeighborhood || 'Bairro não informado';
    const clinicPhone = notification.clinicPhone || '';
    const clinicWhatsapp = notification.clinicWhatsapp || '';
    const clinicAddress = notification.clinicAddress || '';
    const clinicResponsibleName = notification.clinicResponsibleName || '';
    const clinicLogoUrl = notification.clinicLogoUrl || '';
    const requestMessage = notification.requestMessage || notification.message || '';
    const formattedDate = formatNotificationDate(notification.createdAt || notification.updatedAt);
    const avatarMarkup = requesterAvatarUrl
      ? `<img src="${escapeHtml(requesterAvatarUrl)}" alt="${escapeHtml(requesterName)}" class="notification-review-modal__avatar" />`
      : `<div class="notification-review-modal__avatar notification-review-modal__avatar--fallback" aria-hidden="true">${escapeHtml(requesterName.charAt(0).toUpperCase())}</div>`;
    const clinicAvatarMarkup = clinicLogoUrl
      ? `<img src="${escapeHtml(clinicLogoUrl)}" alt="${escapeHtml(clinicName)}" class="notification-review-modal__avatar" />`
      : `<div class="notification-review-modal__avatar notification-review-modal__avatar--fallback" aria-hidden="true">${escapeHtml(clinicName.charAt(0).toUpperCase())}</div>`;
    const canReviewRequest =
      isClinicLinkRequestNotification(notification) &&
      notification.status === 'PENDING';
    const canClinicReviewRequest = canReviewRequest && isClinicUser;
    const canPhysioReviewRequest = canReviewRequest && !isClinicUser;

    if (canPhysioReviewRequest) {
      content.innerHTML = `
        <div class="notification-review-modal__header">
          <span class="eyebrow">Solicitação de vínculo</span>
          <h3 id="clinicLinkReviewTitle">${escapeHtml(notification.title || 'Solicitação de vínculo')}</h3>
          <p>${escapeHtml(requestMessage || `${clinicName} solicitou vínculo com seu perfil.`)}</p>
        </div>
        ${formattedDate ? `<p class="notification-review-modal__meta">Recebida em ${escapeHtml(formattedDate)}</p>` : ''}
        <div class="notification-review-modal__profile">
          ${clinicAvatarMarkup}
          <div class="notification-review-modal__profile-copy">
            <strong>${escapeHtml(clinicName)}</strong>
            <span>${escapeHtml(clinicCity)}${clinicNeighborhood ? ` • ${escapeHtml(clinicNeighborhood)}` : ''}</span>
            <span>${escapeHtml(clinicResponsibleName || 'Contato da clínica')}</span>
          </div>
        </div>
        <div class="notification-review-modal__bio">
          ${clinicPhone ? `<p><strong>Telefone:</strong> ${escapeHtml(clinicPhone)}</p>` : ''}
          ${clinicWhatsapp ? `<p><strong>WhatsApp:</strong> ${escapeHtml(clinicWhatsapp)}</p>` : ''}
          ${clinicAddress ? `<p><strong>Endereço:</strong> ${escapeHtml(clinicAddress)}</p>` : ''}
        </div>
        <div class="notification-review-modal__actions">
          <button type="button" class="btn btn-primary" data-notification-modal-accept="${escapeHtml(notification.id)}">Aceitar vínculo</button>
          <button type="button" class="btn btn-secondary" data-notification-modal-reject="${escapeHtml(notification.id)}">Recusar vínculo</button>
          <button type="button" class="btn btn-outline" data-notification-modal-close>Fechar</button>
          <button type="button" class="btn btn-secondary" data-notification-modal-delete="${escapeHtml(notification.id)}">Excluir notificação</button>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="notification-review-modal__header">
        <span class="eyebrow">Solicitação de vínculo</span>
        <h3 id="clinicLinkReviewTitle">${escapeHtml(notification.title || 'Solicitação de vínculo')}</h3>
        <p>${escapeHtml(notification.message || `${requesterName} quer fazer parte da equipe desta clínica.`)}</p>
      </div>
      ${formattedDate ? `<p class="notification-review-modal__meta">Recebida em ${escapeHtml(formattedDate)}</p>` : ''}
      <div class="notification-review-modal__profile">
        ${avatarMarkup}
        <div class="notification-review-modal__profile-copy">
          <strong>${escapeHtml(requesterName)}</strong>
          <span>${escapeHtml(requesterCity)}${requesterNeighborhood ? ` • ${escapeHtml(requesterNeighborhood)}` : ''}</span>
          <span>${escapeHtml(requesterSpecialty)}</span>
        </div>
      </div>
      <p class="notification-review-modal__bio">${escapeHtml(requesterBio)}</p>
      <div class="notification-review-modal__actions">
        <a class="btn btn-outline" href="${escapeHtml(profileHref)}" target="_blank" rel="noreferrer">Ver perfil do fisioterapeuta</a>
        ${canClinicReviewRequest ? `<button type="button" class="btn btn-primary" data-notification-modal-accept="${escapeHtml(notification.id)}">Aceitar vínculo</button>` : ''}
        ${canClinicReviewRequest ? `<button type="button" class="btn btn-secondary" data-notification-modal-reject="${escapeHtml(notification.id)}">Recusar vínculo</button>` : ''}
        <button type="button" class="btn btn-outline" data-notification-modal-close>Fechar</button>
        <button type="button" class="btn btn-secondary" data-notification-modal-delete="${escapeHtml(notification.id)}">Excluir notificação</button>
      </div>
    `;
  }

  function renderClinicLinkNotificationModalV3(notification) {
    const overlay = createNotificationModalShell('clinicLinkReviewTitle');
    const content = overlay.querySelector('.notification-review-modal__content');
    const profileHref = getNotificationRequesterProfileHref(notification);
    const isClinicUser = isClinicAccountUser(currentUserContext);
    const allowDelete = canDeleteNotification(notification);
    const requesterName = notification.requesterName || notification.profileName || 'Fisioterapeuta';
    const requesterCity = notification.requesterCity || 'Cidade não informada';
    const requesterNeighborhood = notification.requesterNeighborhood || 'Bairro não informado';
    const requesterSpecialty = notification.requesterSpecialty || 'Especialidade não informada';
    const requesterBio = notification.requesterBio || 'Este fisioterapeuta ainda não adicionou uma bio curta.';
    const requesterAvatarUrl = notification.requesterAvatarUrl || '';
    const clinicName = notification.clinicName || 'Clínica';
    const clinicCity = notification.clinicCity || 'Cidade não informada';
    const clinicNeighborhood = notification.clinicNeighborhood || 'Bairro não informado';
    const clinicPhone = notification.clinicPhone || '';
    const clinicWhatsapp = notification.clinicWhatsapp || '';
    const clinicAddress = notification.clinicAddress || '';
    const clinicResponsibleName = notification.clinicResponsibleName || '';
    const clinicLogoUrl = notification.clinicLogoUrl || '';
    const requestMessage = notification.requestMessage || notification.message || '';
    const formattedDate = formatNotificationDate(notification.createdAt || notification.updatedAt);
    const avatarMarkup = requesterAvatarUrl
      ? `<img src="${escapeHtml(requesterAvatarUrl)}" alt="${escapeHtml(requesterName)}" class="notification-review-modal__avatar" />`
      : `<div class="notification-review-modal__avatar notification-review-modal__avatar--fallback" aria-hidden="true">${escapeHtml(requesterName.charAt(0).toUpperCase())}</div>`;
    const clinicAvatarMarkup = clinicLogoUrl
      ? `<img src="${escapeHtml(clinicLogoUrl)}" alt="${escapeHtml(clinicName)}" class="notification-review-modal__avatar" />`
      : `<div class="notification-review-modal__avatar notification-review-modal__avatar--fallback" aria-hidden="true">${escapeHtml(clinicName.charAt(0).toUpperCase())}</div>`;
    const canReviewRequest =
      isClinicLinkRequestNotification(notification) &&
      notification.status === 'PENDING';
    const canClinicReviewRequest = canReviewRequest && isClinicUser;
    const canPhysioReviewRequest = canReviewRequest && !isClinicUser;

    if (canPhysioReviewRequest) {
      content.innerHTML = `
        <div class="notification-review-modal__header">
          <span class="eyebrow">Solicitação de vínculo</span>
          <h3 id="clinicLinkReviewTitle">${escapeHtml(notification.title || 'Solicitação de vínculo')}</h3>
          <p>${escapeHtml(requestMessage || `${clinicName} solicitou vínculo com seu perfil.`)}</p>
        </div>
        ${formattedDate ? `<p class="notification-review-modal__meta">Recebida em ${escapeHtml(formattedDate)}</p>` : ''}
        <div class="notification-review-modal__profile">
          ${clinicAvatarMarkup}
          <div class="notification-review-modal__profile-copy">
            <strong>${escapeHtml(clinicName)}</strong>
            <span>${escapeHtml(clinicCity)}${clinicNeighborhood ? ` • ${escapeHtml(clinicNeighborhood)}` : ''}</span>
            <span>${escapeHtml(clinicResponsibleName || 'Contato da clínica')}</span>
          </div>
        </div>
        <div class="notification-review-modal__bio">
          ${clinicPhone ? `<p><strong>Telefone:</strong> ${escapeHtml(clinicPhone)}</p>` : ''}
          ${clinicWhatsapp ? `<p><strong>WhatsApp:</strong> ${escapeHtml(clinicWhatsapp)}</p>` : ''}
          ${clinicAddress ? `<p><strong>Endereço:</strong> ${escapeHtml(clinicAddress)}</p>` : ''}
        </div>
        <div class="notification-review-modal__actions">
          <button type="button" class="btn btn-primary" data-notification-modal-accept="${escapeHtml(notification.id)}">Aceitar vínculo</button>
          <button type="button" class="btn btn-secondary" data-notification-modal-reject="${escapeHtml(notification.id)}">Recusar vínculo</button>
          <button type="button" class="btn btn-outline" data-notification-modal-close>Fechar</button>
          ${allowDelete ? `<button type="button" class="btn btn-secondary" data-notification-modal-delete="${escapeHtml(notification.id)}">Excluir notificação</button>` : ''}
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="notification-review-modal__header">
        <span class="eyebrow">Solicitação de vínculo</span>
        <h3 id="clinicLinkReviewTitle">${escapeHtml(notification.title || 'Solicitação de vínculo')}</h3>
        <p>${escapeHtml(notification.message || `${requesterName} quer fazer parte da equipe desta clínica.`)}</p>
      </div>
      ${formattedDate ? `<p class="notification-review-modal__meta">Recebida em ${escapeHtml(formattedDate)}</p>` : ''}
      <div class="notification-review-modal__profile">
        ${avatarMarkup}
        <div class="notification-review-modal__profile-copy">
          <strong>${escapeHtml(requesterName)}</strong>
          <span>${escapeHtml(requesterCity)}${requesterNeighborhood ? ` • ${escapeHtml(requesterNeighborhood)}` : ''}</span>
          <span>${escapeHtml(requesterSpecialty)}</span>
        </div>
      </div>
      <p class="notification-review-modal__bio">${escapeHtml(requesterBio)}</p>
      <div class="notification-review-modal__actions">
        <a class="btn btn-outline" href="${escapeHtml(profileHref)}" target="_blank" rel="noreferrer">Ver perfil do fisioterapeuta</a>
        ${canClinicReviewRequest ? `<button type="button" class="btn btn-primary" data-notification-modal-accept="${escapeHtml(notification.id)}">Aceitar vínculo</button>` : ''}
        ${canClinicReviewRequest ? `<button type="button" class="btn btn-secondary" data-notification-modal-reject="${escapeHtml(notification.id)}">Recusar vínculo</button>` : ''}
        <button type="button" class="btn btn-outline" data-notification-modal-close>Fechar</button>
        ${allowDelete ? `<button type="button" class="btn btn-secondary" data-notification-modal-delete="${escapeHtml(notification.id)}">Excluir notificação</button>` : ''}
      </div>
    `;
  }

  async function openNotificationModal(notificationId, item = null) {
    if (!notificationId) return;

    const notification = notificationDetailsById.get(String(notificationId)) || {
      id: String(notificationId),
      title: item?.querySelector('strong')?.textContent || 'Notificação',
      message: item?.querySelector('p')?.textContent || '',
    };

    console.log('notification clicked', notification);

    let hydratedNotification = notification;
    if (isClinicLinkRequestNotification(notification)) {
      try {
        hydratedNotification = await loadClinicLinkNotificationDetails(notification);
      } catch (error) {
        console.warn('Could not hydrate clinic link request notification:', error);
      }
      renderClinicLinkNotificationModalV3(hydratedNotification);
      return;
    }

    renderGenericNotificationModal(hydratedNotification);
  }

  async function handleNotificationDecision(notificationId, action) {
    if (!notificationId || !window.physioApi) return;

    if (action === 'accept') {
      await window.physioApi.acceptClinicLinkRequest(notificationId, {
        accountType: currentUserContext?.accountType,
      });
    } else {
      await window.physioApi.rejectClinicLinkRequest(notificationId, {
        accountType: currentUserContext?.accountType,
      });
    }

    await dismissNotification(notificationId, { rerender: false });
    closeNotificationModal();
    if (typeof window.closeNotificationMenus === 'function') {
      window.closeNotificationMenus();
    }
    await rerenderAuthArea();
  }

  function bindNotificationCardInteractions(root = document) {
    root.querySelectorAll('[data-shared-notification-open]').forEach((card) => {
      if (card.dataset.notificationCardBound === 'true') return;

      card.dataset.notificationCardBound = 'true';
      card.style.cursor = 'pointer';

      card.addEventListener('click', async (event) => {
        if (event.target.closest('[data-shared-notification-delete]')) return;
        event.preventDefault();
        event.stopPropagation();
        await openNotificationModal(card.dataset.sharedNotificationId, card);
      });

      card.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        await openNotificationModal(card.dataset.sharedNotificationId, card);
      });
    });
  }

  function setupGlobalEvents() {
    if (window.__physioNotificationsReady) return;
    window.__physioNotificationsReady = true;

    document.addEventListener('click', async (event) => {
      const deleteButton = event.target.closest('[data-shared-notification-delete]');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        await dismissNotification(deleteButton.dataset.sharedNotificationDelete);
        return;
      }

      const modalDeleteButton = event.target.closest('[data-notification-modal-delete]');
      if (modalDeleteButton) {
        event.preventDefault();
        event.stopPropagation();
        const dismissed = await dismissNotification(modalDeleteButton.dataset.notificationModalDelete, { rerender: false });
        if (dismissed) {
          closeNotificationModal();
          if (typeof window.closeNotificationMenus === 'function') {
            window.closeNotificationMenus();
          }
          await rerenderAuthArea();
        }
        return;
      }

      const acceptButton = event.target.closest('[data-notification-modal-accept]');
      if (acceptButton) {
        event.preventDefault();
        event.stopPropagation();
        await handleNotificationDecision(acceptButton.dataset.notificationModalAccept, 'accept');
        return;
      }

      const rejectButton = event.target.closest('[data-notification-modal-reject]');
      if (rejectButton) {
        event.preventDefault();
        event.stopPropagation();
        await handleNotificationDecision(rejectButton.dataset.notificationModalReject, 'reject');
      }
    });
  }

  async function buildNotificationMenu(user) {
    currentUserContext = user;

    try {
      const data = window.physioApi?.fetchNotifications
        ? await window.physioApi.fetchNotifications()
        : { notifications: [], unreadCount: 0 };
      const notifications = (Array.isArray(data?.notifications) ? data.notifications : [])
        .filter((notification) => notification?.id && !dismissedNotificationIds.has(String(notification.id)));

      notificationDetailsById.clear();
      notifications.forEach((notification) => {
        if (notification?.id) notificationDetailsById.set(String(notification.id), notification);
      });

      const unreadCount = notifications.filter((notification) => notification?.unread !== false).length;
      const panelContent = notifications.length
        ? notifications.map((item) => renderNotificationItem(item)).join('')
        : '<p class="notification-menu__empty">Nenhuma notificação no momento.</p>';

      return `
        <div class="notification-menu" data-notification-menu>
          <button
            class="notification-menu__button"
            type="button"
            aria-label="Notifications"
            aria-expanded="false"
            data-notification-toggle
          >
            ${renderNotificationIcon(unreadCount)}
          </button>
          <div class="notification-menu__panel" role="menu" data-notification-panel hidden>
            <h3>Notificações</h3>
            ${panelContent}
          </div>
        </div>
      `;
    } catch (error) {
      console.warn('Could not load notifications:', error);
      return `
        <div class="notification-menu" data-notification-menu>
          <button
            class="notification-menu__button"
            type="button"
            aria-label="Notifications"
            aria-expanded="false"
            data-notification-toggle
          >
            ${renderNotificationIcon(0)}
          </button>
          <div class="notification-menu__panel" role="menu" data-notification-panel hidden>
            <h3>Notificações</h3>
            <p class="notification-menu__empty">Nenhuma notificação no momento.</p>
          </div>
        </div>
      `;
    }
  }

  window.PhysioNotifications = {
    buildNotificationMenu,
    bindNotificationCardInteractions,
    setupGlobalEvents,
    dismissNotificationLocally,
    isClinicLinkRequestNotification,
    openNotificationModal,
  };
})();
