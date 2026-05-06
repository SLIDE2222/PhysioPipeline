document.addEventListener("DOMContentLoaded", () => {
  const googleButtons = Array.from(document.querySelectorAll("[data-google-auth]"));

  if (!googleButtons.length) return;

  const clientId =
    window.GOOGLE_CLIENT_ID ||
    document.querySelector('meta[name="google-client-id"]')?.content ||
    "";

  if (!clientId || !clientId.includes(".apps.googleusercontent.com")) {
    console.warn("Google Client ID missing or invalid.");
    googleButtons.forEach((button) => {
      button.innerHTML = `
        <button type="button" class="btn btn-outline btn-block" disabled>
          Google login sem Client ID
        </button>
      `;
    });
    return;
  }

  const waitForGoogle = () =>
    new Promise((resolve, reject) => {
      let attempts = 0;

      const interval = setInterval(() => {
        attempts += 1;

        if (window.google?.accounts?.id) {
          clearInterval(interval);
          resolve();
        }

        if (attempts > 60) {
          clearInterval(interval);
          reject(new Error("Google Identity script did not load."));
        }
      }, 100);
    });

  waitForGoogle()
    .then(() => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            if (!response?.credential) {
              throw new Error("Google did not return a credential.");
            }

            if (!window.physioApi?.loginWithGoogle) {
              throw new Error("Google login helper is missing in api.js.");
            }

            const data = await window.physioApi.loginWithGoogle(response.credential);

            if (data?.user) {
              window.location.href = "index.html";
            }
          } catch (error) {
            console.error("Google auth failed:", error);
            alert(error.message || "Não foi possível entrar com Google.");
          }
        },
      });

      googleButtons.forEach((button) => {
        button.innerHTML = "";
        window.google.accounts.id.renderButton(button, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "pill",
          text: "continue_with",
          width: button.dataset.width ? Number(button.dataset.width) : 320,
        });
      });
    })
    .catch((error) => {
      console.warn(error);
      googleButtons.forEach((button) => {
        button.innerHTML = `
          <button type="button" class="btn btn-outline btn-block" disabled>
            Google indisponível
          </button>
        `;
      });
    });
});
