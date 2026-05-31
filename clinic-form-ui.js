(function () {
  const MAX_CLINIC_TEAM = 5;

  function normalizeKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function uniqueServices(values) {
    const seen = new Set();

    return (values || [])
      .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((value) => {
        const key = normalizeKey(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function parseServices(value) {
    if (Array.isArray(value)) return uniqueServices(value);

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return uniqueServices(parsed);
      } catch (_) {
        // keep legacy string fallback below
      }

      return uniqueServices(value.split(/[,\n/|]/));
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
        name: String(item?.name || '').replace(/\s+/g, ' ').trim(),
        specialty: String(item?.specialty || '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((item) => item.name || item.specialty)
      .slice(0, MAX_CLINIC_TEAM);
  }

  function createClinicEditor({
    serviceInputId,
    serviceListId,
    hiddenServicesInputId,
    teamRowsId,
    addTeamButtonId,
  }) {
    const serviceInput = document.getElementById(serviceInputId);
    const serviceList = document.getElementById(serviceListId);
    const hiddenServicesInput = document.getElementById(hiddenServicesInputId);
    const teamRows = document.getElementById(teamRowsId);
    const addTeamButton = document.getElementById(addTeamButtonId);

    if (!serviceInput || !serviceList || !hiddenServicesInput || !teamRows || !addTeamButton) {
      return null;
    }

    const state = {
      services: [],
      team: [],
    };

    function syncServicesValue() {
      hiddenServicesInput.value = JSON.stringify(state.services);
    }

    function renderServices() {
      serviceList.innerHTML = state.services.map((service, index) => `
        <span class="profile-badge tag-pill-item">
          <span>${service}</span>
          <button type="button" class="tag-pill-remove" data-service-index="${index}" aria-label="Remover ${service}">
            ×
          </button>
        </span>
      `).join('');

      syncServicesValue();
    }

    function addService(rawValue) {
      const nextValue = String(rawValue || '').replace(/\s+/g, ' ').trim();
      if (!nextValue) return;

      const uniqueNext = uniqueServices([...state.services, nextValue]);
      state.services = uniqueNext;
      serviceInput.value = '';
      renderServices();
    }

    function normalizeTeam() {
      state.team = Array.from(teamRows.querySelectorAll('.clinic-team-row')).map((row) => ({
        name: row.querySelector('[data-team-name]')?.value?.replace(/\s+/g, ' ').trim() || '',
        specialty: row.querySelector('[data-team-specialty]')?.value?.replace(/\s+/g, ' ').trim() || '',
      }));
    }

    function updateTeamControls() {
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
      teamRows.innerHTML = state.team.map((member, index) => `
        <div class="clinic-team-row">
          <input
            type="text"
            value="${member.name.replace(/"/g, '&quot;')}"
            placeholder="Nome do fisioterapeuta"
            data-team-name
          />
          <input
            type="text"
            value="${member.specialty.replace(/"/g, '&quot;')}"
            placeholder="Especialidade"
            data-team-specialty
          />
          <button
            type="button"
            class="clinic-team-remove-btn"
            data-remove-team-row="${index}"
            aria-label="Remover fisioterapeuta"
          >
            ×
          </button>
        </div>
      `).join('');

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

    serviceInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addService(serviceInput.value);
    });

    serviceList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-service-index]');
      if (!button) return;

      const index = Number.parseInt(button.dataset.serviceIndex || '-1', 10);
      if (Number.isNaN(index) || index < 0) return;

      state.services.splice(index, 1);
      renderServices();
    });

    addTeamButton.addEventListener('click', () => {
      if (state.team.length >= MAX_CLINIC_TEAM) return;
      normalizeTeam();
      state.team.push({ name: '', specialty: '' });
      renderTeamRows();
    });

    return {
      setValue({ services, team }) {
        state.services = parseServices(services);
        state.team = parseTeam(team);
        if (!state.team.length) state.team = [{ name: '', specialty: '' }];
        renderServices();
        renderTeamRows();
      },
      getValue() {
        normalizeTeam();
        return {
          services: uniqueServices(state.services),
          team: state.team
            .map((member) => ({
              name: String(member.name || '').replace(/\s+/g, ' ').trim(),
              specialty: String(member.specialty || '').replace(/\s+/g, ' ').trim(),
            }))
            .filter((member) => member.name && member.specialty)
            .slice(0, MAX_CLINIC_TEAM),
        };
      },
      clearInput() {
        serviceInput.value = '';
      },
    };
  }

  window.PhysioClinicForm = {
    createClinicEditor,
    parseServices,
    parseTeam,
  };
})();
