const myReviewsList = document.getElementById("myReviewsList");
const myReviewsMessage = document.getElementById("myReviewsMessage");

function escapeMyReviewsHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getMyReviewStatusMeta(status) {
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
      return { label: "Pendente de aprovaÃ§Ã£o", tone: "pending" };
    case "pending_admin":
      return { label: "Pendente de anÃ¡lise", tone: "pending" };
    default:
      return { label: "Pendente", tone: "pending" };
  }
}

function setMyReviewsMessage(message, tone = "success") {
  if (!myReviewsMessage) return;
  myReviewsMessage.textContent = message || "";
  myReviewsMessage.style.color = tone === "success" ? "#166534" : "#b91c1c";
}

function renderOwnerReviewCard(review) {
  const statusMeta = getMyReviewStatusMeta(review?.status);
  const normalizedStatus = String(review?.status || "").trim().toLowerCase();
  const canReport = ["approved", "published", "reported"].includes(normalizedStatus);
  const canApprove = normalizedStatus === "pending_owner";
  const reviewDate = review?.createdAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(review.createdAt))
    : "Agora";
  const rating = Math.max(0, Math.min(Number(review?.rating || 0), 5));
  const ratingMarkup =
    rating > 0
      ? `<span class="profile-review-card__rating" aria-label="${rating} de 5 estrelas"><span class="profile-review-card__rating__value">${"â˜…".repeat(rating)}</span></span>`
      : "";

  return `
    <article class="profile-review-card" data-owner-review-id="${escapeMyReviewsHtml(review.id)}">
      <div class="profile-review-card__header">
        <div>
          <strong>${escapeMyReviewsHtml(review.authorName || "Paciente")}</strong>
          ${review.title ? `<p class="profile-review-card__title">${escapeMyReviewsHtml(review.title)}</p>` : ""}
        </div>
        <span class="review-status-badge review-status-badge--${escapeMyReviewsHtml(statusMeta.tone)}">${escapeMyReviewsHtml(statusMeta.label)}</span>
      </div>
      ${ratingMarkup}
      <p class="profile-review-card__body">${escapeMyReviewsHtml(review.body || "")}</p>
      <div class="profile-review-card__footer">
        <span>${escapeMyReviewsHtml(reviewDate)}</span>
        <div class="admin-review-card__actions">
          ${canApprove ? `<button type="button" class="btn btn-primary" data-owner-approve-review="${escapeMyReviewsHtml(review.id)}">Aprovar</button>` : ""}
          ${canApprove ? `<button type="button" class="btn btn-outline" data-owner-reject-review="${escapeMyReviewsHtml(review.id)}">Rejeitar</button>` : ""}
          ${canReport ? `<button type="button" class="btn btn-outline btn-small" data-owner-report-review="${escapeMyReviewsHtml(review.id)}">${normalizedStatus === "reported" ? "Atualizar reporte" : "Reportar review"}</button>` : ""}
        </div>
      </div>
      ${review.reportReason ? `<p class="profile-review-card__report-reason"><strong>Motivo do reporte:</strong> ${escapeMyReviewsHtml(review.reportReason)}</p>` : ""}
    </article>
  `;
}

async function loadMyReviews() {
  if (!myReviewsList || !window.physioApi?.fetchMyReviews) return;

  try {
    const response = await window.physioApi.fetchMyReviews();
    const reviews = Array.isArray(response?.reviews) ? response.reviews : [];

    myReviewsList.innerHTML = reviews.length
      ? reviews.map(renderOwnerReviewCard).join("")
      : '<div class="profile-reviews-empty"><p>VocÃª ainda nÃ£o possui avaliaÃ§Ãµes.</p></div>';
  } catch (error) {
    console.error("My reviews load failed:", error);
    myReviewsList.innerHTML = '<div class="profile-reviews-empty"><p>NÃ£o foi possÃ­vel carregar suas avaliaÃ§Ãµes agora.</p></div>';
  }
}

document.addEventListener("click", async (event) => {
  const reportButton = event.target.closest("[data-owner-report-review]");
  const approveButton = event.target.closest("[data-owner-approve-review]");
  const rejectButton = event.target.closest("[data-owner-reject-review]");
  const actionButton = reportButton || approveButton || rejectButton;
  if (!actionButton) return;

  actionButton.disabled = true;
  setMyReviewsMessage("");

  try {
    if (reportButton) {
      const reason = window.prompt("Descreva o motivo do reporte para a equipe de moderaÃ§Ã£o:");
      if (!reason || !reason.trim()) {
        actionButton.disabled = false;
        return;
      }
      await window.physioApi.reportProfileReview(reportButton.dataset.ownerReportReview, reason.trim());
      setMyReviewsMessage("Review reportada para anÃ¡lise administrativa.");
    } else if (approveButton) {
      await window.physioApi.approveOwnReview(approveButton.dataset.ownerApproveReview);
      setMyReviewsMessage("AvaliaÃ§Ã£o aprovada com sucesso.");
    } else if (rejectButton) {
      await window.physioApi.rejectOwnReview(rejectButton.dataset.ownerRejectReview);
      setMyReviewsMessage("AvaliaÃ§Ã£o rejeitada com sucesso.");
    }

    await loadMyReviews();
  } catch (error) {
    console.error("My review moderation failed:", error);
    setMyReviewsMessage(error?.message || "NÃ£o foi possÃ­vel atualizar esta avaliaÃ§Ã£o agora.", "error");
  } finally {
    actionButton.disabled = false;
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const loggedUser = await (window.getLoggedUser ? window.getLoggedUser(true) : Promise.resolve(null));

  if (!loggedUser) {
    window.location.replace("login.html");
    return;
  }

  if (loggedUser?.accountType === "clinic") {
    window.location.replace("clinic-dashboard.html");
    return;
  }

  await loadMyReviews();
});