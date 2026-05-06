document.addEventListener("DOMContentLoaded", () => {
  const googleButtons = Array.from(document.querySelectorAll("[data-google-auth]"));

  if (!googleButtons.length) return;

  const clientId =
    window.GOOGLE_CLIENT_ID ||
    document.querySelector('meta[name="google-client-id"]')?.content ||
    "";

  const hasRealClientId =
    clientId &&
    clientId !== "YOUR_GOOGLE_CLIENT_ID_HERE" &&
    clientId.includes(".apps.googleusercontent.com");

  if (!hasRealClientId) {
    console.warn("Google Client ID missing. Replace YOUR_GOOGLE_CLIENT_ID_HERE in cadastro.html.");
    googleButtons.forEach((button) => {
      button.innerHTML = `
        <button type="button" class="btn btn-outline btn-block" disabled>
          Google login precisa do Client ID
        </button>
      `;
    });
    return;
  }

  const waitForGoogle = () =>
    new Promise((resolve, reject) => {
      let tries = 0;

      const timer = setInterval(() => {
        tries += 1;

        if (window.google?.accounts?.id) {
          clearInterval(timer);
          resolve();
        }

        if (tries > 40) {
          clearInterval(timer);
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
