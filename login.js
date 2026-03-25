const loginForm = document.getElementById("loginForm");
const loginMensagem = document.getElementById("loginMensagem");

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const senha = document.getElementById("loginSenha").value;

    const perfis = JSON.parse(localStorage.getItem("physioProfiles")) || [];

    const usuario = perfis.find(
      (perfil) =>
        perfil.email.toLowerCase() === email &&
        perfil.senha === senha
    );

    if (!usuario) {
      loginMensagem.textContent = "E-mail ou senha inválidos.";
      loginMensagem.style.color = "#b91c1c";
      return;
    }

    localStorage.setItem("loggedPhysioId", usuario.id);

    loginMensagem.textContent = "Login realizado com sucesso!";
    loginMensagem.style.color = "#166534";

    setTimeout(() => {
      window.location.href = "index.html";
    }, 500);
  });
}