const adminPendingReviewsList = document.getElementById("adminPendingReviewsList");
const adminReportedReviewsList = document.getElementById("adminReportedReviewsList");
const adminReviewsMessage = document.getElementById("adminReviewsMessage");

function escapeAdminReviewHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAdminReviewStatusMeta(status) {
  const normalizedStatus = String(status || "").trim().toLowerCase();

  switch (normalizedStatus) {
    case "approved":
    case "published":
      return { label: "Publicada", tone: "published" };
    case "reported":
      return { label: "Reportada", tone: "reported" };
    case "rejected":
      return { label: "Removida", tone: "rejected" };
    case "pending_owner":
      return { label: "Pendente do profissional", tone: "pending" };
    case "pending_admin":
      return { label: "Pendente", tone: "pending" };
    default:
      return { label: "Pendente", tone: "pending" };
  }
}

function setAdminReviewsMessage(message, tone = "success") {
  if (!adminReviewsMessage) return;
  adminReviewsMessage.textContent = message || "";
  adminReviewsMessage.style.color = tone === "success" ? "#166534" : "#b91c1c";
}

function renderAdminReviewCard(review, type) {
  const statusMeta = getAdminReviewStatusMeta(review?.status);
  const profileHref = review?.profile?.id
    ? `profile.html?id=${encodeURIComponent(review.profile.id)}`
    : "profile.html";
  const location =
    [review?.profile?.city, review?.profile?.neighborhood].filter(Boolean).join(" â€¢ ") ||
    "LocalizaÃ§Ã£o nÃ£o informada";
  const createdAt = review?.createdAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.createdAt))
    : "Agora";

  const actionButtons =
    type === "pending_admin"
      ? `
        <button type="button" class="btn btn-primary" data-admin-approve-review="${escapeAdminReviewHtml(review.id)}">Aprovar</button>
        <button type="button" class="btn btn-outline" data-admin-reject-review="${escapeAdminReviewHtml(review.id)}">Rejeitar</button>
      `
      : `
        <button type="button" class="btn btn-primary" data-admin-keep-review="${escapeAdminReviewHtml(review.id)}">Manter publicada</button>
        <button type="button" class="btn btn-outline" data-admin-reject-review="${escapeAdminReviewHtml(review.id)}">Remover</button>
      `;

  return `
    <article class="profile-review-card admin-review-card" data-admin-review-id="${escapeAdminReviewHtml(review.id)}">
      <div class="profile-review-card__header">
        <div>
          <strong>${escapeAdminReviewHtml(review.authorName || "Paciente")}</strong>
          ${review.title ? `<p class="profile-review-card__title">${escapeAdminReviewHtml(review.title)}</p>` : ""}
        </div>
        <span class="review-status-badge review-status-badge--${escapeAdminReviewHtml(statusMeta.tone)}">${escapeAdminReviewHtml(statusMeta.label)}</span>
      </div>
      <p class="admin-review-card__profile">
        <a href="${profileHref}">${escapeAdminReviewHtml(review?.profile?.name || "Perfil")}</a>
        <span>${escapeAdminReviewHtml(location)}</span>
      </p>
      <p class="profile-review-card__body">${escapeAdminReviewHtml(review.body || "")}</p>
      ${review.reportReason ? `<p class="profile-review-card__report-reason"><strong>Motivo do reporte:</strong> ${escapeAdminReviewHtml(review.reportReason)}</p>` : ""}
      <div class="profile-review-card__footer">
        <span>${escapeAdminReviewHtml(createdAt)}</span>
      </div>
      <div class="admin-review-card__actions">
        <a class="btn btn-secondary" href="${profileHref}">Abrir perfil</a>
        ${actionButtons}
      </div>
    </article>
  `;
}

async function loadAdminReviews() {
  if (!window.physioApi?.fetchAdminReviews) return;

  try {
    const [pendingResponse, reportedResponse] = await Promise.all([
      window.physioApi.fetchAdminReviews("pending_admin"),
      window.physioApi.fetchAdminReviews("reported"),
    ]);

    const pendingReviews = Array.isArray(pendingResponse?.reviews) ? pendingResponse.reviews : [];
    const reportedReviews = Array.isArray(reportedResponse?.reviews) ? reportedResponse.reviews : [];

    adminPendingReviewsList.innerHTML = pendingReviews.length
      ? pendingReviews.map((review) => renderAdminReviewCard(review, "pending_admin")).join("")
      : '<p class="form-hint">Nenhuma review pendente no momento.</p>';

    adminReportedReviewsList.innerHTML = reportedReviews.length
      ? reportedReviews.map((review) => renderAdminReviewCard(review, "reported")).join("")
      : '<p class="form-hint">Nenhuma review reportada no momento.</p>';
  } catch (error) {
    console.error("Admin reviews load failed:", error);
    setAdminReviewsMessage(error?.message || "NÃ£o foi possÃ­vel carregar a fila de reviews.", "error");
    adminPendingReviewsList.innerHTML = '<p class="form-hint">NÃ£o foi possÃ­vel carregar reviews pendentes.</p>';
    adminReportedReviewsList.innerHTML = '<p class="form-hint">NÃ£o foi possÃ­vel carregar reviews reportadas.</p>';
  }
}

async function ensureAdminAccess() {
  const user = await (window.getLoggedUser ? window.getLoggedUser(true) : Promise.resolve(null));

  if (!user) {
    window.location.replace("login.html");
    return false;
  }

  if (!user.isAdmin) {
    setAdminReviewsMessage("Acesso restrito Ã  administraÃ§Ã£o.", "error");
    adminPendingReviewsList.innerHTML = '<p class="form-hint">VocÃª nÃ£o tem permissÃ£o para moderar reviews.</p>';
    adminReportedReviewsList.innerHTML = '<p class="form-hint">VocÃª nÃ£o tem permissÃ£o para moderar reviews.</p>';
    return false;
  }

  return true;
}

document.addEventListener("click", async (event) => {
  const approveButton = event.target.closest("[data-admin-approve-review]");
  const rejectButton = event.target.closest("[data-admin-reject-review]");
  const keepButton = event.target.closest("[data-admin-keep-review]");
  const button = approveButton || rejectButton || keepButton;
  if (!button) return;

  button.disabled = true;
  setAdminReviewsMessage("");

  try {
    if (approveButton) {
      await window.physioApi.approveReview(approveButton.dataset.adminApproveReview);
      setAdminReviewsMessage("Review aprovada e publicada com sucesso.");
    } else if (keepButton) {
      await window.physioApi.keepPublishedReview(keepButton.dataset.adminKeepReview);
      setAdminReviewsMessage("Review mantida como publicada.");
    } else {
      await window.physioApi.rejectReview(rejectButton.dataset.adminRejectReview);
      setAdminReviewsMessage("Review removida com sucesso.");
    }

    await loadAdminReviews();
  } catch (error) {
    console.error("Admin review moderation failed:", error);
    setAdminReviewsMessage(error?.message || "NÃ£o foi possÃ­vel moderar esta review.", "error");
  } finally {
    button.disabled = false;
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const isAdmin = await ensureAdminAccess();
  if (!isAdmin) return;
  await loadAdminReviews();
});