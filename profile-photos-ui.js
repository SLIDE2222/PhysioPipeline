(function () {
  const MAX_PROFILE_PHOTOS = 5;
  const IMAGE_PATH_REGEX = /\.(jpg|jpeg|png|webp)(\?.*)?(#.*)?$/i;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function cleanUrl(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isValidImageUrl(value) {
    const normalized = cleanUrl(value);
    if (!normalized) return false;

    try {
      const parsed = new URL(normalized);
      if (!/^https?:$/i.test(parsed.protocol)) return false;
      const fullPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return IMAGE_PATH_REGEX.test(fullPath);
    } catch (_) {
      return false;
    }
  }

  function createEditor(options = {}) {
    const list = document.getElementById(options.listId);
    const addButton = document.getElementById(options.addButtonId);
    const message = document.getElementById(options.messageId);

    if (!list || !addButton) return null;

    let rows = [''];

    function setMessage(text = '', tone = 'muted') {
      if (!message) return;
      message.textContent = text;
      message.style.color = tone === 'error' ? '#b91c1c' : '#64748b';
    }

    function render() {
      const visibleRows = rows.length ? rows : [''];
      list.innerHTML = visibleRows.map((rowValue, index) => {
        const value = cleanUrl(rowValue);
        const isValid = !value || isValidImageUrl(value);

        return `
          <div class="profile-photos-editor__item">
            <div class="profile-photos-editor__row">
              <input
                type="url"
                class="profile-photos-editor__input"
                data-photo-url-input="${index}"
                value="${escapeHtml(value)}"
                placeholder="https://exemplo.com/foto.jpg"
                inputmode="url"
                autocomplete="off"
              />
              <button
                type="button"
                class="btn btn-outline profile-photos-editor__remove"
                data-photo-url-remove="${index}"
              >
                Remover
              </button>
            </div>
            <div class="profile-photos-editor__preview-shell">
              ${value && isValid
                ? `<img src="${escapeHtml(value)}" alt="Prévia da foto ${index + 1}" class="profile-photos-editor__preview" loading="lazy" decoding="async" />`
                : `<div class="profile-photos-editor__preview-placeholder">${value ? 'Adicione uma URL válida de imagem.' : 'Cole a URL da imagem para ver a prévia.'}</div>`}
            </div>
          </div>
        `;
      }).join('');

      addButton.hidden = rows.filter((value) => cleanUrl(value)).length >= MAX_PROFILE_PHOTOS || rows.length >= MAX_PROFILE_PHOTOS;
      addButton.disabled = addButton.hidden;

      if (rows.filter((value) => cleanUrl(value)).length >= MAX_PROFILE_PHOTOS) {
        setMessage('Limite de 5 fotos atingido.');
      } else if (!message?.dataset?.persistent) {
        setMessage('');
      }
    }

    function setValue(values = []) {
      rows = (Array.isArray(values) ? values : [])
        .map(cleanUrl)
        .filter(Boolean)
        .slice(0, MAX_PROFILE_PHOTOS);
      if (!rows.length) rows = [''];
      delete message?.dataset?.persistent;
      render();
    }

    function getValue() {
      return rows.map(cleanUrl).filter(Boolean);
    }

    function validate() {
      const values = getValue();
      const invalid = values.find((value) => !isValidImageUrl(value));
      if (invalid) {
        if (message) message.dataset.persistent = 'true';
        setMessage('Adicione uma URL válida de imagem.', 'error');
        return { valid: false, message: 'Adicione uma URL válida de imagem.' };
      }

      if (values.length > MAX_PROFILE_PHOTOS) {
        if (message) message.dataset.persistent = 'true';
        setMessage('Limite de 5 fotos atingido.', 'error');
        return { valid: false, message: 'Limite de 5 fotos atingido.' };
      }

      if (message) delete message.dataset.persistent;
      setMessage(values.length >= MAX_PROFILE_PHOTOS ? 'Limite de 5 fotos atingido.' : '');
      return { valid: true, value: values };
    }

    addButton.addEventListener('click', () => {
      if (rows.length >= MAX_PROFILE_PHOTOS) {
        if (message) message.dataset.persistent = 'true';
        setMessage('Limite de 5 fotos atingido.', 'error');
        return;
      }

      rows.push('');
      if (message) delete message.dataset.persistent;
      render();

      requestAnimationFrame(() => {
        list.querySelector(`[data-photo-url-input="${rows.length - 1}"]`)?.focus();
      });
    });

    list.addEventListener('input', (event) => {
      const input = event.target.closest('[data-photo-url-input]');
      if (!input) return;
      const index = Number(input.dataset.photoUrlInput);
      if (!Number.isInteger(index) || index < 0 || index >= rows.length) return;
      rows[index] = cleanUrl(input.value);
      if (message) delete message.dataset.persistent;
      render();
    });

    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-photo-url-remove]');
      if (!button) return;
      const index = Number(button.dataset.photoUrlRemove);
      if (!Number.isInteger(index) || index < 0 || index >= rows.length) return;
      rows.splice(index, 1);
      if (!rows.length) rows = [''];
      if (message) delete message.dataset.persistent;
      render();
    });

    render();

    return {
      setValue,
      getValue,
      validate,
      isValidImageUrl,
    };
  }

  window.PhysioProfilePhotos = {
    createEditor,
    isValidImageUrl,
    MAX_PROFILE_PHOTOS,
  };
})();
