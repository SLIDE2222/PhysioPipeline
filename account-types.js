(function () {
  const ACCOUNT_TYPES = Object.freeze({
    PHYSIO: 'physio',
    CLINIC: 'clinic',
  });

  const ACCOUNT_TYPE_META = Object.freeze({
    [ACCOUNT_TYPES.PHYSIO]: {
      value: ACCOUNT_TYPES.PHYSIO,
      label: 'Fisioterapeuta',
      shortLabel: 'Sou fisioterapeuta',
      badge: '🧑 Fisioterapeuta',
    },
    [ACCOUNT_TYPES.CLINIC]: {
      value: ACCOUNT_TYPES.CLINIC,
      label: 'Clinica',
      shortLabel: 'Sou clinica',
      badge: '🏥 Clinica',
    },
  });

  function normalizeAccountType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return ACCOUNT_TYPE_META[normalized] ? normalized : ACCOUNT_TYPES.PHYSIO;
  }

  function getAccountTypeMeta(value) {
    return ACCOUNT_TYPE_META[normalizeAccountType(value)];
  }

  window.PhysioAccountTypes = {
    ACCOUNT_TYPES,
    ACCOUNT_TYPE_META,
    normalizeAccountType,
    getAccountTypeMeta,
  };
})();
