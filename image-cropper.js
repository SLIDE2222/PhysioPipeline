(function () {
  const OUTPUT_SIZE = 512;

  function readImageInput(input) {
    if (typeof input === 'string') return Promise.resolve(input);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(input);
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function createCropperMarkup() {
    const modal = document.createElement('div');
    modal.className = 'image-cropper-modal';
    modal.innerHTML = `
      <div class="image-cropper-dialog" role="dialog" aria-modal="true" aria-labelledby="imageCropperTitle">
        <div class="image-cropper-header">
          <div>
            <p class="image-cropper-kicker">Foto do perfil</p>
            <h2 id="imageCropperTitle">Ajustar foto</h2>
          </div>
          <button type="button" class="image-cropper-close" data-cropper-cancel aria-label="Fechar">×</button>
        </div>
        <div class="image-cropper-stage">
          <img alt="" draggable="false" />
          <div class="image-cropper-mask" aria-hidden="true"></div>
          <div class="image-cropper-frame" aria-hidden="true"></div>
        </div>
        <label class="image-cropper-slider">
          <span>Zoom</span>
          <input type="range" min="1" max="3" step="0.01" value="1" />
        </label>
        <div class="image-cropper-actions">
          <button type="button" class="btn btn-outline" data-cropper-cancel>Cancelar</button>
          <button type="button" class="btn btn-primary" data-cropper-save>Usar foto</button>
        </div>
      </div>
    `;
    return modal;
  }

  window.openImageCropper = async function openImageCropper(input) {
    const dataUrl = await readImageInput(input);

    return new Promise((resolve, reject) => {
      const modal = createCropperMarkup();
      const stage = modal.querySelector('.image-cropper-stage');
      const img = modal.querySelector('img');
      const slider = modal.querySelector('input[type="range"]');
      const saveBtn = modal.querySelector('[data-cropper-save]');
      const cancelBtns = modal.querySelectorAll('[data-cropper-cancel]');

      let stageRect = null;
      let frameSize = 0;
      let baseScale = 1;
      let zoom = 1;
      let offsetX = 0;
      let offsetY = 0;
      let dragState = null;

      function close(result) {
        modal.remove();
        document.body.classList.remove('cropper-open');
        resolve(result);
      }

      function measure() {
        stageRect = stage.getBoundingClientRect();
        frameSize = Math.min(stageRect.width, stageRect.height) - 40;
        baseScale = Math.max(frameSize / img.naturalWidth, frameSize / img.naturalHeight);
      }

      function limitOffsets() {
        const renderWidth = img.naturalWidth * baseScale * zoom;
        const renderHeight = img.naturalHeight * baseScale * zoom;
        const maxX = Math.max(0, (renderWidth - frameSize) / 2);
        const maxY = Math.max(0, (renderHeight - frameSize) / 2);

        offsetX = clamp(offsetX, -maxX, maxX);
        offsetY = clamp(offsetY, -maxY, maxY);
      }

      function render() {
        measure();
        limitOffsets();

        const renderWidth = img.naturalWidth * baseScale * zoom;
        const renderHeight = img.naturalHeight * baseScale * zoom;

        img.style.width = `${renderWidth}px`;
        img.style.height = `${renderHeight}px`;
        img.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
      }

      function exportCrop() {
        measure();
        limitOffsets();

        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;

        const ctx = canvas.getContext('2d');
        const scale = baseScale * zoom;
        const imageLeft = stageRect.width / 2 - (img.naturalWidth * scale) / 2 + offsetX;
        const imageTop = stageRect.height / 2 - (img.naturalHeight * scale) / 2 + offsetY;
        const frameLeft = (stageRect.width - frameSize) / 2;
        const frameTop = (stageRect.height - frameSize) / 2;

        const sx = (frameLeft - imageLeft) / scale;
        const sy = (frameTop - imageTop) / scale;
        const sourceSize = frameSize / scale;

        ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        return canvas.toDataURL('image/jpeg', 0.9);
      }

      cancelBtns.forEach((button) => {
        button.addEventListener('click', () => close(null));
      });

      modal.addEventListener('click', (event) => {
        if (event.target === modal) close(null);
      });

      document.addEventListener('keydown', function onKeyDown(event) {
        if (!modal.isConnected) {
          document.removeEventListener('keydown', onKeyDown);
          return;
        }
        if (event.key === 'Escape') close(null);
      });

      slider.addEventListener('input', () => {
        zoom = Number(slider.value);
        render();
      });

      stage.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        stage.setPointerCapture(event.pointerId);
        dragState = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: offsetX,
          originY: offsetY,
        };
      });

      stage.addEventListener('pointermove', (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        offsetX = dragState.originX + event.clientX - dragState.startX;
        offsetY = dragState.originY + event.clientY - dragState.startY;
        render();
      });

      stage.addEventListener('pointerup', () => {
        dragState = null;
      });

      stage.addEventListener('pointercancel', () => {
        dragState = null;
      });

      saveBtn.addEventListener('click', () => {
        try {
          close(exportCrop());
        } catch (error) {
          reject(error);
        }
      });

      img.onload = () => {
        document.body.appendChild(modal);
        document.body.classList.add('cropper-open');
        requestAnimationFrame(render);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };
})();
