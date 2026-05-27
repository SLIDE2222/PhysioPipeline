(function () {
  const generatedTaxonomy = window.PhysioGeneratedTaxonomy || {};

  const coreSpecialties = [
    'Fisioterapia Ortopedica',
    'Fisioterapia Esportiva',
    'Fisioterapia Neurologica',
    'Fisioterapia Geriatrica',
    'Fisioterapia Respiratoria',
    'Fisioterapia Pediatrica',
    'Fisioterapia do Trabalho',
    'Fisioterapia Ocupacional',
    'Fisioterapia Dermatofuncional',
    'Fisioterapia Pelvica',
    'Fisioterapia Cardiovascular',
    'Fisioterapia Aquatica',
    'Fisioterapia Home Care',
    'Fisioterapia Domiciliar',
    'Fisioterapia Traumato-Ortopedica',
    'Fisioterapia Reumatologica',
    'Fisioterapia Oncologica',
    'Fisioterapia Hospitalar',
    'Quiropraxia',
    'Pilates',
    'Pilates Clinico',
    'RPG',
    'Terapia Manual',
    'Liberacao Miofascial',
    'Ventosaterapia',
    'Drenagem Linfatica',
    'Pos-operatorio',
    'Ergonomia',
    'Osteopatia',
    'Acupuntura',
  ];

  const treatmentTags = [
    'Dor lombar',
    'Dor cervical',
    'Dor no joelho',
    'Dor no ombro',
    'Dor no quadril',
    'Dor no tornozelo',
    'Dor no punho',
    'Dor na mao',
    'Dedo em gatilho',
    'Hernia de disco',
    'Ciatica',
    'Escoliose',
    'Ma postura',
    'Bursite',
    'Tendinite',
    'Fascite plantar',
    'Artrose',
    'Artrite',
    'Fibromialgia',
    'LER/DORT',
    'Lesao muscular',
    'Entorse',
    'Fratura',
    'Luxacao',
    'Menisco',
    'Ligamento cruzado',
    'Condromalacia patelar',
    'Manguito rotador',
    'Epicondilite',
    'Tunel do carpo',
    'Reabilitacao esportiva',
    'Reabilitacao neurologica',
    'Reabilitacao respiratoria',
    'Reabilitacao pos-operatoria',
    'Mobilidade reduzida',
    'Equilibrio',
    'Prevencao de quedas',
    'Fortalecimento muscular',
    'Alongamento',
    'Treino de marcha',
    'Asma',
    'Bronquite',
    'DPOC',
    'AVC',
    'Parkinson',
    'Paralisia cerebral',
    'Incontinencia urinaria',
    'Dor pelvica',
    'Gestacao',
    'Pos-parto',
  ];

  const audienceTags = [
    'Idosos',
    'Atletas',
    'Gestantes',
    'Criancas',
    'Bebes',
    'Corredores',
    'Trabalhadores',
    'Pacientes neurologicos',
    'Pacientes respiratorios',
    'Pacientes pos-cirurgicos',
    'Pessoas com dor cronica',
    'Pessoas com mobilidade reduzida',
  ];

  const manualSeoSearchCombinations = [
    'Fisioterapia esportiva para dor no joelho',
    'Fisioterapia ortopedica para dor lombar',
    'Fisioterapia ocupacional para LER DORT',
    'Fisioterapia do trabalho para ergonomia',
    'Pilates clinico para hernia de disco',
    'RPG para postura',
    'RPG para escoliose',
    'Fisioterapia domiciliar para idosos',
    'Fisioterapia respiratoria para asma',
    'Fisioterapia neurologica para AVC',
    'Fisioterapia pelvica para incontinencia urinaria',
    'Terapia manual para dor cervical',
    'Liberacao miofascial para dor muscular',
    'Quiropraxia para dor nas costas',
    'Fisioterapia pediatrica para bebe',
    'Fisioterapia geriatrica para equilibrio',
    'Fisioterapia pos-operatoria para joelho',
    'Fisioterapia para dedo em gatilho',
    'Fisioterapia para tunel do carpo',
    'Fisioterapia para tendinite no ombro',
  ];

  const searchSynonymGroups = [
    {
      triggers: ['dedo em gatilho', 'gatilho', 'dedo travando', 'dedo preso'],
      terms: ['dedo em gatilho', 'mao', 'punho', 'tendao', 'tendinite', 'tunel do carpo', 'ler', 'dort', 'ortopedica', 'ocupacional', 'trabalho', 'terapia manual'],
    },
    {
      triggers: ['dor lombar', 'lombar', 'coluna', 'costas', 'ciatica', 'nervo ciatico', 'hernia de disco'],
      terms: ['dor lombar', 'lombar', 'coluna', 'costas', 'ciatica', 'hernia de disco', 'ortopedica', 'quiropraxia', 'pilates clinico', 'rpg', 'ocupacional', 'ergonomia'],
    },
    {
      triggers: ['pescoco', 'pescoço', 'dor no pescoco', 'dor no pescoço', 'cervical', 'dor cervical', 'torcicolo'],
      terms: ['pescoco', 'cervical', 'dor cervical', 'coluna', 'ortopedica', 'rpg', 'postura', 'terapia manual', 'quiropraxia', 'musculoesqueletica', 'reabilitacao'],
    },
    {
      triggers: ['dor no joelho', 'joelho', 'menisco', 'ligamento', 'acl', 'lca', 'condromalacia'],
      terms: ['joelho', 'menisco', 'ligamento', 'condromalacia', 'ortopedica', 'esportiva', 'pos-operatorio', 'reabilitacao esportiva'],
    },
    {
      triggers: ['ombro', 'dor no ombro', 'manguito', 'bursite', 'tendinite no ombro'],
      terms: ['ombro', 'manguito', 'bursite', 'tendinite', 'ortopedica', 'esportiva', 'terapia manual', 'liberacao miofascial'],
    },
    {
      triggers: ['avc', 'derrame', 'paralisia', 'neurologico', 'neurologica', 'parkinson'],
      terms: ['avc', 'derrame', 'paralisia', 'parkinson', 'neurologica', 'reabilitacao neurologica', 'treino de marcha'],
    },
    {
      triggers: ['asma', 'respiracao', 'respiratoria', 'pulmao', 'bronquite', 'dpoc'],
      terms: ['asma', 'respiracao', 'respiratoria', 'pulmao', 'bronquite', 'dpoc', 'reabilitacao respiratoria'],
    },
    {
      triggers: ['trabalho', 'ergonomia', 'ler', 'dort', 'tendinite', 'escritorio', 'home office'],
      terms: ['trabalho', 'ergonomia', 'ocupacional', 'fisioterapia do trabalho', 'ler', 'dort', 'tendinite', 'postura', 'mao', 'punho', 'lombar'],
    },
    {
      triggers: ['pos operatorio', 'pos-operatorio', 'cirurgia', 'operou', 'recuperacao'],
      terms: ['pos-operatorio', 'cirurgia', 'recuperacao', 'reabilitacao pos-operatoria', 'ortopedica', 'traumato-ortopedica'],
    },
    {
      triggers: ['crianca', 'bebe', 'infantil', 'pediatrica', 'pediatria'],
      terms: ['pediatrica', 'pediatria', 'crianca', 'bebe', 'infantil'],
    },
    {
      triggers: ['idoso', 'idosa', 'geriatrica', 'equilibrio', 'queda'],
      terms: ['geriatrica', 'idoso', 'idosa', 'equilibrio', 'queda', 'mobilidade reduzida', 'prevencao de quedas'],
    },
    {
      triggers: ['gestante', 'gravida', 'gravidez', 'pos parto', 'pos-parto', 'incontinencia', 'dor pelvica'],
      terms: ['pelvica', 'gestante', 'gravidez', 'pos-parto', 'incontinencia urinaria', 'dor pelvica'],
    },
  ];

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function uniqueByNormalized(values) {
    const seen = new Set();
    const result = [];

    values.forEach((value) => {
      const cleanValue = String(value || '').trim();
      const key = normalizeText(cleanValue);

      if (!cleanValue || seen.has(key)) return;
      seen.add(key);
      result.push(cleanValue);
    });

    return result;
  }

  const mergedCoreSpecialties = uniqueByNormalized([
    ...coreSpecialties,
    ...(generatedTaxonomy.coreSpecialties || []),
  ]);

  const mergedTreatmentTags = uniqueByNormalized([
    ...treatmentTags,
    ...(generatedTaxonomy.treatmentTags || []),
  ]);

  const mergedAudienceTags = uniqueByNormalized([
    ...audienceTags,
    ...(generatedTaxonomy.audienceTags || []),
  ]);

  const seoSearchCombinations = uniqueByNormalized([
    ...manualSeoSearchCombinations,
    ...(generatedTaxonomy.seoSearchCombinations || []),
    ...coreSpecialties.flatMap((specialty) =>
      treatmentTags.map((tag) => `${specialty} para ${tag}`)
    ),
    ...coreSpecialties.flatMap((specialty) =>
      audienceTags.map((tag) => `${specialty} para ${tag}`)
    ),
  ]);

  const profileSpecialtyOptions = uniqueByNormalized([
    'Fisioterapia Ortopedica',
    'Fisioterapia Esportiva',
    'Fisioterapia Neurologica',
    'Fisioterapia Geriatrica',
    'Fisioterapia Respiratoria',
    'Pilates',
    'Domicilar',
    'Fisioterapia Ocupacional',
    'Quiropraxia',
    'Fisioterapia Pediatrica',
    'Ventosaterapia',
    'Pos-operatorio',
    'Fisioterapia do Trabalho',
    'Fisioterapia Dermatofuncional',
    'Fisioterapia Pelvica',
    'Fisioterapia Cardiovascular',
    'Fisioterapia Aquatica',
    'Fisioterapia Home Care',
    'Fisioterapia Domiciliar',
    'Ergonomia',
    ...coreSpecialties,
  ]);

  const autocompleteSpecialtyOptions = uniqueByNormalized([
    ...profileSpecialtyOptions,
    ...treatmentTags,
    ...audienceTags,
    ...seoSearchCombinations,
  ]);

  window.PhysioTaxonomy = {
    coreSpecialties: mergedCoreSpecialties,
    treatmentTags: mergedTreatmentTags,
    audienceTags: mergedAudienceTags,
    seoSearchCombinations,
    searchSynonymGroups: [
      ...searchSynonymGroups,
      ...(generatedTaxonomy.searchSynonymGroups || []),
    ],
    profileSpecialtyOptions,
    autocompleteSpecialtyOptions,
  };
})();
