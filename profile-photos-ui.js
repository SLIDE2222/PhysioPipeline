(function () {
  const MAX_PROFILE_PHOTOS = 5;
  const BUCKET_NAME = 'profile-gallery';
  const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
  const ACCEPTED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ]);

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizePhotoUrl(value) {
    return String(value || '').trim();
  }

  function isValidImageUrl(value) {
    const normalized = normalizePhotoUrl(value);
    if (!normalized) return false;

    try {
      const parsed = new URL(normalized);
      if (!/^https?:$/i.test(parsed.protocol)) return false;
      return ACCEPTED_EXTENSIONS.some((extension) =>
        new RegExp('\\.' + extension + '(\\?.*)?(#.*)?$', 'i').test(parsed.pathname + parsed.search + parsed.hash)
      );
    } catch (_) {
      return false;
    }
  }

  function getFileExtension(file) {
    const byMimeType = String(file?.type || '').split('/').pop()?.toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(byMimeType)) return byMimeType;

    const byName = String(file?.name || '').split('.').pop()?.toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(byName)) return byName;

    return '';
  }

  function isValidImageFile(file) {
    if (!file) return false;
    if (ACCEPTED_MIME_TYPES.has(String(file.type || '').toLowerCase())) return true;
    return Boolean(getFileExtension(file));
  }

  function normalizeImageMimeType(file) {
    const name = file?.name?.toLowerCase() || '';
    const type = file?.type || '';

    if (type === 'image/jpg') return 'image/jpeg';
    if (type === 'image/jpeg') return 'image/jpeg';
    if (type === 'image/png') return 'image/png';
    if (type === 'image/webp') return 'image/webp';

    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.webp')) return 'image/webp';

    return '';
  }

  function sanitizeFileName(fileName) {
    const base = String(fileName || 'foto')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '');

    return base || 'foto';
  }

  function sanitizePathSegment(value) {
    return String(value || 'perfil')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'perfil';
  }

  function ensureSupabaseClient() {
    if (window.supabaseClient?.storage) return window.supabaseClient;

    if (typeof window.initializePhysioSupabaseClient === 'function') {
      const client = window.initializePhysioSupabaseClient();
      if (client?.storage) return client;
    }

    return null;
  }

  function buildStoragePath(userId, profileId, file) {
    const safeUserId = sanitizePathSegment(userId || 'perfil');
    const safeProfileId = sanitizePathSegment(profileId || 'perfil');
    const extension = getFileExtension(file) || 'jpg';
    const safeName = sanitizeFileName(String(file?.name || 'foto').replace(/\.[^.]+$/, ''));
    const timestamp = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${safeUserId}/${safeProfileId}-${timestamp}-${suffix}-${safeName}.${extension}`;
  }

  function createEditor(options = {}) {
    const list = document.getElementById(options.listId);
    const addButton = document.getElementById(options.addButtonId);
    const message = document.getElementById(options.messageId);

    if (!list) return null;

    let values = [];
    let previewUrls = [];
    let profileId = '';
    let uploadingSlot = -1;
    let activeSlot = -1;
    let helperMessageLocked = false;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
    fileInput.hidden = true;
    document.body.appendChild(fileInput);

    function setMessage(text = '', tone = 'muted', options = {}) {
      if (!message) return;
      helperMessageLocked = Boolean(options.lockHelperMessage);
      message.textContent = text;
      message.style.color = tone === 'error' ? '#b91c1c' : tone === 'success' ? '#166534' : '#64748b';
    }

    function getValue() {
      return values.map(normalizePhotoUrl).filter(Boolean).slice(0, MAX_PROFILE_PHOTOS);
    }

    function revokePreviewUrl(value) {
      if (!value || typeof value !== 'string' || !value.startsWith('blob:')) return;

      try {
        URL.revokeObjectURL(value);
      } catch (_) {
        // ignore object URL cleanup issues
      }
    }

    function clearPreviewAt(index) {
      if (!Number.isInteger(index) || index < 0) return;
      revokePreviewUrl(previewUrls[index]);
      previewUrls[index] = '';
    }

    function clearAllPreviewUrls() {
      previewUrls.forEach(revokePreviewUrl);
      previewUrls = [];
    }

    function setValue(nextValues = []) {
      clearAllPreviewUrls();
      values = (Array.isArray(nextValues) ? nextValues : [])
        .map(normalizePhotoUrl)
        .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index)
        .slice(0, MAX_PROFILE_PHOTOS);

      render();
    }

    function setContext(nextContext = {}) {
      profileId = String(nextContext.profileId || profileId || '').trim();
    }

    function getRenderableSlotCount() {
      const filledValues = getValue();
      const visualCount = Array.from({ length: MAX_PROFILE_PHOTOS }).filter((_, index) => Boolean(filledValues[index] || previewUrls[index])).length;
      if (!visualCount) return 1;
      return Math.min(MAX_PROFILE_PHOTOS, visualCount < MAX_PROFILE_PHOTOS ? visualCount + 1 : visualCount);
    }

    function render() {
      const filledValues = getValue();
      const slotCount = getRenderableSlotCount();
      const visualCount = Array.from({ length: MAX_PROFILE_PHOTOS }).filter((_, index) => Boolean(filledValues[index] || previewUrls[index])).length;

      list.innerHTML = Array.from({ length: slotCount }).map((_, index) => {
        const value = filledValues[index] || '';
        const previewValue = previewUrls[index] || '';
        const displayValue = value || previewValue;
        const isFilled = Boolean(displayValue);
        const isUploading = uploadingSlot === index;

        return `
          <article class="profile-photo-slot ${isFilled ? 'is-filled' : 'is-empty'} ${isUploading ? 'is-uploading' : ''}">
            <div class="profile-photo-slot__preview">
              ${isFilled
                ? `<img src="${escapeHtml(displayValue)}" alt="Foto do perfil ${index + 1}" loading="lazy" decoding="async" />`
                : `<div class="profile-photo-slot__placeholder">
                     <span class="profile-photo-slot__placeholder-icon">+</span>
                     <span class="profile-photo-slot__placeholder-text">Nenhuma foto enviada</span>
                   </div>`}
              ${isUploading ? '<div class="profile-photo-slot__overlay">Enviando foto...</div>' : ''}
            </div>
            <div class="profile-photo-slot__actions">
              <button type="button" class="btn btn-outline profile-photo-slot__button" data-photo-upload-slot="${index}">
                ${isFilled ? 'Trocar foto' : 'Adicionar foto'}
              </button>
              ${isFilled ? `<button type="button" class="btn btn-outline profile-photo-slot__button profile-photo-slot__button--danger" data-photo-remove-slot="${index}">Remover</button>` : ''}
            </div>
          </article>
        `;
      }).join('');

      if (addButton) {
        const canAddMore = visualCount < MAX_PROFILE_PHOTOS;
        addButton.hidden = !canAddMore;
        addButton.disabled = !canAddMore || uploadingSlot >= 0;
      }

      if (helperMessageLocked) {
        return;
      }

      if (uploadingSlot >= 0) {
        setMessage('Enviando foto...');
      } else if (visualCount >= MAX_PROFILE_PHOTOS) {
        setMessage('Limite de 5 fotos atingido.');
      } else {
        setMessage('Adicione até 5 fotos para deixar seu perfil mais completo e confiável.');
      }
    }

    function validate() {
      if (uploadingSlot >= 0) {
        return {
          valid: false,
          message: 'Aguarde o envio da foto terminar antes de salvar.',
        };
      }

      return {
        valid: true,
        value: getValue(),
      };
    }

    function requestFileForSlot(index) {
      if (uploadingSlot >= 0) return;
      activeSlot = index;
      fileInput.value = '';
      fileInput.click();
    }

    async function uploadFileForSlot(file, index) {
      if (!isValidImageFile(file)) {
        setMessage('Envie uma imagem válida nos formatos JPG, PNG ou WEBP.', 'error', { lockHelperMessage: true });
        return;
      }

      if (!profileId) {
        setMessage('Salve ou recarregue o perfil antes de enviar fotos.', 'error', { lockHelperMessage: true });
        return;
      }

      const supabaseClient = ensureSupabaseClient();
      if (!supabaseClient?.storage) {
        console.error('Supabase storage client is not available for profile photo upload.');
        setMessage('Não foi possível inicializar o envio das fotos agora.', 'error', { lockHelperMessage: true });
        return;
      }

      clearPreviewAt(index);
      previewUrls[index] = URL.createObjectURL(file);
      uploadingSlot = index;
      render();

      try {
        console.log('SELECTED PHOTO FILE:', file);
        console.log('Original file type:', file?.type || '');
        console.log('File name:', file?.name || '');

        const objectPath = buildStoragePath(sessionUser.id, profileId, file);
        console.log('PHOTO UPLOAD PATH:', objectPath);
        console.log('PHOTO UPLOAD USER ID:', sessionUser.id);
        const contentType = normalizeImageMimeType(file);
        console.log('Normalized content type:', contentType);

        if (!contentType) {
          throw new Error('Envie uma imagem válida nos formatos JPG, PNG ou WEBP.');
        }

        const uploadResult = await supabaseClient.storage
          .from(BUCKET_NAME)
          .upload(objectPath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType,
          });

        if (uploadResult.error) {
          throw uploadResult.error;
        }

        const publicUrlResult = supabaseClient.storage
          .from(BUCKET_NAME)
          .getPublicUrl(objectPath);

        const publicUrl = publicUrlResult?.data?.publicUrl || '';
        console.log('PHOTO PUBLIC URL:', publicUrl);
        if (!publicUrl || !isValidImageUrl(publicUrl)) {
          throw new Error('Não foi possível gerar a URL pública da foto.');
        }

        const nextValues = getValue();
        nextValues[index] = publicUrl;
        values = nextValues.filter(Boolean).slice(0, MAX_PROFILE_PHOTOS);
        clearPreviewAt(index);
        console.log('UPDATED EDIT PHOTOS STATE:', values);
        setMessage('Foto enviada com sucesso.', 'success', { lockHelperMessage: true });
      } catch (error) {
        console.error('Profile photo upload failed:', error);
        const uploadErrorMessage = error?.message
          ? `Não foi possível enviar a foto agora. ${error.message}`
          : 'Não foi possível enviar a foto agora. Tente novamente em alguns instantes.';
        setMessage(uploadErrorMessage, 'error', { lockHelperMessage: true });
      } finally {
        uploadingSlot = -1;
        render();
      }
    }

    list.addEventListener('click', (event) => {
      const uploadButton = event.target.closest('[data-photo-upload-slot]');
      if (uploadButton) {
        requestFileForSlot(Number(uploadButton.dataset.photoUploadSlot));
        return;
      }

      const removeButton = event.target.closest('[data-photo-remove-slot]');
      if (!removeButton) return;

      const index = Number(removeButton.dataset.photoRemoveSlot);
      helperMessageLocked = false;
      clearPreviewAt(index);
      const nextValues = getValue();
      nextValues.splice(index, 1);
      values = nextValues;
      render();
    });

    if (addButton) {
      addButton.addEventListener('click', () => {
        requestFileForSlot(getValue().length);
      });
    }

    fileInput.addEventListener('change', async (event) => {
      console.log('PHOTO INPUT CHANGE EVENT:', event);
      console.log('SELECTED FILES:', event?.target?.files);
      const file = event?.target?.files?.[0];
      console.log('SELECTED PHOTO FILE:', file);
      if (!file) {
        setMessage('Nenhuma imagem selecionada.', 'error', { lockHelperMessage: true });
        activeSlot = -1;
        fileInput.value = '';
        return;
      }

      if (activeSlot < 0) {
        fileInput.value = '';
        return;
      }

      helperMessageLocked = false;
      await uploadFileForSlot(file, activeSlot);
      activeSlot = -1;
      fileInput.value = '';
    });

    render();

    return {
      setContext,
      setValue,
      getValue,
      validate,
      isValidImageUrl,
      BUCKET_NAME,
    };
  }

  window.PhysioProfilePhotos = {
    createEditor,
    isValidImageUrl,
    MAX_PROFILE_PHOTOS,
    BUCKET_NAME,
  };
})();
