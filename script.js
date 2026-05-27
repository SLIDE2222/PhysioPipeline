let cachedMyProfile = null;

const EXISTING_SPECIALTIES = [
  'Fisioterapia Ortopédica',
  'Fisioterapia Esportiva',
  'Fisioterapia Neurológica',
  'Fisioterapia Geriátrica',
  'Fisioterapia Respiratória',
  'Pilates',
  'Domicilar',
  'Fisioterapia Ocupacional',
  'Quiropraxia',
  'Fisioterapia Pediátrica',
  'Ventosaterapia',
  'Pós-operatório'
];

const SPECIALTIES = window.PhysioTaxonomy?.profileSpecialtyOptions || EXISTING_SPECIALTIES;

const CITY_NEIGHBORHOODS = {
  'São Paulo': [
    'Bela Vista',
    'Butantã',
    'Ipiranga',
    'Lapa',
    'Mooca',
    'Pinheiros',
    'Santana',
    'Santo Amaro',
    'Campo Belo',
    'Tatuapé',
    'Vila Mariana'
  ],
  'Sorocaba': [
    'Campolim',
    'Centro',
    'Éden',
    'Jardim Europa',
    'Santa Rosália',
    'Vila Haro',
    'Wanel Ville'
  ],
  'Itapetininga': [
    'Centro',
    'Chapada Grande',
    'Jardim Fogaça',
    'Jardim Marabá',
    'Vila Aparecida',
    'Vila Nastri',
    'Vila Rio Branco'
  ]
};

const CITIES = Object.keys(CITY_NEIGHBORHOODS);

let dynamicCityOptions = [];
let dynamicSpecialtyOptions = [];
let dynamicNeighborhoodOptions = [];
let dynamicNeighborhoodOptionsByCity = {};
let dynamicOptionsLoaded = false;

const DYNAMIC_OPTIONS_CACHE_KEY = 'physioDynamicOptions:v1';
const DYNAMIC_OPTIONS_CACHE_MS = 0;
const OPTION_SORTER = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
  numeric: true,
});

const PATIENT_SEARCH_MAP = [
  {
    triggers: ['dedo em gatilho', 'gatilho', 'dedo travando', 'dedo preso'],
    terms: ['dedo em gatilho', 'mao', 'punho', 'tendao', 'tendinite', 'ler', 'dort', 'ortopedica', 'ocupacional', 'trabalho', 'reabilitacao'],
  },
  {
    triggers: ['dor lombar', 'lombar', 'coluna', 'costas', 'ciatica', 'nervo ciatico', 'hernia de disco'],
    terms: ['lombar', 'coluna', 'costas', 'ciatica', 'hernia', 'ortopedica', 'quiropraxia', 'pilates', 'ocupacional', 'ergonomia'],
  },
  {
    triggers: ['dor no joelho', 'joelho', 'menisco', 'ligamento', 'acl', 'lca'],
    terms: ['joelho', 'menisco', 'ligamento', 'ortopedica', 'esportiva', 'pos-operatorio', 'reabilitacao'],
  },
  {
    triggers: ['ombro', 'dor no ombro', 'manguito', 'bursite', 'tendinite no ombro'],
    terms: ['ombro', 'manguito', 'bursite', 'tendinite', 'ortopedica', 'esportiva', 'reabilitacao'],
  },
  {
    triggers: ['avc', 'derrame', 'paralisia', 'neurologico', 'neurologica'],
    terms: ['avc', 'derrame', 'paralisia', 'neurologica', 'neuro', 'reabilitacao'],
  },
  {
    triggers: ['asma', 'respiracao', 'respiratoria', 'pulmao', 'bronquite', 'dpoc'],
    terms: ['asma', 'respiracao', 'respiratoria', 'pulmao', 'bronquite', 'dpoc'],
  },
  {
    triggers: ['trabalho', 'ergonomia', 'ler', 'dort', 'tendinite', 'escritorio', 'home office'],
    terms: ['trabalho', 'ergonomia', 'ocupacional', 'ler', 'dort', 'tendinite', 'postura', 'mao', 'punho', 'lombar'],
  },
  {
    triggers: ['pos operatorio', 'cirurgia', 'operou', 'recuperacao'],
    terms: ['pos-operatorio', 'pos operatorio', 'cirurgia', 'recuperacao', 'reabilitacao', 'ortopedica'],
  },
  {
    triggers: ['crianca', 'bebe', 'infantil', 'pediatrica', 'pediatria'],
    terms: ['pediatrica', 'pediatria', 'crianca', 'bebe', 'infantil'],
  },
  {
    triggers: ['idoso', 'idosa', 'geriatrica', 'equilibrio', 'queda'],
    terms: ['geriatrica', 'idoso', 'idosa', 'equilibrio', 'queda', 'mobilidade'],
  },
];

const SYMPTOM_RELEVANCE_MAP = {
  joelho: {
    triggers: ['joelho', 'dor no joelho', 'menisco', 'ligamento', 'lca', 'acl'],
    keywords: [
      'joelho',
      'dor no joelho',
      'menisco',
      'ligamento',
      'lca',
      'acl',
      'ortopedica',
      'fisioterapia ortopedica',
      'esportiva',
      'reabilitacao',
      'mobilidade',
      'pos operatorio',
      'pos-operatorio',
      'trauma',
      'lesao',
    ],
    unrelated: [
      'dermatofuncional',
      'estetica',
      'drenagem',
      'facial',
      'harmonizacao',
      'uroginecologica',
      'pelvica',
      'respiratoria',
    ],
  },
  ombro: {
    triggers: ['ombro', 'dor no ombro', 'manguito', 'manguito rotador', 'bursite'],
    keywords: ['ombro', 'manguito', 'manguito rotador', 'bursite', 'tendinite', 'ortopedica', 'esportiva', 'reabilitacao', 'mobilidade'],
    unrelated: ['dermatofuncional', 'estetica', 'facial', 'drenagem', 'respiratoria', 'pelvica'],
  },
  coluna: {
    triggers: ['coluna', 'costas', 'dor lombar', 'lombar', 'lombalgia', 'cervical', 'hernia', 'ciatica'],
    keywords: ['coluna', 'costas', 'lombalgia', 'cervical', 'rpg', 'postura', 'dor lombar', 'hernia', 'ciatica', 'ortopedica', 'quiropraxia', 'pilates'],
    unrelated: ['dermatofuncional', 'estetica', 'facial', 'drenagem', 'respiratoria'],
  },
  pele: {
    triggers: ['pele', 'estetica', 'dermatofuncional', 'drenagem', 'cicatriz', 'fibrose'],
    keywords: ['dermatofuncional', 'estetica', 'drenagem', 'pos operatorio estetico', 'fibrose', 'cicatriz'],
    unrelated: ['ortopedica', 'esportiva', 'neurologica', 'respiratoria'],
  },
  mao: {
    triggers: ['mao', 'punho', 'dedo em gatilho', 'gatilho', 'tendinite', 'ler', 'dort'],
    keywords: ['mao', 'punho', 'dedo em gatilho', 'tendinite', 'ler', 'dort', 'ortopedica', 'ocupacional', 'reabilitacao', 'trabalho'],
    unrelated: ['dermatofuncional', 'estetica', 'facial', 'drenagem', 'respiratoria'],
  },
};

const STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'com', 'para', 'por', 'um', 'uma', 'o', 'a', 'e']);

const GENERIC_QUERY_TERMS = new Set([
  'dor',
  'tratamento',
  'fisioterapia',
  'problema',
  'lesao',
  'incomodo',
  'consulta',
  'dores',
  'reabilitacao',
  'sintoma',
  'machucado',
]);

const INTENT_RULES = [
  {
    id: 'pelvica',
    label: 'Fisioterapia Pélvica / Uroginecológica',
    triggers: ['perereca', 'vagina', 'vaginal', 'perineo', 'pelvica', 'pelvico', 'assoalho pelvico', 'assoalho', 'xixi', 'incontinencia', 'urina', 'bexiga', 'escape de urina'],
    specialtyKeywords: ['pelvica', 'uroginecologica', 'perineal'],
    relatedTerms: ['assoalho pelvico', 'perineo', 'incontinencia urinaria', 'urgencia urinaria', 'saude da mulher', 'gestante', 'obstetrica', 'pos parto', 'parto'],
    conflictKeywords: ['ortopedica', 'esportiva', 'traumato', 'quiropraxia', 'dermatofuncional'],
  },
  {
    id: 'obstetrica',
    label: 'Fisioterapia Obstétrica / Pós-parto',
    triggers: ['gravidez', 'gestante', 'gestacao', 'parto', 'pos parto', 'pos-parto', 'puerperio'],
    specialtyKeywords: ['obstetrica', 'pelvica', 'uroginecologica', 'saude da mulher'],
    relatedTerms: ['gestante', 'parto', 'pos parto', 'perineo', 'assoalho pelvico', 'diastase'],
    conflictKeywords: ['ortopedica', 'esportiva', 'quiropraxia', 'dermatofuncional'],
  },
  {
    id: 'joelho',
    label: 'Ortopedia / Esportiva / Traumato-ortopédica',
    triggers: ['joelho', 'dor no joelho', 'menisco', 'ligamento', 'lca', 'acl', 'condromalacia'],
    specialtyKeywords: ['ortopedica', 'esportiva', 'traumato', 'traumato ortopedica'],
    relatedTerms: ['joelho', 'menisco', 'ligamento', 'condromalacia', 'pos operatorio', 'reabilitacao esportiva'],
    conflictKeywords: ['pelvica', 'uroginecologica', 'respiratoria', 'dermatofuncional'],
  },
  {
    id: 'coluna',
    label: 'Coluna / Ortopedia / RPG / Quiropraxia',
    triggers: ['coluna', 'lombar', 'dor lombar', 'costas', 'dor nas costas', 'lombalgia', 'cervical', 'hernia', 'hernia de disco', 'ciatica', 'nervo ciatico'],
    specialtyKeywords: ['coluna', 'ortopedica', 'rpg', 'quiropraxia', 'pilates', 'traumato', 'terapia manual'],
    relatedTerms: ['lombar', 'cervical', 'costas', 'ciatica', 'hernia de disco', 'postura', 'ergonomia'],
    conflictKeywords: ['pelvica', 'uroginecologica', 'dermatofuncional'],
  },
  {
    id: 'ombro',
    label: 'Ortopedia / Esportiva',
    triggers: ['ombro', 'dor no ombro', 'manguito', 'manguito rotador', 'bursite', 'tendinite no ombro'],
    specialtyKeywords: ['ortopedica', 'esportiva', 'traumato', 'terapia manual'],
    relatedTerms: ['ombro', 'manguito', 'bursite', 'tendinite', 'liberacao miofascial'],
    conflictKeywords: ['pelvica', 'uroginecologica', 'respiratoria', 'dermatofuncional'],
  },
  {
    id: 'neuro',
    label: 'Fisioterapia Neurofuncional',
    triggers: ['avc', 'derrame', 'parkinson', 'neurologico', 'neurologica', 'paralisia', 'atraso motor'],
    specialtyKeywords: ['neurologica', 'neurofuncional', 'neuro', 'reabilitacao neurologica'],
    relatedTerms: ['avc', 'parkinson', 'paralisia', 'treino de marcha', 'equilibrio', 'atraso motor'],
    conflictKeywords: ['ortopedica', 'pelvica', 'dermatofuncional'],
  },
  {
    id: 'respiratoria',
    label: 'Fisioterapia Respiratória',
    triggers: ['respirar', 'respiracao', 'respiratoria', 'pulmao', 'folego', 'asma', 'bronquite', 'dpoc'],
    specialtyKeywords: ['respiratoria', 'cardiorrespiratoria', 'pulmonar', 'reabilitacao respiratoria'],
    relatedTerms: ['respirar', 'pulmao', 'folego', 'asma', 'bronquite', 'dpoc'],
    conflictKeywords: ['ortopedica', 'pelvica', 'dermatofuncional'],
  },
  {
    id: 'geriatria',
    label: 'Fisioterapia Geriátrica / Gerontologia',
    triggers: ['idoso', 'idosa', 'geriatria', 'geriatrica', 'gerontologia', 'equilibrio', 'quedas', 'queda'],
    specialtyKeywords: ['geriatrica', 'gerontologia', 'geriatria', 'prevencao de quedas'],
    relatedTerms: ['idoso', 'equilibrio', 'quedas', 'mobilidade reduzida', 'marcha'],
    conflictKeywords: ['pediatrica', 'pelvica', 'esportiva'],
  },
  {
    id: 'pediatrica',
    label: 'Fisioterapia Pediátrica',
    triggers: ['bebe', 'crianca', 'infantil', 'pediatrica', 'pediatria', 'atraso motor'],
    specialtyKeywords: ['pediatrica', 'pediatria', 'infantil'],
    relatedTerms: ['bebe', 'crianca', 'infantil', 'atraso motor', 'desenvolvimento'],
    conflictKeywords: ['geriatrica', 'pelvica', 'esportiva'],
  },
  {
    id: 'pilates',
    label: 'Pilates',
    triggers: ['pilates'],
    specialtyKeywords: ['pilates', 'pilates clinico'],
    relatedTerms: ['pilates', 'postura', 'core'],
    conflictKeywords: [],
  },
];

function cleanOptionLabel(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeOptionLists(...lists) {
  const byKey = new Map();

  lists.flat().forEach((value) => {
    const option = cleanOptionLabel(value);
    if (!option || option === '-') return;

    const key = normalizeText(option);
    if (!key || byKey.has(key)) return;

    byKey.set(key, option);
  });

  return Array.from(byKey.values()).sort((a, b) => OPTION_SORTER.compare(a, b));
}

function applyDynamicOptions(options = {}) {
  dynamicCityOptions = Array.isArray(options.cities) ? options.cities : [];
  dynamicSpecialtyOptions = Array.isArray(options.specialties) ? options.specialties : [];
  dynamicNeighborhoodOptions = Array.isArray(options.neighborhoods) ? options.neighborhoods : [];
  dynamicNeighborhoodOptionsByCity = {};

  Object.entries(options.neighborhoodsByCity || {}).forEach(([city, neighborhoods]) => {
    const cityKey = normalizeText(city);
    if (!cityKey || !Array.isArray(neighborhoods)) return;

    dynamicNeighborhoodOptionsByCity[cityKey] = mergeOptionLists(
      dynamicNeighborhoodOptionsByCity[cityKey] || [],
      neighborhoods
    );
  });

  dynamicOptionsLoaded = true;

  window.PhysioDynamicOptions = {
    cities: getCityOptions(),
    neighborhoods: getNeighborhoodOptions(),
    neighborhoodsByCity: dynamicNeighborhoodOptionsByCity,
    specialties: getSpecialtyAutocompleteOptions(),
  };
}

function readCachedDynamicOptions() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(DYNAMIC_OPTIONS_CACHE_KEY) || 'null');
    if (!cached?.createdAt || Date.now() - cached.createdAt > DYNAMIC_OPTIONS_CACHE_MS) return null;
    return cached.options || null;
  } catch (_) {
    return null;
  }
}

function writeCachedDynamicOptions(options) {
  try {
    sessionStorage.setItem(
      DYNAMIC_OPTIONS_CACHE_KEY,
      JSON.stringify({
        createdAt: Date.now(),
        options,
      })
    );
  } catch (_) {
    // Storage may be unavailable on some private/mobile browsers.
  }
}

async function loadDynamicSearchOptions() {
  if (dynamicOptionsLoaded) return window.PhysioDynamicOptions;

  const cachedOptions = DYNAMIC_OPTIONS_CACHE_MS > 0 ? readCachedDynamicOptions() : null;
  if (cachedOptions) {
    applyDynamicOptions(cachedOptions);
    return window.PhysioDynamicOptions;
  }

  if (!window.physioApi?.fetchProfileOptions) {
    applyDynamicOptions({});
    return window.PhysioDynamicOptions;
  }

  try {
    const options = await window.physioApi.fetchProfileOptions({ useCache: false });
    if (DYNAMIC_OPTIONS_CACHE_MS > 0) writeCachedDynamicOptions(options);
    applyDynamicOptions(options);
  } catch (error) {
    console.warn('Não foi possível carregar opções dinâmicas:', error);
    applyDynamicOptions({});
  }

  return window.PhysioDynamicOptions;
}

function getCityOptions() {
  return mergeOptionLists(CITIES, dynamicCityOptions);
}

function getSpecialtyAutocompleteOptions() {
  return mergeOptionLists(
    SPECIALTIES,
    window.PhysioTaxonomy?.autocompleteSpecialtyOptions || [],
    dynamicSpecialtyOptions
  );
}

function getNeighborhoodOptions(cityValue = '') {
  const typedCity = cleanOptionLabel(cityValue);
  const matchedCity = findExactMatch(getCityOptions(), typedCity) || typedCity;
  const cityKey = normalizeText(matchedCity);

  if (!cityKey) {
    return mergeOptionLists(
      Object.values(CITY_NEIGHBORHOODS).flat(),
      dynamicNeighborhoodOptions
    );
  }

  const defaultCityName = findExactMatch(CITIES, matchedCity);
  const defaultNeighborhoods = defaultCityName ? CITY_NEIGHBORHOODS[defaultCityName] || [] : [];

  const dynamicMatches = [];
  Object.entries(dynamicNeighborhoodOptionsByCity).forEach(([key, neighborhoods]) => {
    if (key === cityKey || key.includes(cityKey) || cityKey.includes(key)) {
      dynamicMatches.push(...neighborhoods);
    }
  });

  return mergeOptionLists(defaultNeighborhoods, dynamicMatches);
}

window.physioSearchOptions = {
  getCities: getCityOptions,
  getSpecialties: getSpecialtyAutocompleteOptions,
  getNeighborhoods: getNeighborhoodOptions,
  loadDynamicOptions: loadDynamicSearchOptions,
};

function getPatientSearchGroups() {
  return [
    ...PATIENT_SEARCH_MAP,
    ...(window.PhysioTaxonomy?.searchSynonymGroups || []),
  ];
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenizeSearch(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function uniqueTerms(terms) {
  return [...new Set(terms.filter(Boolean))];
}

function getMatchedTerms(text, terms) {
  return uniqueTerms(
    terms.filter((term) => textMatchesTerm(text, term))
  );
}

function textMatchesTerm(text, term) {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);

  if (!normalizedText || !normalizedTerm) return false;
  if (normalizedTerm.length <= 3) {
    return tokenizeSearch(normalizedText).includes(normalizedTerm);
  }

  return normalizedText.includes(normalizedTerm);
}

function analyzeSearchIntent(query) {
  const originalQuery = String(query || '').trim();
  const normalizedQuery = normalizeText(originalQuery);
  const tokens = tokenizeSearch(originalQuery);
  const genericTerms = tokens.filter((term) => GENERIC_QUERY_TERMS.has(term));
  const specificTerms = tokens.filter((term) => !GENERIC_QUERY_TERMS.has(term));

  const matchedRules = INTENT_RULES
    .map((rule) => {
      const matchedTriggers = rule.triggers.filter((trigger) =>
        normalizedQuery.includes(normalizeText(trigger))
      );

      if (!matchedTriggers.length) return null;

      return {
        ...rule,
        matchedTriggers,
        triggerStrength: matchedTriggers.reduce(
          (total, trigger) => total + normalizeText(trigger).length,
          0
        ),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.triggerStrength - a.triggerStrength);

  const primaryRule = matchedRules[0] || null;
  const primaryIntent = primaryRule
    ? [...primaryRule.matchedTriggers].sort((a, b) => b.length - a.length)[0]
    : [...specificTerms].sort((a, b) => b.length - a.length)[0] || genericTerms[0] || '';

  const expandedTerms = uniqueTerms([
    ...specificTerms,
    ...genericTerms,
    ...matchedRules.flatMap((rule) => rule.triggers.map(normalizeText)),
    ...matchedRules.flatMap((rule) => rule.specialtyKeywords.map(normalizeText)),
    ...matchedRules.flatMap((rule) => rule.relatedTerms.map(normalizeText)),
  ]);

  return {
    originalQuery,
    normalizedQuery,
    tokens,
    genericTerms,
    specificTerms,
    expandedTerms,
    matchedRules,
    primaryRule,
    primaryIntent,
  };
}

function expandPatientSearch(query) {
  return analyzeSearchIntent(query).expandedTerms;
}

function getProfileNameText(profile) {
  return normalizeText([
    profile.nome,
    profile.name,
    profile.titulo,
    profile.title,
  ].filter(Boolean).join(' '));
}

function getProfileBioText(profile) {
  return normalizeText([
    profile.descricao,
    profile.bio,
    profile.atendimento,
    profile.attendance,
  ].filter(Boolean).join(' '));
}

function getProfileTagText(profile) {
  return normalizeText([
    profile.keywords,
    profile.tags,
    profile.searchKeywords,
    profile.searchTags,
    profile.treatments,
    profile.treatmentTags,
    profile.especialidadeSecundaria,
    profile.secondarySpecialty,
    profile.specialization,
    profile.specialty2,
    profile.extraSpecialty,
  ].flat().filter(Boolean).join(' '));
}

function getProfileSearchText(profile) {
  return normalizeText([
    profile.nome,
    profile.name,
    profile.especialidade,
    profile.specialty,
    profile.especialidadeSecundaria,
    profile.secondarySpecialty,
    profile.specialization,
    profile.specialty2,
    profile.extraSpecialty,
    profile.atendimento,
    profile.attendance,
    profile.descricao,
    profile.bio,
  ].filter(Boolean).join(' '));
}

function getProfileSearchFields(profile) {
  return {
    specialtyText: getSearchableSpecialties(profile),
    bioText: getProfileBioText(profile),
    nameText: getProfileNameText(profile),
    tagText: getProfileTagText(profile),
    cityText: normalizeText(profile.cidade || profile.city),
    neighborhoodText: normalizeText(profile.bairro || profile.neighborhood),
    profileText: getProfileSearchText(profile),
  };
}

function scoreProfileRelevance(profile, analysis, options = {}) {
  const {
    city = '',
    neighborhood = '',
  } = options;

  const fields = getProfileSearchFields(profile);
  const reasons = [];
  let coreScore = 0;
  let locationScore = 0;

  if (analysis.normalizedQuery) {
    if (fields.specialtyText.includes(analysis.normalizedQuery)) {
      coreScore += 120;
      reasons.push(`specialty exact query match: ${analysis.normalizedQuery}`);
    } else if (fields.profileText.includes(analysis.normalizedQuery)) {
      coreScore += 80;
      reasons.push(`profile exact query match: ${analysis.normalizedQuery}`);
    }
  }

  const specialtySpecificMatches = getMatchedTerms(fields.specialtyText, analysis.specificTerms);
  const profileSpecificMatches = getMatchedTerms(fields.profileText, analysis.specificTerms);
  const specialtyRuleMatches = analysis.primaryRule
    ? getMatchedTerms(fields.specialtyText, analysis.primaryRule.specialtyKeywords)
    : [];
  const relatedTerms = analysis.primaryRule
    ? uniqueTerms([
      ...analysis.primaryRule.relatedTerms,
      ...analysis.primaryRule.triggers,
    ])
    : [];
  const relatedMatches = analysis.primaryRule
    ? getMatchedTerms(`${fields.bioText} ${fields.tagText} ${fields.profileText}`, relatedTerms)
    : [];
  const genericMatches = getMatchedTerms(fields.profileText, analysis.genericTerms);
  const conflictMatches =
    analysis.primaryRule && !specialtyRuleMatches.length && !relatedMatches.length
      ? getMatchedTerms(fields.specialtyText, analysis.primaryRule.conflictKeywords || [])
      : [];

  if (specialtyRuleMatches.length) {
    coreScore += 100;
    reasons.push(`mapped specialty match: ${specialtyRuleMatches.join(', ')}`);
  }

  if (specialtySpecificMatches.length) {
    coreScore += 80;
    reasons.push(`specific term in specialty: ${specialtySpecificMatches.join(', ')}`);
  }

  const nonSpecialtySpecificMatches = profileSpecificMatches.filter(
    (term) => !specialtySpecificMatches.includes(term)
  );

  if (nonSpecialtySpecificMatches.length) {
    coreScore += 80;
    reasons.push(`specific term in bio/services: ${nonSpecialtySpecificMatches.join(', ')}`);
  }

  if (relatedMatches.length) {
    coreScore += 50;
    reasons.push(`related concept match: ${relatedMatches.join(', ')}`);
  }

  if (genericMatches.length) {
    coreScore += Math.min(20, genericMatches.length * 10);
    reasons.push(`generic symptom match: ${genericMatches.join(', ')}`);
  }

  if (city) {
    if (fields.cityText === city) {
      locationScore += 15;
      reasons.push(`exact city match: ${city}`);
    } else if (fields.cityText.includes(city)) {
      locationScore += 8;
      reasons.push(`partial city match: ${city}`);
    }
  }

  if (neighborhood) {
    if (fields.neighborhoodText === neighborhood) {
      locationScore += 10;
      reasons.push(`exact neighborhood match: ${neighborhood}`);
    } else if (fields.neighborhoodText.includes(neighborhood)) {
      locationScore += 5;
      reasons.push(`partial neighborhood match: ${neighborhood}`);
    }
  }

  if (
    analysis.genericTerms.length &&
    !analysis.specificTerms.length &&
    genericMatches.length &&
    !specialtyRuleMatches.length &&
    !specialtySpecificMatches.length &&
    !relatedMatches.length
  ) {
    coreScore -= 40;
    reasons.push('only generic terms matched');
  }

  if (conflictMatches.length) {
    coreScore -= 80;
    reasons.push(`specialty conflicts with detected intent: ${conflictMatches.join(', ')}`);
  }

  const score = coreScore + locationScore;
  let tier = 4;

  if (
    coreScore >= 160 ||
    (specialtyRuleMatches.length && (specialtySpecificMatches.length || nonSpecialtySpecificMatches.length || relatedMatches.length))
  ) {
    tier = 1;
  } else if (coreScore >= 80) {
    tier = 2;
  } else if (coreScore > 0) {
    tier = 3;
  }

  return {
    profile,
    score,
    coreScore,
    tier,
    reasons,
    matchedSpecialty: specialtyRuleMatches[0] || specialtySpecificMatches[0] || '',
  };
}

function calculateRelevance(profile, query, expandedTerms = []) {
  const analysis = expandedTerms?.__analysis || analyzeSearchIntent(query);
  return scoreProfileRelevance(profile, analysis).score;
}

function scorePatientMatch(profile, terms, query = '') {
  return calculateRelevance(profile, query, terms);
}

function shuffleArray(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function rankProfilesByRelevance(profiles, analysis, options = {}) {
  const tiers = {
    1: [],
    2: [],
    3: [],
    4: [],
  };

  const rankedProfiles = profiles.map((profile) =>
    scoreProfileRelevance(profile, analysis, options)
  );

  rankedProfiles.forEach((item) => {
    tiers[item.tier].push(item);
  });

  return {
    rankedProfiles,
    ordered: [
      ...shuffleArray(tiers[1]),
      ...shuffleArray(tiers[2]),
      ...shuffleArray(tiers[3]),
      ...shuffleArray(tiers[4]),
    ],
  };
}

function debugRankedResults(query, analysis, rankedResults) {
  const params = new URLSearchParams(window.location.search);
  const shouldDebug =
    window.location.hostname === 'localhost' ||
    params.get('debugSearch') === '1';

  if (!shouldDebug) return;

  console.groupCollapsed(`[search-debug] ${query || '(sem termo)'}`);
  console.log('original query:', analysis.originalQuery);
  console.log('normalized query terms:', analysis.expandedTerms);
  console.log('detected primary intent:', analysis.primaryIntent || '(none)');
  console.log(
    'matched rules:',
    analysis.matchedRules.map((rule) => ({
      label: rule.label,
      triggers: rule.matchedTriggers,
    }))
  );
  console.table(
    rankedResults.map((item) => ({
      profile: item.profile.nome || item.profile.name || 'Fisioterapeuta',
      matchedSpecialty: item.matchedSpecialty || '-',
      score: item.score,
      tier: item.tier,
      reason: item.reasons.join(' | ') || 'no meaningful match',
    }))
  );
  console.groupEnd();
}


function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAuthStorage(retries = 10, delay = 150) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const auth = window.physioApi?.getStoredAuth?.();

    if (auth?.token) return auth;

    await wait(delay);
  }

  return null;
}

function findExactMatch(options, value) {
  const normalizedValue = normalizeText(value);
  return options.find((option) => normalizeText(option) === normalizedValue) || null;
}

function closeSuggestionList(listElement) {
  if (!listElement) return;
  listElement.innerHTML = '';
  listElement.style.display = 'none';
}

function debounce(fn, wait = 350) {
  let timeoutId = null;

  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), wait);
  };
}

function renderSuggestionList(listElement, inputElement, options, onSelect) {
  if (!listElement || !inputElement) return;

  listElement.innerHTML = '';

  if (!options.length) {
    closeSuggestionList(listElement);
    return;
  }

  options.forEach((option, index) => {
    const item = document.createElement('li');
    item.textContent = option;
    item.setAttribute('role', 'option');
    item.dataset.index = String(index);

    item.addEventListener('mousedown', (event) => {
      event.preventDefault();
      inputElement.value = option;
      closeSuggestionList(listElement);
      if (typeof onSelect === 'function') onSelect(option);
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    });

    listElement.appendChild(item);
  });

  listElement.style.display = 'block';
}

function setupAutocomplete({
  inputId,
  listId,
  optionsProvider,
  onSelect,
  minChars = 0,
  showOnFocus = true
}) {
  const inputElement = document.getElementById(inputId);
  const listElement = document.getElementById(listId);

  if (!inputElement || !listElement) return null;

  const getFilteredOptions = () => {
    const allOptions = typeof optionsProvider === 'function' ? optionsProvider() : [];
    const searchTerm = normalizeText(inputElement.value);

    if (!searchTerm) {
      return showOnFocus ? allOptions : [];
    }

    if (searchTerm.length < minChars) return [];

    return allOptions.filter((option) => normalizeText(option).includes(searchTerm));
  };

  const refreshSuggestions = () => {
    renderSuggestionList(listElement, inputElement, getFilteredOptions(), onSelect);
  };

  const debouncedRefreshSuggestions = debounce(refreshSuggestions, 350);

  inputElement.addEventListener('input', debouncedRefreshSuggestions);

  inputElement.addEventListener('focus', () => {
    if (!inputElement.disabled) refreshSuggestions();
  });

  inputElement.addEventListener('keydown', (event) => {
    const items = Array.from(listElement.querySelectorAll('li'));
    if (!items.length) return;

    const activeItem = listElement.querySelector('.active');
    let activeIndex = activeItem ? Number(activeItem.dataset.index) : -1;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
    } else if (event.key === 'Enter') {
      if (activeItem) {
        event.preventDefault();
        activeItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }
      return;
    } else if (event.key === 'Escape') {
      closeSuggestionList(listElement);
      return;
    } else {
      return;
    }

    items.forEach((item) => item.classList.remove('active'));
    items[activeIndex].classList.add('active');
  });

  document.addEventListener('click', (event) => {
    if (!listElement.contains(event.target) && event.target !== inputElement) {
      closeSuggestionList(listElement);
    }
  });

  inputElement.addEventListener('blur', () => {
    setTimeout(() => closeSuggestionList(listElement), 120);
  });

  return {
    inputElement,
    listElement,
    refreshSuggestions
  };
}

function setupSpecialtyAutocomplete(inputId, listId) {
  setupAutocomplete({
    inputId,
    listId,
    optionsProvider: getSpecialtyAutocompleteOptions,
    minChars: 0,
    showOnFocus: true
  });
}

function setupCityNeighborhoodAutocomplete(cityInputId, cityListId, neighborhoodInputId, neighborhoodListId) {
  const cityInput = document.getElementById(cityInputId);
  const neighborhoodInput = document.getElementById(neighborhoodInputId);
  const neighborhoodList = document.getElementById(neighborhoodListId);

  if (!cityInput || !neighborhoodInput || !neighborhoodList) return;

  const getMatchedCity = () => findExactMatch(getCityOptions(), cityInput.value);
  const getNeighborhoodsForCity = () => getNeighborhoodOptions(cityInput.value);

  const syncNeighborhoodState = () => {
    const neighborhoods = getNeighborhoodsForCity();

    if (!cityInput.value.trim()) {
      neighborhoodInput.value = '';
      neighborhoodInput.disabled = true;
      neighborhoodInput.placeholder = 'Selecione ou digite uma cidade primeiro';
      closeSuggestionList(neighborhoodList);
      return;
    }

    neighborhoodInput.disabled = false;
    neighborhoodInput.placeholder = `Ex.: ${neighborhoods[0] || 'Centro'}`;
  };

  setupAutocomplete({
    inputId: cityInputId,
    listId: cityListId,
    optionsProvider: getCityOptions,
    minChars: 0,
    showOnFocus: true,
    onSelect: () => {
      syncNeighborhoodState();
    }
  });

  setupAutocomplete({
    inputId: neighborhoodInputId,
    listId: neighborhoodListId,
    optionsProvider: () => {
      return getNeighborhoodsForCity();
    },
    minChars: 0,
    showOnFocus: true
  });

  cityInput.addEventListener('input', syncNeighborhoodState);
  cityInput.addEventListener('change', syncNeighborhoodState);
  cityInput.addEventListener('blur', () => {
    const matchedCity = getMatchedCity();
    if (matchedCity) cityInput.value = matchedCity;
    syncNeighborhoodState();
  });

  neighborhoodInput.addEventListener('blur', () => {
    const matchedNeighborhood = findExactMatch(getNeighborhoodsForCity(), neighborhoodInput.value);
    if (matchedNeighborhood) {
      neighborhoodInput.value = matchedNeighborhood;
    }
  });

  syncNeighborhoodState();
}

function setupSearchModeSwitches() {
  document.querySelectorAll('form[action="resultados.html"]').forEach((form) => {
    const modeInputs = Array.from(form.querySelectorAll('input[name="modo"]'));
    const specialtyField = form.querySelector('.specialty-search-field');
    const patientField = form.querySelector('.patient-search-field');
    const specialtyInput = specialtyField?.querySelector('input[name="especialidade"]');
    const patientInput = patientField?.querySelector('input[name="queixa"]');

    if (!modeInputs.length || !specialtyField || !patientField) return;

    const syncMode = () => {
      const mode = modeInputs.find((input) => input.checked)?.value || 'especialidade';
      const isPatientMode = mode === 'leigo';

      specialtyField.hidden = isPatientMode;
      patientField.hidden = !isPatientMode;

      if (specialtyInput) specialtyInput.required = !isPatientMode;
      if (patientInput) patientInput.required = isPatientMode;
    };

    modeInputs.forEach((input) => input.addEventListener('change', syncMode));
    syncMode();
  });
}

async function getLoggedUser(force = false) {
  if (!force && cachedMyProfile) return cachedMyProfile;

  try {
    const auth =
      window.physioApi.getStoredAuth?.() ||
      await waitForAuthStorage();

    console.log('Stored auth:', auth);

    if (!auth?.token) {
      cachedMyProfile = null;
      return null;
    }

    let rawUser = auth.user || {};
    const storedHasProfileId = Boolean(
      rawUser.profiles?.[0]?.id ||
      rawUser.profile?.id
    );

    if (!storedHasProfileId && window.physioApi.me) {
      try {
        const meData = await window.physioApi.me();
        rawUser = meData?.user ?? meData ?? rawUser;
      } catch (error) {
        console.warn('Using stored auth fallback because /auth/me failed:', error);
      }
    }

    let profile = null;
    const storedProfileId =
      rawUser.profiles?.[0]?.id ||
      rawUser.profile?.id ||
      null;

    if (storedProfileId && window.physioApi.fetchProfile) {
      try {
        profile = await window.physioApi.fetchProfile(storedProfileId);
      } catch (_) {
        profile = { id: storedProfileId };
      }
    }

    if (!profile && window.physioApi.fetchMyProfile) {
      try {
        profile = await window.physioApi.fetchMyProfile();
      } catch (_) {
        profile = null;
      }
    }

    cachedMyProfile = {
      id: rawUser.id ?? null,
      email: rawUser.email ?? '',
      emailVerified: rawUser.emailVerified ?? false,
      profile,
    };

    return cachedMyProfile;
  } catch (error) {
    console.warn('Auth UI init failed:', error);
    cachedMyProfile = null;
    return null;
  }
}

async function logout() {
  await window.physioApi.logout().catch(() => {});
  cachedMyProfile = null;
  window.location.href = 'index.html';
}

window.logout = logout;
window.getLoggedUser = getLoggedUser;

function getUserProfileHref(user) {
  return user?.profile?.id
    ? `profile.html?id=${encodeURIComponent(user.profile.id)}`
    : 'profile.html';
}


function updateProfileButtons(user) {
  const heroBtn = document.getElementById('heroProfileBtn');
  const ctaBtn = document.getElementById('ctaProfileBtn');
  const pageProfileBtn = document.getElementById('pageProfileBtn');
  const profileCtas = Array.from(document.querySelectorAll('[data-profile-cta]'));

  const profileHref = getUserProfileHref(user);

  const text = 'Meu perfil';

  [heroBtn, ctaBtn, pageProfileBtn, ...profileCtas].forEach((btn) => {
    if (!btn) return;
    btn.textContent = text;
    btn.href = profileHref;
  });
}

function closeAccountMenus(exceptMenu = null) {
  document.querySelectorAll('[data-account-menu]').forEach((menu) => {
    if (menu === exceptMenu) return;

    const button = menu.querySelector('[data-account-menu-toggle]');
    const panel = menu.querySelector('[data-account-menu-panel]');
    if (!button || !panel) return;

    button.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
  });
}

function setupAccountMenuEvents() {
  if (window.__physioAccountMenuReady) return;
  window.__physioAccountMenuReady = true;

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-account-menu-toggle]');

    if (toggle) {
      const menu = toggle.closest('[data-account-menu]');
      const panel = menu?.querySelector('[data-account-menu-panel]');
      if (!menu || !panel) return;

      const willOpen = panel.hidden;
      closeAccountMenus(menu);
      toggle.setAttribute('aria-expanded', String(willOpen));
      panel.hidden = !willOpen;
      return;
    }

    if (!event.target.closest('[data-account-menu]')) {
      closeAccountMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAccountMenus();
  });
}


async function renderAuthArea() {
  const authArea = document.getElementById('authArea');
  const cadastroLink = document.getElementById('cadastroLink');

  if (!authArea) return;

  const user = await getLoggedUser(true);

  if (!user) {
    if (cadastroLink) cadastroLink.style.display = '';

    authArea.innerHTML = `
      <a href="login.html" class="btn btn-outline">Entrar</a>
      <a href="cadastro.html" class="btn btn-primary">Cadastrar</a>
    `;
    return;
  }

  if (cadastroLink) cadastroLink.remove();

  updateProfileButtons(user);

  const firstName = (
    user.profile?.nome ||
    user.profile?.name ||
    user.email ||
    'Profissional'
  ).split(' ')[0];
  const profileHref = getUserProfileHref(user);

  authArea.innerHTML = `
    <span class="user-greeting">Olá, ${escapeHtml(firstName)}</span>
    <div class="account-menu" data-account-menu>
      <button
        class="account-menu__button"
        type="button"
        aria-label="Abrir menu da conta"
        aria-expanded="false"
        data-account-menu-toggle
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div class="account-menu__panel" role="menu" data-account-menu-panel hidden>
        <a role="menuitem" href="${profileHref}">Meu perfil</a>
        <a role="menuitem" href="editar-perfil.html">Editar perfil</a>
        <a role="menuitem" href="planos.html">Planos</a>
        <button role="menuitem" type="button" onclick="logout()">Sair</button>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  setupAccountMenuEvents();
  await renderAuthArea();
  await loadDynamicSearchOptions();

  // mobile navbar base64url auth check
  setTimeout(() => {
    cachedMyProfile = null;
    renderAuthArea();
  }, 1200);

  setupSpecialtyAutocomplete('specialtyInput', 'specialtySuggestions');
  setupSpecialtyAutocomplete('buscarEspecialidade', 'buscarSuggestions');

  setupCityNeighborhoodAutocomplete(
    'cityIndexSelect',
    'cityIndexSuggestions',
    'buscarBairroIndex',
    'bairroIndexSuggestions'
  );

  setupCityNeighborhoodAutocomplete(
    'buscarCidade',
    'cidadeSuggestions',
    'buscarBairro',
    'bairroSuggestions'
  );

  setupSearchModeSwitches();
});

function getSearchableSpecialties(profile) {
  return [
    profile.especialidade,
    profile.specialty,
    profile.especialidadeSecundaria,
    profile.secondarySpecialty,
    profile.specialization,
    profile.specialty2,
    profile.extraSpecialty,
  ]
    .filter(Boolean)
    .map(normalizeText)
    .join(' ');
}

function getDisplaySpecialties(profile) {
  return [
    profile.especialidade || profile.specialty,
    profile.especialidadeSecundaria || profile.secondarySpecialty,
  ]
    .filter(Boolean)
    .filter((specialty, index, arr) => arr.indexOf(specialty) === index)
    .join(' • ');
}

// ===============================
// RESULTADOS DA BUSCA
// ===============================

const RESULTS_PER_PAGE = 12;

document.addEventListener('DOMContentLoaded', async () => {
  const resultsGrid = document.getElementById('resultsGrid');

  // Só executa em resultados.html
  if (!resultsGrid) return;

  const resumo = document.getElementById('resultadoResumo');
  const resultsShowingSummary = document.getElementById('resultsShowingSummary');
  const paginationControls = document.getElementById('paginationControls');

  const renderResultsSkeleton = (count = 6) => {
    resultsGrid.innerHTML = Array.from({ length: count }, () => `
      <article class="result-card result-card-skeleton" aria-hidden="true">
        <span class="skeleton-line skeleton-title"></span>
        <span class="skeleton-pill"></span>
        <span class="skeleton-pill skeleton-pill-short"></span>
        <span class="skeleton-pill skeleton-pill-shorter"></span>
        <span class="skeleton-line"></span>
        <span class="skeleton-line"></span>
        <span class="skeleton-button"></span>
      </article>
    `).join('');
  };

  const params = new URLSearchParams(window.location.search);
  const requestedPage = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);

  const especialidade = normalizeText(
    params.get('especialidade') || ''
  );

  const modoBusca = params.get('modo') === 'leigo' ? 'leigo' : 'especialidade';
  const queixa = params.get('queixa') || '';
  const searchQuery = modoBusca === 'leigo'
    ? queixa
    : (params.get('especialidade') || '');
  const searchAnalysis = analyzeSearchIntent(searchQuery);
  const patientTerms = searchAnalysis.expandedTerms;

  const cidade = normalizeText(
    params.get('cidade') || ''
  );

  const bairro = normalizeText(
    params.get('bairro') || ''
  );

  const specialtyInput = document.getElementById('specialtyInput');
  const cityInput = document.getElementById('cityIndexSelect');
  const bairroInput = document.getElementById('buscarBairroIndex');
  const patientInput = document.querySelector('.patient-search-field input[name="queixa"]');

  if (specialtyInput) specialtyInput.value = params.get('especialidade') || '';
  if (patientInput) patientInput.value = queixa;
  if (cityInput) cityInput.value = params.get('cidade') || '';
  if (bairroInput) bairroInput.value = params.get('bairro') || '';
  setupSearchModeSwitches();
  document.querySelectorAll('input[name="modo"]').forEach((input) => {
    input.checked = input.value === modoBusca;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  try {
    resumo.textContent = 'Buscando profissionais...';
    renderResultsSkeleton();

    const profiles = await window.physioApi.fetchProfiles({ useCache: false });

    const locationMatchedProfiles = profiles.filter((profile) => {
      const pEspecialidade = getSearchableSpecialties(profile);
      const pCidade = normalizeText(profile.cidade || profile.city);
      const pBairro = normalizeText(profile.bairro || profile.neighborhood);

      const specialtyMatch =
        modoBusca === 'leigo'
          ? true
          : (!especialidade || pEspecialidade.includes(especialidade));

      const cityMatch =
        !cidade || pCidade.includes(cidade);

      const neighborhoodMatch =
        !bairro || pBairro.includes(bairro);

      return specialtyMatch && cityMatch && neighborhoodMatch;
    });

    const rankedResult = modoBusca === 'leigo'
      ? rankProfilesByRelevance(
        locationMatchedProfiles,
        searchAnalysis,
        {
          city: cidade,
          neighborhood: bairro,
        }
      )
      : {
        rankedProfiles: locationMatchedProfiles.map((profile) => ({ profile, score: 0, tier: 1, reasons: [] })),
        ordered: locationMatchedProfiles.map((profile) => ({ profile, score: 0, tier: 1, reasons: [] })),
      };

    if (modoBusca === 'leigo') {
      debugRankedResults(searchQuery, searchAnalysis, rankedResult.ordered);
    }

    const meaningfulResults = modoBusca === 'leigo'
      ? rankedResult.ordered.filter((item) => item.tier < 4)
      : rankedResult.ordered;

    const visibleResults = meaningfulResults.length
      ? meaningfulResults
      : rankedResult.ordered;

    const filtered = visibleResults.map((item) => item.profile);

    const resultLabel = filtered.length === 1
      ? '1 profissional encontrado'
      : `${filtered.length} profissionais encontrados`;

    resumo.textContent = resultLabel;

    if (modoBusca === 'leigo' && queixa) {
      const existingSummary = document.querySelector('.smart-search-summary');
      if (existingSummary) existingSummary.remove();

      const hintTerms = uniqueTerms([
        ...(searchAnalysis.primaryRule?.specialtyKeywords || []),
        ...(searchAnalysis.primaryRule?.relatedTerms || []),
        ...searchAnalysis.specificTerms,
      ])
        .map(normalizeText)
        .filter((term) => !GENERIC_QUERY_TERMS.has(term))
        .slice(0, 8);
      resumo.textContent = `${resultLabel} para "${queixa}"`;

      if (hintTerms.length) {
        resumo.insertAdjacentHTML(
          'afterend',
          `
            <section class="smart-search-summary" aria-label="Resumo da busca inteligente">
              <div class="smart-search-summary__copy">
                <span>Busca inteligente</span>
                <strong>Priorizamos a inten&ccedil;&atilde;o principal da busca</strong>
              </div>
              <div class="smart-search-tags">
                ${hintTerms.map((term) => `<span>${escapeHtml(term)}</span>`).join('')}
              </div>
            </section>
          `
        );
      }
    }

    if (filtered.length === 0) {
      resultsGrid.innerHTML = `
        <div class="empty-results">
          <h3>Nenhum profissional encontrado.</h3>
          <p>Tente pesquisar outra especialidade ou cidade.</p>
        </div>
      `;
      if (resultsShowingSummary) resultsShowingSummary.textContent = 'Mostrando 0 de 0 profissionais';
      if (paginationControls) paginationControls.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(filtered.length / RESULTS_PER_PAGE);
    const clampPage = (page) => Math.min(Math.max(page, 1), totalPages);
    let currentPage = clampPage(requestedPage);

    const updatePageUrl = (page) => {
      const urlParams = new URLSearchParams(window.location.search);

      if (page <= 1) {
        urlParams.delete('page');
      } else {
        urlParams.set('page', String(page));
      }

      const queryString = urlParams.toString();
      const nextUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;

      window.history.replaceState(null, '', nextUrl);
    };

    const getPaginationItems = (page) => {
      const pages = [];

      if (totalPages <= 7) {
        for (let index = 1; index <= totalPages; index += 1) pages.push(index);
        return pages;
      }

      pages.push(1);
      if (page > 4) pages.push('...');

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let index = start; index <= end; index += 1) pages.push(index);

      if (page < totalPages - 3) pages.push('...');
      pages.push(totalPages);

      return pages;
    };

    const renderPagination = () => {
      if (!paginationControls) return;

      if (totalPages <= 1) {
        paginationControls.innerHTML = '';
        return;
      }

      const pageButtons = getPaginationItems(currentPage)
        .map((item) => {
          if (item === '...') {
            return '<span class="pagination-ellipsis" aria-hidden="true">...</span>';
          }

          return `
            <button
              type="button"
              class="pagination-page ${item === currentPage ? 'is-active' : ''}"
              data-page="${item}"
              aria-label="Ir para a página ${item}"
              ${item === currentPage ? 'aria-current="page"' : ''}
            >
              ${item}
            </button>
          `;
        })
        .join('');

      paginationControls.innerHTML = `
        <button
          type="button"
          class="pagination-btn"
          data-page="${currentPage - 1}"
          ${currentPage === 1 ? 'disabled' : ''}
        >
          Anterior
        </button>

        <div class="pagination-pages">
          ${pageButtons}
        </div>

        <button
          type="button"
          class="pagination-btn"
          data-page="${currentPage + 1}"
          ${currentPage === totalPages ? 'disabled' : ''}
        >
          Próxima
        </button>
      `;

      paginationControls.querySelectorAll('button[data-page]').forEach((button) => {
        button.addEventListener('click', () => {
          renderPage(Number.parseInt(button.dataset.page, 10), true);
        });
      });
    };

    const renderPage = (page, shouldScroll = false) => {
      currentPage = clampPage(page);

      const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
      const endIndex = Math.min(startIndex + RESULTS_PER_PAGE, filtered.length);
      const pageProfiles = filtered.slice(startIndex, endIndex);

   resultsGrid.innerHTML = pageProfiles.map((profile) => `
  <article class="result-card">
    <h3>
      ${escapeHtml(profile.nome || profile.name || 'Fisioterapeuta')}
    </h3>

    <p>
      <strong>Especialidade:</strong>
      ${escapeHtml(getDisplaySpecialties(profile) || 'Não informado')}
    </p>

    <p>
      <strong>Cidade:</strong>
      ${escapeHtml(profile.cidade || profile.city || 'Não informado')}
    </p>

    <p>
      <strong>Bairro:</strong>
      ${escapeHtml(profile.bairro || profile.neighborhood || 'Não informado')}
    </p>

    <div class="bio-wrapper">
  <p class="bio collapsed">
    ${escapeHtml(profile.bio || profile.descricao || 'Sem descrição.')}
  </p>

  <button class="toggle-bio-btn" type="button">
    Veja mais
  </button>
</div>

    <a
      href="profile.html?id=${encodeURIComponent(profile.id)}"
      class="btn btn-primary"
    >
      Ver perfil
    </a>
  </article>
`).join('');

document.querySelectorAll('.toggle-bio-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const bio = button.previousElementSibling;

    bio.classList.toggle('collapsed');

    if (bio.classList.contains('collapsed')) {
      button.textContent = 'Veja mais';
    } else {
      button.textContent = 'Veja menos';
    }
  });
});

      renderPagination();
      updatePageUrl(currentPage);

      if (resultsShowingSummary) {
        resultsShowingSummary.textContent = `Mostrando ${endIndex} de ${filtered.length} profissionais`;
      }

      if (shouldScroll) {
        resultsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    renderPage(currentPage);

} catch (error) {
  console.error(error);

  resumo.textContent = 'Erro ao carregar resultados.';
  if (resultsShowingSummary) resultsShowingSummary.textContent = '';
  if (paginationControls) paginationControls.innerHTML = '';

  resultsGrid.innerHTML = `
    <div class="empty-results">
      <h3>Erro ao buscar profissionais.</h3>
    </div>
  `;
}
});
