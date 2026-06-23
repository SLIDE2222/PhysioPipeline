(function () {
  const MAX_PROFILE_PHOTOS = 5;
  const BUCKET_NAME = 'profile-photos';
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

  function buildStoragePath(profileId, file) {
    const safeProfileId = sanitizePathSegment(profileId);
    const extension = getFileExtension(file) || 'jpg';
    const safeName = sanitizeFileName(String(file?.name || 'foto').replace(/\.[^.]+$/, ''));
    const timestamp = Date.now();
    const suffix = Math.random().toString(36).slice(2, 8);
    return `profiles/${safeProfileId}/${timestamp}-${suffix}-${safeName}.${extension}`;
  }

  function createEditor(options = {}) {
    const list = document.getElementById(options.listId);
    const addButton = document.getElementById(options.addButtonId);
    const message = document.getElementById(options.messageId);

    if (!list) return null;

    let values = [];
    let profileId = '';
    let uploadingSlot = -1;
    let activeSlot = -1;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
    fileInput.hidden = true;
    document.body.appendChild(fileInput);

    function setMessage(text = '', tone = 'muted') {
      if (!message) return;
      message.textContent = text;
      message.style.color = tone === 'error' ? '#b91c1c' : tone === 'success' ? '#166534' : '#64748b';
    }

    function getValue() {
      return values.map(normalizePhotoUrl).filter(Boolean).slice(0, MAX_PROFILE_PHOTOS);
    }

    function setValue(nextValues = []) {
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
      const filledCount = getValue().length;
      if (!filledCount) return 1;
      return Math.min(MAX_PROFILE_PHOTOS, filledCount < MAX_PROFILE_PHOTOS ? filledCount + 1 : filledCount);
    }

    function render() {
      const filledValues = getValue();
      const slotCount = getRenderableSlotCount();

      list.innerHTML = Array.from({ length: slotCount }).map((_, index) => {
        const value = filledValues[index] || '';
        const isFilled = Boolean(value);
        const isUploading = uploadingSlot === index;

        return `
          <article class="profile-photo-slot ${isFilled ? 'is-filled' : 'is-empty'} ${isUploading ? 'is-uploading' : ''}">
            <div class="profile-photo-slot__preview">
              ${isFilled
                ? `<img src="${escapeHtml(value)}" alt="Foto do perfil ${index + 1}" loading="lazy" decoding="async" />`
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
        const canAddMore = filledValues.length < MAX_PROFILE_PHOTOS;
        addButton.hidden = !canAddMore;
        addButton.disabled = !canAddMore || uploadingSlot >= 0;
      }

      if (uploadingSlot >= 0) {
        setMessage('Enviando foto...');
      } else if (filledValues.length >= MAX_PROFILE_PHOTOS) {
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
        setMessage('Envie uma imagem válida nos formatos JPG, PNG ou WEBP.', 'error');
        return;
      }

      if (!profileId) {
        setMessage('Salve ou recarregue o perfil antes de enviar fotos.', 'error');
        return;
      }

      const supabaseClient = ensureSupabaseClient();
      if (!supabaseClient?.storage) {
        console.error('Supabase storage client is not available for profile photo upload.');
        setMessage('Não foi possível inicializar o envio das fotos agora.', 'error');
        return;
      }

      uploadingSlot = index;
      render();

      try {
        console.log('Selected file:', file);
        console.log('Original file type:', file?.type || '');
        console.log('File name:', file?.name || '');

        const objectPath = buildStoragePath(profileId, file);
        const contentType = normalizeImageMimeType(file);

        console.log('Normalized content type:', contentType);

        if (!contentType) {
          throw new Error('Envie uma imagem v?lida nos formatos JPG, PNG ou WEBP.');
        }

        console.log('Uploading photo with Supabase Storage');

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
        console.log('Uploaded photo URL:', publicUrl);
        if (!publicUrl || !isValidImageUrl(publicUrl)) {
          throw new Error('Não foi possível gerar a URL pública da imagem enviada.');
        }

        const nextValues = getValue();
        nextValues[index] = publicUrl;
        values = nextValues.filter(Boolean).slice(0, MAX_PROFILE_PHOTOS);
        console.log('Saving profile photos:', values);
        setMessage('Foto enviada com sucesso.', 'success');
      } catch (error) {
        console.error('Profile photo upload failed:', error);
        setMessage('Não foi possível enviar a foto agora. Tente novamente em alguns instantes.', 'error');
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

    fileInput.addEventListener('change', async () => {
      const [file] = fileInput.files || [];
      if (!file || activeSlot < 0) return;
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