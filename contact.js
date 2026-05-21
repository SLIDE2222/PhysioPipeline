const contactForm = document.getElementById('contactForm');
const contactMensagem = document.getElementById('contactMensagem');

function setContactMessage(message, color = '#b91c1c') {
  if (!contactMensagem) return;
  contactMensagem.textContent = message;
  contactMensagem.style.color = color;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function submitContact(event) {
  event.preventDefault();

  if (!contactForm || !window.physioApi?.sendContactMessage) return;

  const formData = new FormData(contactForm);
  const payload = {
    name: String(formData.get('name') || '').trim(),
    email: String(formData.get('email') || '').trim().toLowerCase(),
    subject: String(formData.get('subject') || '').trim(),
    message: String(formData.get('message') || '').trim(),
    website: String(formData.get('website') || '').trim(),
  };

  const submitButton = contactForm.querySelector('button[type="submit"]');
  setContactMessage('');

  if (payload.website) return setContactMessage('Mensagem bloqueada por validação anti-spam.');
  if (!payload.name) return setContactMessage('Informe seu nome.');
  if (!isValidEmail(payload.email)) return setContactMessage('Informe um e-mail válido.');
  if (!payload.subject) return setContactMessage('Informe o assunto.');
  if (payload.message.length < 10) return setContactMessage('Escreva uma mensagem um pouco mais completa.');

  try {
    if (submitButton) submitButton.disabled = true;
    setContactMessage('Enviando mensagem...', '#2563eb');
    const data = await window.physioApi.sendContactMessage(payload);
    setContactMessage(data.message || 'Mensagem enviada com sucesso.', '#166534');
    contactForm.reset();
  } catch (error) {
    console.error('Contact request failed:', error);
    setContactMessage(error.message || 'Não foi possível enviar sua mensagem agora.');
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

if (contactForm) {
  contactForm.addEventListener('submit', submitContact);
}
