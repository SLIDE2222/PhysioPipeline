const myReviewsList = document.getElementById('myReviewsList');
const myReviewsMessage = document.getElementById('myReviewsMessage');

function escapeMyReviewsHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getMyReviewStatusMeta(status) {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  switch (normalizedStatus) {
    case 'published':
      return { label: 'Publicada', tone: 'published' };
    case 'reported':
      return { label: 'Reportada', tone: 'reported' };
    case 'rejected':
      return { label: 'Removida', tone: 'rejected' };
    default:
      return { label: 'Pendente', tone: 'pending' };
  }
}

function setMyReviewsMessage(message, tone = 'success') {
  if (!myReviewsMessage) return;
  myReviewsMessage.textContent = message || '';
  myReviewsMessage.style.color = tone === 'success' ? '#166534' : '#b91c1c';
}

function renderOwnerReviewCard(review) {
  const statusMeta = getMyReviewStatusMeta(review?.status);
  const canReport = ['published', 'reported'].includes(String(review?.status || '').toLowerCase());
  const reviewDate = review?.createdAt
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(review.createdAt))
    : 'Agora';
  const rating = Number(review?.rating || 0);

  return `
    <article class="profile-review-card" data-owner-review-id="${escapeMyReviewsHtml(review.id)}">
      <div class="profile-review-card__header">
        <div>
          <strong>${escapeMyReviewsHtml(review.authorName || 'Paciente')}</strong>
          ${review.title ? `<p class="profile-review-card__title">${escapeMyReviewsHtml(review.title)}</p>` : ''}
        </div>
        <span class="review-status-badge review-status-badge--${escapeMyReviewsHtml(statusMeta.tone)}">${escapeMyReviewsHtml(statusMeta.label)}</span>
      </div>
      <div class="profile-review-card__footer">
        <span>${escapeMyReviewsHtml(reviewDate)}</span>
        ${rating > 0 ? `<span>${'★'.repeat(Math.min(rating, 5))}</span>` : ''}
      </div>
      <p class="profile-review-card__body">${escapeMyReviewsHtml(review.body || '')}</p>
      <div class="profile-review-card__footer">
        <span>${escapeMyReviewsHtml(review.authorEmail || '')}</span>
        ${canReport ? `<button type="button" class="btn btn-outline btn-small" data-owner-report-review="${escapeMyReviewsHtml(review.id)}">${String(review.status || '').toLowerCase() === 'reported' ? 'Atualizar reporte' : 'Reportar review'}</button>` : ''}
      </div>
      ${review.reportReason ? `<p class="profile-review-card__report-reason"><strong>Motivo do reporte:</strong> ${escapeMyReviewsHtml(review.reportReason)}</p>` : ''}
    </article>
  `;
}

async function loadMyReviews() {
  if (!myReviewsList || !window.physioApi?.fetchMyReviews) return;

  try {
    const response = await window.physioApi.fetchMyReviews();
    const reviews = Array.isArray(response?.reviews) ? response.reviews : [];

    myReviewsList.innerHTML = reviews.length
      ? reviews.map(renderOwnerReviewCard).join('')
      : '<div class="profile-reviews-empty"><p>Você ainda não possui avaliações.</p></div>';
  } catch (error) {
    console.error('My reviews load failed:', error);
    myReviewsList.innerHTML = '<div class="profile-reviews-empty"><p>Não foi possível carregar suas avaliações agora.</p></div>';
  }
}

document.addEventListener('click', async (event) => {
  const reportButton = event.target.closest('[data-owner-report-review]');
  if (!reportButton) return;

  const reason = window.prompt('Descreva o motivo do reporte para a equipe de moderação:');
  if (!reason || !reason.trim()) return;

  reportButton.disabled = true;
  setMyReviewsMessage('');

  try {
    await window.physioApi.reportProfileReview(reportButton.dataset.ownerReportReview, reason.trim());
    setMyReviewsMessage('Review reportada para análise administrativa.');
    await loadMyReviews();
  } catch (error) {
    console.error('My review report failed:', error);
    setMyReviewsMessage(error?.message || 'Não foi possível reportar esta review.', 'error');
  } finally {
    reportButton.disabled = false;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const loggedUser = await (window.getLoggedUser ? window.getLoggedUser(true) : Promise.resolve(null));

  if (!loggedUser) {
    window.location.replace('login.html');
    return;
  }

  if (loggedUser?.accountType === 'clinic') {
    window.location.replace('clinic-dashboard.html');
    return;
  }

  await loadMyReviews();
});
