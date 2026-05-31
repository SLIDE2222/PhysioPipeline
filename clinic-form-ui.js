(function () {
  const MAX_CLINIC_TEAM = 5;
  const DEFAULT_SERVICE_LIMIT = 5;

  function normalizeKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function cleanTag(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function uniqueTags(values, limit = Number.POSITIVE_INFINITY) {
    const seen = new Set();

    return (values || [])
      .map(cleanTag)
      .filter(Boolean)
      .filter((value) => {
        const key = normalizeKey(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);
  }

  function parseServices(value, limit = DEFAULT_SERVICE_LIMIT) {
    if (Array.isArray(value)) return uniqueTags(value, limit);

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return uniqueTags(parsed, limit);
      } catch (_) {
        // keep legacy string fallback below
      }

      return uniqueTags(value.split(/[,\n/|]/), limit);
    }

    return [];
  }

  function parseTeam(value) {
    const rawValues = Array.isArray(value)
      ? value
      : (() => {
          if (typeof value !== 'string') return [];
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch (_) {
            return [];
          }
        })();

    return rawValues
      .map((item) => ({
        name: cleanTag(item?.name || ''),
        specialty: cleanTag(item?.specialty || ''),
      }))
      .filter((item) => item.name || item.specialty)
      .slice(0, MAX_CLINIC_TEAM);
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function createTagEditor({
    inputId,
    listId,
    hiddenInputId,
    addButtonId,
    limitMessageId,
    limit = DEFAULT_SERVICE_LIMIT,
    limitMessage = '',
  }) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    const hiddenInput = hiddenInputId ? document.getElementById(hiddenInputId) : null;
    const addButton = addButtonId ? document.getElementById(addButtonId) : null;
    const limitMessageNode = limitMessageId ? document.getElementById(limitMessageId) : null;

    if (!input || !list) return null;

    const state = { values: [] };

    function syncHiddenValue() {
      if (hiddenInput) hiddenInput.value = JSON.stringify(state.values);
    }

    function updateControls() {
      const reachedLimit = state.values.length >= limit;

      if (addButton) {
        addButton.disabled = reachedLimit;
      }

      if (limitMessageNode) {
        limitMessageNode.textContent = reachedLimit ? limitMessage : '';
      }
    }

    function render() {
      list.innerHTML = state.values
        .map(
          (value, index) => `
        <span class="profile-badge tag-pill-item">
          <span>${escapeAttr(value)}</span>
          <button type="button" class="tag-pill-remove" data-tag-index="${index}" aria-label="Remover ${escapeAttr(value)}">
            x
          </button>
        </span>
      `
        )
        .join('');

      syncHiddenValue();
      updateControls();
    }

    function addTag(rawValue) {
      const nextValue = cleanTag(rawValue);
      if (!nextValue) return false;

      const nextValues = uniqueTags([...state.values, nextValue], limit);
      if (nextValues.length === state.values.length) {
        input.value = '';
        render();
        return false;
      }

      state.values = nextValues;
      input.value = '';
      render();
      input.dispatchEvent(new CustomEvent('tag-editor:add', { bubbles: true }));
      return true;
    }

    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addTag(input.value);
    });

    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tag-index]');
      if (!button) return;

      const index = Number.parseInt(button.dataset.tagIndex || '-1', 10);
      if (Number.isNaN(index) || index < 0) return;

      state.values.splice(index, 1);
      render();
    });

    if (addButton) {
      addButton.addEventListener('click', () => {
        addTag(input.value);
        input.focus();
      });
    }

    return {
      setValue(value) {
        state.values = parseServices(value, limit);
        render();
      },
      getValue() {
        state.values = uniqueTags(state.values, limit);
        syncHiddenValue();
        updateControls();
        return [...state.values];
      },
      addTag,
      clearInput() {
        input.value = '';
      },
    };
  }

  function createClinicEditor({
    serviceInputId,
    serviceListId,
    hiddenServicesInputId,
    addServiceButtonId,
    serviceLimitMessageId,
    serviceLimitMessage = 'Limite de 5 especialidades/servicos atingido.',
    teamRowsId,
    addTeamButtonId,
  }) {
    const teamRows = teamRowsId ? document.getElementById(teamRowsId) : null;
    const addTeamButton = addTeamButtonId ? document.getElementById(addTeamButtonId) : null;
    const serviceEditor = createTagEditor({
      inputId: serviceInputId,
      listId: serviceListId,
      hiddenInputId: hiddenServicesInputId,
      addButtonId: addServiceButtonId,
      limitMessageId: serviceLimitMessageId,
      limit: DEFAULT_SERVICE_LIMIT,
      limitMessage: serviceLimitMessage,
    });

    if (!serviceEditor) {
      return null;
    }

    const state = {
      team: [],
    };

    const hasTeamEditor = Boolean(teamRows && addTeamButton);

    function normalizeTeam() {
      if (!hasTeamEditor) return;
      state.team = Array.from(teamRows.querySelectorAll('.clinic-team-row')).map((row) => ({
        name: cleanTag(row.querySelector('[data-team-name]')?.value || ''),
        specialty: cleanTag(row.querySelector('[data-team-specialty]')?.value || ''),
      }));
    }

    function updateTeamControls() {
      if (!hasTeamEditor) return;
      const rows = Array.from(teamRows.querySelectorAll('.clinic-team-row'));
      const canAddMore = rows.length < MAX_CLINIC_TEAM;
      addTeamButton.disabled = !canAddMore;
      addTeamButton.hidden = !canAddMore;

      rows.forEach((row) => {
        const removeButton = row.querySelector('[data-remove-team-row]');
        if (!removeButton) return;
        removeButton.hidden = rows.length === 1;
      });
    }

    function renderTeamRows() {
      if (!hasTeamEditor) return;
      teamRows.innerHTML = state.team
        .map(
          (member, index) => `
        <div class="clinic-team-row">
          <input
            type="text"
            value="${escapeAttr(member.name)}"
            placeholder="Nome do fisioterapeuta"
            data-team-name
          />
          <input
            type="text"
            value="${escapeAttr(member.specialty)}"
            placeholder="Especialidade"
            data-team-specialty
          />
          <button
            type="button"
            class="clinic-team-remove-btn"
            data-remove-team-row="${index}"
            aria-label="Remover fisioterapeuta"
          >
            x
          </button>
        </div>
      `
        )
        .join('');

      if (!state.team.length) {
        state.team = [{ name: '', specialty: '' }];
        renderTeamRows();
        return;
      }

      updateTeamControls();

      teamRows.querySelectorAll('.clinic-team-row input').forEach((input) => {
        input.addEventListener('input', normalizeTeam);
      });

      teamRows.querySelectorAll('[data-remove-team-row]').forEach((button) => {
        button.addEventListener('click', () => {
          const index = Number.parseInt(button.dataset.removeTeamRow || '-1', 10);
          if (Number.isNaN(index) || index < 0) return;

          state.team.splice(index, 1);
          if (!state.team.length) {
            state.team.push({ name: '', specialty: '' });
          }
          renderTeamRows();
        });
      });
    }

    if (hasTeamEditor) {
      addTeamButton.addEventListener('click', () => {
        if (state.team.length >= MAX_CLINIC_TEAM) return;
        normalizeTeam();
        state.team.push({ name: '', specialty: '' });
        renderTeamRows();
      });
    }

    return {
      setValue({ services, team }) {
        serviceEditor.setValue(services);
        if (hasTeamEditor) {
          state.team = parseTeam(team);
          if (!state.team.length) state.team = [{ name: '', specialty: '' }];
          renderTeamRows();
        } else {
          state.team = [];
        }
      },
      getValue() {
        if (hasTeamEditor) {
          normalizeTeam();
        }
        return {
          services: serviceEditor.getValue(),
          team: hasTeamEditor
            ? state.team
                .map((member) => ({
                  name: cleanTag(member.name || ''),
                  specialty: cleanTag(member.specialty || ''),
                }))
                .filter((member) => member.name && member.specialty)
                .slice(0, MAX_CLINIC_TEAM)
            : [],
        };
      },
      addServiceTag(value) {
        return serviceEditor.addTag(value);
      },
      clearInput() {
        serviceEditor.clearInput();
      },
    };
  }

  window.PhysioClinicForm = {
    createTagEditor,
    createClinicEditor,
    parseServices,
    parseTeam,
  };
})();