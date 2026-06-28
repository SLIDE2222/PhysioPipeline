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
        new RegExp(`\\.${extension}(\\?.*)?(#.*)?$`, 'i').test(parsed.pathname + parsed.search + parsed.hash)
      );
    } catch (_) {
      return false;
    }
  }

  function normalizeSavedPhotos(value) {
    const rawValues = Array.isArray(value)
      ? value
      : (() => {
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              return Array.isArray(parsed) ? parsed : [value];
            } catch (_) {
              return value ? [value] : [];
            }
          }

          if (value && typeof value === 'object') {
            const source = value.photosList ?? value.photos ?? value.fotos ?? [];
            return Array.isArray(source) ? source : source ? [source] : [];
          }

          return [];
        })();

    const seen = new Set();

    return rawValues
      .map(normalizePhotoUrl)
      .filter(Boolean)
      .filter((photoUrl) => isValidImageUrl(photoUrl))
      .filter((photoUrl) => {
        const key = photoUrl.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_PROFILE_PHOTOS);
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
    const exactUserId = String(userId || '').trim().replace(/^\/+|\/+$/g, '');
    const safeProfileId = sanitizePathSegment(profileId || 'profile');
    const safeFileName = sanitizeFileName(String(file?.name || 'foto'));
    const timestamp = Date.now();
    return `${exactUserId}/${safeProfileId}-${timestamp}-${safeFileName}`;
  }

  function createEditor(options = {}) {
    const list = document.getElementById(options.listId);
    const addButton = document.getElementById(options.addButtonId);
    const message = document.getElementById(options.messageId);
    const persistPhotos = typeof options.persistPhotos === 'function' ? options.persistPhotos : null;

    if (!list) return null;

    let values = [];
    let previewUrls = [];
    let profileId = '';
    let uploadingSlot = -1;
    let activeSlot = -1;
    let helperMessageLocked = false;
    let persisting = false;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
    fileInput.hidden = true;
    document.body.appendChild(fileInput);

    function isBusy() {
      return uploadingSlot >= 0 || persisting;
    }

    function setMessage(text = '', tone = 'muted', messageOptions = {}) {
      if (!message) return;
      helperMessageLocked = Boolean(messageOptions.lockHelperMessage);
      message.textContent = text;
      message.style.color = tone === 'error' ? '#b91c1c' : tone === 'success' ? '#166534' : '#64748b';
    }

    function getValue() {
      return normalizeSavedPhotos(values);
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
      helperMessageLocked = false;
      uploadingSlot = -1;
      activeSlot = -1;
      persisting = false;
      clearAllPreviewUrls();
      values = normalizeSavedPhotos(nextValues);
      render();
    }

    function setContext(nextContext = {}) {
      profileId = String(nextContext.profileId || profileId || '').trim();
    }

    function getVisiblePhotoCount() {
      return Array.from({ length: MAX_PROFILE_PHOTOS }).filter((_, index) => Boolean(getValue()[index] || previewUrls[index])).length;
    }

    function getRenderableSlotCount() {
      const visiblePhotoCount = getVisiblePhotoCount();
      if (!visiblePhotoCount) return 1;
      return Math.min(MAX_PROFILE_PHOTOS, visiblePhotoCount < MAX_PROFILE_PHOTOS ? visiblePhotoCount + 1 : visiblePhotoCount);
    }

    function render() {
      const filledValues = getValue();
      const slotCount = getRenderableSlotCount();
      const visiblePhotoCount = getVisiblePhotoCount();
      const disableActions = isBusy();

      list.innerHTML = Array.from({ length: slotCount }).map((_, index) => {
        const value = filledValues[index] || '';
        const previewValue = previewUrls[index] || '';
        const displayValue = previewValue || value;
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
              <button type="button" class="btn btn-outline profile-photo-slot__button" data-photo-upload-slot="${index}" ${disableActions ? 'disabled' : ''}>
                ${isFilled ? 'Trocar foto' : 'Adicionar foto'}
              </button>
              ${isFilled ? `<button type="button" class="btn btn-outline profile-photo-slot__button profile-photo-slot__button--danger" data-photo-remove-slot="${index}" ${disableActions ? 'disabled' : ''}>Remover</button>` : ''}
            </div>
          </article>
        `;
      }).join('');

      if (addButton) {
        addButton.hidden = true;
        addButton.disabled = true;
      }

      if (helperMessageLocked) return;

      if (uploadingSlot >= 0) {
        setMessage('Enviando foto...');
      } else if (persisting) {
        setMessage('Salvando fotos...');
      } else if (visiblePhotoCount >= MAX_PROFILE_PHOTOS) {
        setMessage('Limite de 5 fotos atingido.');
      } else {
        setMessage('');
      }
    }

    function validate() {
      if (isBusy()) {
        return {
          valid: false,
          message: 'Aguarde a atualização das fotos terminar antes de salvar.',
        };
      }

      return {
        valid: true,
        value: getValue(),
      };
    }

    function requestFileForSlot(index) {
      if (isBusy() || index < 0 || index >= MAX_PROFILE_PHOTOS) return;
      activeSlot = index;
      fileInput.value = '';
      fileInput.click();
    }

    async function persistPhotoSet(nextValues, previousValues, successMessage, cleanup = null) {
      values = normalizeSavedPhotos(nextValues);
      console.log('PROFILE GALLERY PERSIST REQUEST:', {
        nextValues: values,
        previousValues: normalizeSavedPhotos(previousValues),
      });
      render();

      if (!persistPhotos) {
        setMessage(successMessage, 'success', { lockHelperMessage: true });
        return true;
      }

      persisting = true;
      helperMessageLocked = false;
      render();

      try {
        const persistedResult = await persistPhotos(values);
        values = normalizeSavedPhotos(persistedResult || values);
        console.log('PROFILE GALLERY PERSIST RESULT:', {
          persistedResult,
          finalValues: values,
        });
        setMessage(successMessage, 'success', { lockHelperMessage: true });
        return true;
      } catch (error) {
        console.error('Profile gallery persistence failed:', error);
        values = normalizeSavedPhotos(previousValues);

        if (cleanup?.supabaseClient?.storage?.from && cleanup?.objectPath) {
          try {
            await cleanup.supabaseClient.storage.from(BUCKET_NAME).remove([cleanup.objectPath]);
          } catch (cleanupError) {
            console.warn('Could not clean up orphaned gallery upload:', cleanupError);
          }
        }

        setMessage('Não foi possível salvar as fotos do perfil agora. Tente novamente em alguns instantes.', 'error', {
          lockHelperMessage: true,
        });
        return false;
      } finally {
        persisting = false;
        render();
      }
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
      if (!supabaseClient?.storage || !supabaseClient?.auth?.getSession) {
        console.error('Supabase storage client is not available for profile photo upload.');
        setMessage('Não foi possível enviar a foto agora. Verifique se você está logado e tente novamente.', 'error', { lockHelperMessage: true });
        return;
      }

      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

      if (sessionError) {
        console.error('Failed to get Supabase session:', sessionError);
        setMessage('Não foi possível validar sua sessão. Faça login novamente.', 'error', { lockHelperMessage: true });
        return;
      }

      const user = sessionData?.session?.user;
      if (!user?.id) {
        console.error('Profile gallery upload blocked because no authenticated Supabase session was found.', sessionData);
        setMessage('Não foi possível enviar a foto agora. Verifique se você está logado e tente novamente.', 'error', { lockHelperMessage: true });
        return;
      }

      const previousValues = getValue();
      clearPreviewAt(index);
      previewUrls[index] = URL.createObjectURL(file);
      uploadingSlot = index;
      helperMessageLocked = false;
      render();

      let objectPath = '';

      try {
        console.log('PROFILE GALLERY SELECTED FILE:', {
          slot: index,
          name: file?.name || '',
          type: file?.type || '',
          size: file?.size || 0,
        });
        const contentType = normalizeImageMimeType(file);

        if (!contentType) {
          throw new Error('Envie uma imagem válida nos formatos JPG, PNG ou WEBP.');
        }

        objectPath = buildStoragePath(user.id, profileId, file);

        const uploadResult = await supabaseClient.storage
          .from(BUCKET_NAME)
          .upload(objectPath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType,
          });

        if (uploadResult.error) {
          throw uploadResult.error;
        }

        const publicUrlResult = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(objectPath);
        const publicUrl = publicUrlResult?.data?.publicUrl || '';
        console.log('PROFILE GALLERY UPLOADED PUBLIC URL:', publicUrl);

        if (!publicUrl || !isValidImageUrl(publicUrl)) {
          throw new Error('Não foi possível gerar a URL pública da foto.');
        }

        clearPreviewAt(index);
        uploadingSlot = -1;

        const nextValues = previousValues.slice();
        nextValues[index] = publicUrl;
        await persistPhotoSet(nextValues, previousValues, 'Foto enviada com sucesso.', {
          supabaseClient,
          objectPath,
        });
      } catch (error) {
        console.error('Gallery upload failed:', error);
        clearPreviewAt(index);
        values = normalizeSavedPhotos(previousValues);
        setMessage('Não foi possível enviar a foto agora. Verifique se você está logado e tente novamente.', 'error', {
          lockHelperMessage: true,
        });
      } finally {
        uploadingSlot = -1;
        render();
      }
    }

    list.addEventListener('click', async (event) => {
      const uploadButton = event.target.closest('[data-photo-upload-slot]');
      if (uploadButton) {
        requestFileForSlot(Number(uploadButton.dataset.photoUploadSlot));
        return;
      }

      const removeButton = event.target.closest('[data-photo-remove-slot]');
      if (!removeButton || isBusy()) return;

      const index = Number(removeButton.dataset.photoRemoveSlot);
      const previousValues = getValue();
      const nextValues = previousValues.slice();
      nextValues.splice(index, 1);
      helperMessageLocked = false;
      await persistPhotoSet(nextValues, previousValues, 'Foto removida com sucesso.');
    });

    fileInput.addEventListener('change', async (event) => {
      const file = event?.target?.files?.[0];

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
  };
})();
