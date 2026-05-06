document.addEventListener("DOMContentLoaded", () => {
  const googleButtons = Array.from(document.querySelectorAll("[data-google-auth]"));

  if (!googleButtons.length) return;

  const clientId =
    window.GOOGLE_CLIENT_ID ||
    document.querySelector('meta[name="google-client-id"]')?.content ||
    "";

  if (!clientId) {
    console.warn("Google Client ID is missing. Set window.GOOGLE_CLIENT_ID or a google-client-id meta tag.");
    return;
  }

  if (!window.google?.accounts?.id) {
    console.warn("Google Identity script did not load.");
    return;
  }

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: async (response) => {
      try {
        if (!response?.credential) {
          throw new Error("Google did not return a credential.");
        }

        const data = await window.physioApi.loginWithGoogle(response.credential);

        if (data?.user) {
          window.location.href = "index.html";
        }
      } catch (error) {
        alert(error.message || "Não foi possível entrar com Google.");
      }
    },
  });

  googleButtons.forEach((button) => {
    window.google.accounts.id.renderButton(button, {
      theme: "outline",
      size: "large",
      type: "standard",
      shape: "pill",
      text: "continue_with",
      width: button.dataset.width ? Number(button.dataset.width) : 320,
    });
  });
});
