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
  'paciente',
  'pacientes',
  'fisio',
  'terapia',
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

const GENERIC_SPECIALTY_TOKENS = new Set([
  'fisioterapia',
  'fisio',
  'saude',
  'clinica',
  'clinico',
  'especialista',
  'especialidade',
  'reabilitacao',
]);

const SPECIALTY_RELATIONSHIP_MAP = {
  neurologica: ['Geriatrica', 'Reabilitacao', 'Funcional', 'Pilates', 'Pediatrica'],
  neurofuncional: ['Neurologica', 'Geriatrica', 'Reabilitacao', 'Funcional'],
  ortopedica: ['Traumato-Ortopedica', 'Esportiva', 'Reabilitacao', 'Funcional', 'Pilates', 'RPG'],
  traumato: ['Ortopedica', 'Esportiva', 'Reabilitacao', 'Funcional', 'Pilates'],
  'traumato ortopedica': ['Ortopedica', 'Esportiva', 'Reabilitacao', 'Funcional', 'Pilates'],
  esportiva: ['Ortopedica', 'Traumato-Ortopedica', 'Funcional', 'Pilates'],
  pelvica: ['Uroginecologica', 'Obstetrica', 'Saude da Mulher', 'Pilates'],
  uroginecologica: ['Pelvica', 'Saude da Mulher', 'Obstetrica'],
  obstetrica: ['Pelvica', 'Saude da Mulher', 'Pilates'],
  'saude da mulher': ['Pelvica', 'Uroginecologica', 'Obstetrica', 'Pilates'],
  respiratoria: ['Cardiorrespiratoria', 'Hospitalar', 'Geriatrica'],
  cardiorrespiratoria: ['Respiratoria', 'Hospitalar', 'Geriatrica'],
  pediatrica: ['Neurologica', 'Respiratoria', 'Desenvolvimento Infantil'],
  geriatrica: ['Neurologica', 'Ortopedica', 'Reabilitacao', 'Pilates', 'Funcional'],
  dermatofuncional: ['Estetica', 'Drenagem', 'Pos-operatorio'],
  estetica: ['Dermatofuncional', 'Drenagem'],
  rpg: ['Ortopedica', 'Pilates', 'Funcional'],
  pilates: ['Ortopedica', 'Funcional', 'RPG', 'Geriatrica', 'Pelvica'],
  funcional: ['Ortopedica', 'Esportiva', 'Pilates', 'Reabilitacao'],
  hospitalar: ['Respiratoria', 'Cardiorrespiratoria', 'Geriatrica'],
};

// This is the main intent catalog for patient-language searches.
// Each entry describes how a clinical area can be discovered from body parts,
// symptoms, informal language, and related specialties.
const DEFAULT_INTENT_CATALOG = [
  {
    id: 'ortopedica',
    specialty: 'Fisioterapia Ortopedica',
    relatedSpecialties: ['Fisioterapia Esportiva', 'Traumato-Ortopedica', 'Terapia Manual', 'Quiropraxia', 'RPG', 'Pilates', 'Funcional', 'Reabilitacao'],
    bodyRegions: ['ombro', 'joelho', 'coluna', 'lombar', 'cervical', 'pescoco', 'costas', 'quadril', 'tornozelo', 'calcanhar', 'cotovelo', 'punho', 'mao', 'pe', 'perna'],
    symptoms: ['tendinite', 'bursite', 'manguito', 'manguito rotador', 'menisco', 'ligamento', 'lca', 'acl', 'condromalacia', 'hernia', 'hernia de disco', 'ciatica', 'lombalgia', 'cervicalgia', 'dor cervical', 'torcicolo'],
    synonyms: ['ortopedia', 'ortopedica', 'traumato', 'traumato ortopedica', 'reabilitacao esportiva', 'terapia manual', 'musculoesqueletica', 'musculoesqueletico', 'funcional'],
    informalTerms: ['dor nas costas', 'dor no ombro', 'dor no joelho', 'lesao no joelho', 'dor no pescoco', 'ombro travado', 'coluna travada', 'pescoco travado'],
    associatedKeywords: ['mobilidade', 'postura', 'liberacao miofascial', 'lesao', 'articulacao', 'pos operatorio', 'rpg', 'reabilitacao', 'pilates'],
    unrelatedSpecialties: ['pelvica', 'uroginecologica', 'dermatofuncional', 'respiratoria', 'saude da mulher'],
  },
  {
    id: 'pelvica',
    specialty: 'Fisioterapia Pelvica',
    relatedSpecialties: ['Uroginecologica', 'Saude da Mulher', 'Obstetrica', 'Pilates'],
    bodyRegions: ['pelvica', 'pelvico', 'perineo', 'perinio', 'vagina', 'vaginal', 'assoalho pelvico', 'utero'],
    symptoms: ['incontinencia', 'incontinencia urinaria', 'urgencia urinaria', 'urina', 'urinaria', 'dor pelvica', 'dor na relacao', 'constipacao', 'pos parto', 'gravidez', 'gestante'],
    synonyms: ['uroginecologica', 'uroginecologia', 'pelvica', 'saude da mulher'],
    informalTerms: ['perereca', 'xixi escapando', 'escape de urina', 'xixi', 'bexiga solta'],
    associatedKeywords: ['gestante', 'pos parto', 'parto', 'diastase', 'perda urinaria'],
    unrelatedSpecialties: ['ortopedica', 'esportiva', 'traumato', 'dermatofuncional', 'respiratoria'],
  },
  {
    id: 'obstetrica',
    specialty: 'Fisioterapia Obstetrica',
    relatedSpecialties: ['Fisioterapia Pelvica', 'Saude da Mulher', 'Uroginecologica'],
    bodyRegions: ['abdomen', 'pelvica', 'perineo'],
    symptoms: ['gestacao', 'gravidez', 'parto', 'pos parto', 'puerperio', 'diastase'],
    synonyms: ['obstetrica', 'obstetrico', 'gestante'],
    informalTerms: ['gravida', 'gravidez', 'parto normal'],
    associatedKeywords: ['assoalho pelvico', 'saude da mulher', 'pre parto'],
    unrelatedSpecialties: ['ortopedica', 'esportiva', 'dermatofuncional'],
  },
  {
    id: 'neurologica',
    specialty: 'Fisioterapia Neurologica',
    relatedSpecialties: ['Neurofuncional', 'Geriatrica', 'Reabilitacao', 'Funcional', 'Pilates', 'Pediatrica'],
    bodyRegions: ['marcha', 'equilibrio', 'tronco', 'coordenacao'],
    symptoms: ['avc', 'derrame', 'parkinson', 'alzheimer', 'paralisia', 'atraso motor', 'neurologico', 'neurologica', 'coordenacao', 'equilibrio'],
    synonyms: ['neuro', 'neurofuncional', 'neurologica', 'reabilitacao neurologica'],
    informalTerms: ['derrame', 'fraqueza de um lado'],
    associatedKeywords: ['treino de marcha', 'coordenacao', 'controle motor'],
    unrelatedSpecialties: ['dermatofuncional', 'pelvica', 'estetica'],
  },
  {
    id: 'respiratoria',
    specialty: 'Fisioterapia Respiratoria',
    relatedSpecialties: ['Cardiorrespiratoria', 'Hospitalar', 'Geriatrica'],
    bodyRegions: ['pulmao', 'torax'],
    symptoms: ['respiracao', 'respirar', 'asma', 'bronquite', 'dpoc', 'falta de ar', 'folego'],
    synonyms: ['respiratoria', 'cardiorrespiratoria', 'pulmonar'],
    informalTerms: ['cansaco para respirar'],
    associatedKeywords: ['ventilacao', 'expansao pulmonar'],
    unrelatedSpecialties: ['pelvica', 'dermatofuncional', 'estetica'],
  },
  {
    id: 'pediatrica',
    specialty: 'Fisioterapia Pediatrica',
    relatedSpecialties: ['Fisioterapia Infantil', 'Neurologica', 'Respiratoria', 'Desenvolvimento Infantil'],
    bodyRegions: ['crianca', 'bebe', 'infantil'],
    symptoms: ['atraso motor', 'desenvolvimento motor', 'desenvolvimento infantil', 'torcicolo congenito'],
    synonyms: ['pediatrica', 'pediatria', 'infantil'],
    informalTerms: ['bebe', 'crianca'],
    associatedKeywords: ['desenvolvimento', 'marcos motores'],
    unrelatedSpecialties: ['geriatrica', 'gerontologia', 'pelvica'],
  },
  {
    id: 'geriatrica',
    specialty: 'Fisioterapia Geriatrica',
    relatedSpecialties: ['Gerontologia', 'Neurologica', 'Ortopedica', 'Reabilitacao', 'Pilates', 'Funcional'],
    bodyRegions: ['idoso', 'idosa'],
    symptoms: ['equilibrio', 'quedas', 'queda', 'marcha', 'mobilidade reduzida'],
    synonyms: ['geriatrica', 'geriatria', 'gerontologia'],
    informalTerms: ['idoso', 'idosa'],
    associatedKeywords: ['prevencao de quedas', 'fortalecimento'],
    unrelatedSpecialties: ['pediatrica', 'pelvica', 'esportiva'],
  },
  {
    id: 'ocupacional',
    specialty: 'Fisioterapia Ocupacional',
    relatedSpecialties: ['Ergonomia'],
    bodyRegions: ['mao', 'punho'],
    symptoms: ['ler', 'dort', 'ergonomia', 'trabalho repetitivo', 'escritorio'],
    synonyms: ['ocupacional', 'ergonomia', 'saude ocupacional'],
    informalTerms: ['dor no trabalho', 'dor no escritorio', 'home office'],
    associatedKeywords: ['trabalho', 'postura no trabalho'],
    unrelatedSpecialties: ['pelvica', 'dermatofuncional'],
  },
  {
    id: 'dermatofuncional',
    specialty: 'Fisioterapia Dermatofuncional',
    relatedSpecialties: ['Estetica', 'Drenagem', 'Pos-operatorio'],
    bodyRegions: ['pele', 'face', 'abdomen'],
    symptoms: ['cicatriz', 'fibrose', 'drenagem', 'linfedema', 'celulite', 'gordura', 'pele'],
    synonyms: ['dermatofuncional', 'estetica'],
    informalTerms: ['pos lipo', 'pos cirurgia plastica', 'pos operatorio estetico'],
    associatedKeywords: ['drenagem linfatica', 'pos operatorio estetico'],
    unrelatedSpecialties: ['ortopedica', 'esportiva', 'neurologica'],
  },
  {
    id: 'pilates',
    specialty: 'Pilates',
    relatedSpecialties: ['RPG', 'Terapia Manual', 'Quiropraxia', 'Ortopedica', 'Funcional', 'Geriatrica', 'Pelvica'],
    bodyRegions: ['coluna', 'postura', 'postural', 'core', 'pescoco', 'cervical'],
    symptoms: ['lombalgia', 'cervicalgia', 'dor cervical'],
    synonyms: ['pilates', 'pilates clinico'],
    informalTerms: [],
    associatedKeywords: ['alongamento', 'estabilizacao', 'reabilitacao', 'postura'],
    unrelatedSpecialties: [],
  },
];

const SPECIALTY_ALIAS_MAP = {
  ortopedia: 'ortopedica',
  ortopedica: 'ortopedica',
  traumatologia: 'traumato',
  traumato: 'traumato',
  esportiva: 'esportiva',
  esporte: 'esportiva',
  uroginecologica: 'uroginecologica',
  pelvica: 'pelvica',
  neurofuncional: 'neurofuncional',
  neurologica: 'neurologica',
  respiratoria: 'respiratoria',
  geriatria: 'geriatrica',
  geriatrica: 'geriatrica',
  gerontologia: 'gerontologia',
  pediatria: 'pediatrica',
  pediatrica: 'pediatrica',
  infantil: 'pediatrica',
  crianca: 'pediatrica',
  bebe: 'pediatrica',
  ocupacional: 'ocupacional',
  ergonomia: 'ergonomia',
  dermatofuncional: 'dermatofuncional',
  estetica: 'estetica',
  quiropraxia: 'quiropraxia',
  rpg: 'rpg',
  funcional: 'funcional',
  reabilitacao: 'reabilitacao',
  hospitalar: 'hospitalar',
  cardiorrespiratoria: 'cardiorrespiratoria',
  obstetrica: 'obstetrica',
};

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
    const options = await window.physioApi.fetchProfileOptions({ useCache: true });
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
    .replace(/['’`]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function normalizeSearchText(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeToken(token) {
  if (!token) return '';
  if (token.endsWith('oes')) return `${token.slice(0, -3)}ao`;
  if (token.endsWith('ais')) return `${token.slice(0, -3)}al`;
  if (token.endsWith('eis')) return `${token.slice(0, -3)}el`;
  if (token.endsWith('is') && token.length > 4) return `${token.slice(0, -2)}l`;
  if (token.endsWith('s') && token.length > 3 && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function getTokenForms(token) {
  const normalized = normalizeSearchText(token);
  if (!normalized) return [];

  return uniqueTerms([
    normalized,
    singularizeToken(normalized),
  ]);
}

function tokenizeSearch(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];

  return uniqueTerms(
    normalized
      .split(/\s+/)
      .flatMap((term) => getTokenForms(term))
      .filter((term) => term.length > 1 && !STOP_WORDS.has(term))
  );
}

function uniqueTerms(terms) {
  return [...new Set((terms || []).filter(Boolean))];
}

function isMeaningfulIntentTerm(term) {
  const normalized = normalizeSearchText(term);
  if (!normalized) return false;
  if (GENERIC_QUERY_TERMS.has(normalized)) return false;
  if (GENERIC_SPECIALTY_TOKENS.has(normalized)) return false;
  if (STOP_WORDS.has(normalized)) return false;
  return normalized.length > 2 || /^[a-z]{2,3}\d?$/i.test(normalized);
}

function phraseMatchesText(text, phrase) {
  const normalizedText = normalizeSearchText(text);
  const normalizedPhrase = normalizeSearchText(phrase);

  if (!normalizedText || !normalizedPhrase) return false;

  const phraseTokens = tokenizeSearch(normalizedPhrase);
  if (!phraseTokens.length) return false;

  const textTokens = tokenizeSearch(normalizedText);
  if (phraseTokens.length === 1) {
    return textTokens.includes(phraseTokens[0]);
  }

  if (normalizedText.includes(normalizedPhrase)) return true;
  return phraseTokens.every((token) => textTokens.includes(token));
}

function textMatchesTerm(text, term) {
  const normalizedText = normalizeSearchText(text);
  if (!normalizedText) return false;
  const textTokens = tokenizeSearch(normalizedText);

  return getTokenForms(term).some((form) => {
    if (!form) return false;
    const formTokens = tokenizeSearch(form);
    if (formTokens.length <= 1) return textTokens.includes(form);
    return normalizedText.includes(form) || formTokens.every((token) => textTokens.includes(token));
  });
}

function getMatchedTerms(text, terms) {
  return uniqueTerms((terms || []).filter((term) => textMatchesTerm(text, term)));
}

function getWordsFromLabel(value) {
  return tokenizeSearch(value).filter((token) => !GENERIC_SPECIALTY_TOKENS.has(token));
}

function getSpecialtyAliases(value) {
  return uniqueTerms(getWordsFromLabel(value).flatMap((token) => [
    token,
    SPECIALTY_ALIAS_MAP[token] || token,
  ]));
}

function getRelatedSpecialties(value) {
  const normalized = normalizeSearchText(value);
  const words = getWordsFromLabel(value);
  const related = [];

  [normalized, ...words, ...words.map((token) => SPECIALTY_ALIAS_MAP[token] || token)]
    .filter(Boolean)
    .forEach((key) => {
      if (SPECIALTY_RELATIONSHIP_MAP[key]) related.push(...SPECIALTY_RELATIONSHIP_MAP[key]);
    });

  return uniqueTerms(related);
}

function buildCatalogEntry(definition) {
  const specialty = cleanOptionLabel(definition.specialty || definition.especialidade || '');
  const relatedSpecialties = uniqueTerms([
    ...(definition.relatedSpecialties || []),
    ...getRelatedSpecialties(specialty),
  ].map(cleanOptionLabel).filter(Boolean));
  const specialtyTerms = uniqueTerms([
    specialty,
    ...getWordsFromLabel(specialty),
    ...getSpecialtyAliases(specialty),
    ...(definition.specialtyAliases || []),
  ].map(normalizeSearchText).filter(isMeaningfulIntentTerm));
  const relatedSpecialtyTerms = uniqueTerms([
    ...relatedSpecialties,
    ...relatedSpecialties.flatMap((value) => getWordsFromLabel(value)),
    ...relatedSpecialties.flatMap((value) => getSpecialtyAliases(value)),
  ].map(normalizeSearchText).filter(isMeaningfulIntentTerm));

  return {
    id: definition.id || normalizeSearchText(specialty) || `entry-${Math.random().toString(36).slice(2, 8)}`,
    specialty,
    relatedSpecialties,
    specialtyTerms,
    relatedSpecialtyTerms,
    bodyRegions: uniqueTerms((definition.bodyRegions || []).map(normalizeSearchText).filter(isMeaningfulIntentTerm)),
    symptoms: uniqueTerms((definition.symptoms || []).map(normalizeSearchText).filter(isMeaningfulIntentTerm)),
    synonyms: uniqueTerms((definition.synonyms || []).map(normalizeSearchText).filter(isMeaningfulIntentTerm)),
    informalTerms: uniqueTerms((definition.informalTerms || []).map(normalizeSearchText).filter(isMeaningfulIntentTerm)),
    associatedKeywords: uniqueTerms((definition.associatedKeywords || definition.keywords || []).map(normalizeSearchText).filter(isMeaningfulIntentTerm)),
    unrelatedSpecialties: uniqueTerms((definition.unrelatedSpecialties || []).map(normalizeSearchText).filter(isMeaningfulIntentTerm)),
  };
}

function buildDynamicCatalogEntries() {
  const taxonomySpecialties = [
    ...(window.PhysioTaxonomy?.coreSpecialties || []),
    ...(window.PhysioTaxonomy?.profileSpecialtyOptions || []),
    ...(dynamicSpecialtyOptions || []),
    ...SPECIALTIES,
  ];

  const built = taxonomySpecialties.map((specialty) => {
    const cleanSpecialty = cleanOptionLabel(specialty);
    const normalizedSpecialty = normalizeSearchText(cleanSpecialty);
    const specialtyTokens = getWordsFromLabel(cleanSpecialty);

    const aliasTerms = uniqueTerms([
      normalizedSpecialty,
      ...specialtyTokens,
      ...specialtyTokens.map((token) => SPECIALTY_ALIAS_MAP[token] || token),
    ]);

    return buildCatalogEntry({
      id: normalizedSpecialty || cleanSpecialty,
      specialty: cleanSpecialty,
      specialtyAliases: aliasTerms,
      bodyRegions: [],
      symptoms: [],
      synonyms: [],
      associatedKeywords: specialtyTokens,
    });
  });

  return built.filter((entry) => entry.specialtyTerms.length || entry.bodyRegions.length || entry.symptoms.length);
}

function buildSearchContext(profiles = []) {
  const profileSpecialties = profiles.flatMap((profile) => [
    profile.especialidade,
    profile.specialty,
    profile.especialidadeSecundaria,
    profile.secondarySpecialty,
    profile.specialization,
    profile.specialty2,
    profile.extraSpecialty,
  ]).filter(Boolean);

  const entries = [
    ...DEFAULT_INTENT_CATALOG,
    ...buildDynamicCatalogEntries(),
    ...profileSpecialties.map((specialty) => ({
      specialty,
      relatedSpecialties: [],
      bodyRegions: [],
      symptoms: [],
      synonyms: [],
      informalTerms: [],
      associatedKeywords: [],
      specialtyAliases: getWordsFromLabel(specialty),
      unrelatedSpecialties: [],
    })),
  ]
    .map(buildCatalogEntry)
    .reduce((map, entry) => {
      const existing = map.get(entry.id);
      if (!existing) {
        map.set(entry.id, entry);
        return map;
      }

      map.set(entry.id, {
        ...existing,
        specialty: existing.specialty || entry.specialty,
        relatedSpecialties: uniqueTerms([...existing.relatedSpecialties, ...entry.relatedSpecialties]),
        specialtyTerms: uniqueTerms([...existing.specialtyTerms, ...entry.specialtyTerms]),
        relatedSpecialtyTerms: uniqueTerms([...existing.relatedSpecialtyTerms, ...entry.relatedSpecialtyTerms]),
        bodyRegions: uniqueTerms([...existing.bodyRegions, ...entry.bodyRegions]),
        symptoms: uniqueTerms([...existing.symptoms, ...entry.symptoms]),
        synonyms: uniqueTerms([...existing.synonyms, ...entry.synonyms]),
        informalTerms: uniqueTerms([...existing.informalTerms, ...entry.informalTerms]),
        associatedKeywords: uniqueTerms([...existing.associatedKeywords, ...entry.associatedKeywords]),
        unrelatedSpecialties: uniqueTerms([...existing.unrelatedSpecialties, ...entry.unrelatedSpecialties]),
      });
      return map;
    }, new Map());

  return {
    entries: Array.from(entries.values()),
  };
}

function getIntentSignals(entry) {
  return uniqueTerms([
    ...entry.specialtyTerms,
    ...entry.relatedSpecialtyTerms,
    ...entry.bodyRegions,
    ...entry.symptoms,
    ...entry.synonyms,
    ...entry.informalTerms,
    ...entry.associatedKeywords,
  ]);
}

function mergeIntentMatch(existingMatch, incomingMatch) {
  if (!existingMatch) return incomingMatch;

  return {
    ...existingMatch,
    score: existingMatch.score + incomingMatch.score,
    matchedBodyRegions: uniqueTerms([...existingMatch.matchedBodyRegions, ...incomingMatch.matchedBodyRegions]),
    matchedSymptoms: uniqueTerms([...existingMatch.matchedSymptoms, ...incomingMatch.matchedSymptoms]),
    matchedSynonyms: uniqueTerms([...existingMatch.matchedSynonyms, ...incomingMatch.matchedSynonyms]),
    matchedInformal: uniqueTerms([...existingMatch.matchedInformal, ...incomingMatch.matchedInformal]),
    matchedSpecialties: uniqueTerms([...existingMatch.matchedSpecialties, ...incomingMatch.matchedSpecialties]),
    matchedRelatedSpecialties: uniqueTerms([...existingMatch.matchedRelatedSpecialties, ...incomingMatch.matchedRelatedSpecialties]),
    matchedAssociated: uniqueTerms([...existingMatch.matchedAssociated, ...incomingMatch.matchedAssociated]),
    matchedFallbackTerms: uniqueTerms([...(existingMatch.matchedFallbackTerms || []), ...(incomingMatch.matchedFallbackTerms || [])]),
  };
}

function getMatchedSearchGroups(queryText) {
  return getPatientSearchGroups()
    .map((group) => {
      const matchedTriggers = (group.triggers || []).filter((trigger) => phraseMatchesText(queryText, trigger));
      if (!matchedTriggers.length) return null;

      return {
        ...group,
        matchedTriggers,
        expansionTerms: uniqueTerms([
          ...(group.triggers || []),
          ...(group.terms || []),
        ].map(normalizeSearchText).filter(isMeaningfulIntentTerm)),
      };
    })
    .filter(Boolean);
}

function buildExpansionIntentMatch(entry, expansionTerms, matchedTriggers = []) {
  const matchedBodyRegions = entry.bodyRegions.filter((term) => expansionTerms.includes(term));
  const matchedSymptoms = entry.symptoms.filter((term) => expansionTerms.includes(term));
  const matchedSynonyms = entry.synonyms.filter((term) => expansionTerms.includes(term));
  const matchedInformal = entry.informalTerms.filter((term) => expansionTerms.includes(term));
  const matchedSpecialties = entry.specialtyTerms.filter((term) => expansionTerms.includes(term));
  const matchedRelatedSpecialties = entry.relatedSpecialtyTerms.filter((term) => expansionTerms.includes(term));
  const matchedAssociated = entry.associatedKeywords.filter((term) => expansionTerms.includes(term));
  const score =
    matchedSpecialties.length * 50 +
    matchedRelatedSpecialties.length * 40 +
    matchedBodyRegions.length * 40 +
    matchedSymptoms.length * 30 +
    (matchedSynonyms.length + matchedInformal.length) * 25 +
    matchedAssociated.length * 20 +
    (matchedTriggers.length ? 15 : 0);

  if (!score) return null;

  return {
    ...entry,
    score,
    matchedBodyRegions,
    matchedSymptoms,
    matchedSynonyms,
    matchedInformal,
    matchedSpecialties,
    matchedRelatedSpecialties,
    matchedAssociated,
    matchedFallbackTerms: expansionTerms,
  };
}

function analyzeSearchIntent(query, context = buildSearchContext()) {
  const originalQuery = String(query || '').trim();
  const normalizedQuery = normalizeSearchText(originalQuery);
  const tokens = tokenizeSearch(originalQuery);
  const genericTerms = tokens.filter((term) => GENERIC_QUERY_TERMS.has(term));
  const significantTerms = tokens.filter((term) => !GENERIC_QUERY_TERMS.has(term));
  const matchedSearchGroups = getMatchedSearchGroups(normalizedQuery);
  const matchedEntryMap = new Map();

  // We score intent entries against the user query first, before touching profiles.
  // This keeps body-part and condition terms more important than weak generic words.
  context.entries.forEach((entry) => {
    const directMatch = (() => {
      const matchedBodyRegions = entry.bodyRegions.filter((term) => phraseMatchesText(normalizedQuery, term));
      const matchedSymptoms = entry.symptoms.filter((term) => phraseMatchesText(normalizedQuery, term));
      const matchedSynonyms = entry.synonyms.filter((term) => phraseMatchesText(normalizedQuery, term));
      const matchedInformal = entry.informalTerms.filter((term) => phraseMatchesText(normalizedQuery, term));
      const matchedSpecialties = entry.specialtyTerms.filter((term) => phraseMatchesText(normalizedQuery, term));
      const matchedRelatedSpecialties = entry.relatedSpecialtyTerms.filter((term) => phraseMatchesText(normalizedQuery, term));
      const matchedAssociated = entry.associatedKeywords.filter((term) => phraseMatchesText(normalizedQuery, term));
    const score =
      matchedBodyRegions.length * 100 +
      matchedSpecialties.length * 80 +
      matchedRelatedSpecialties.length * 60 +
      matchedSymptoms.length * 70 +
      (matchedSynonyms.length + matchedInformal.length) * 50 +
      matchedAssociated.length * 40 +
      (matchedSpecialties.length || matchedRelatedSpecialties.length ? 70 : 0);

      if (!score) return null;

      return {
        ...entry,
        score,
        matchedBodyRegions,
        matchedSymptoms,
        matchedSynonyms,
        matchedInformal,
        matchedSpecialties,
        matchedRelatedSpecialties,
        matchedAssociated,
      };
    })();

    if (directMatch) {
      matchedEntryMap.set(entry.id, directMatch);
    }
  });

  matchedSearchGroups.forEach((group) => {
    context.entries.forEach((entry) => {
      const expansionMatch = buildExpansionIntentMatch(entry, group.expansionTerms, group.matchedTriggers);
      if (!expansionMatch) return;

      matchedEntryMap.set(
        entry.id,
        mergeIntentMatch(matchedEntryMap.get(entry.id), expansionMatch)
      );
    });
  });

  const matchedEntries = Array.from(matchedEntryMap.values())
    .sort((a, b) => b.score - a.score);

  const primaryEntry = matchedEntries[0] || null;
  const primaryIntentCandidates = primaryEntry
    ? uniqueTerms([
      ...significantTerms.filter((term) =>
        primaryEntry.matchedBodyRegions.includes(term) ||
        primaryEntry.matchedSymptoms.includes(term) ||
        primaryEntry.matchedInformal.includes(term) ||
        primaryEntry.matchedSynonyms.includes(term)
      ),
      ...primaryEntry.matchedBodyRegions,
      ...primaryEntry.matchedSymptoms,
      ...primaryEntry.matchedInformal,
      ...primaryEntry.matchedSynonyms,
      ...primaryEntry.matchedSpecialties,
      ...primaryEntry.matchedRelatedSpecialties,
      ...primaryEntry.matchedAssociated,
    ])
    : [];
  const primaryIntent = primaryIntentCandidates[0]
    || significantTerms.sort((a, b) => b.length - a.length)[0]
    || genericTerms[0]
    || '';

  const relatedTerms = uniqueTerms([
    ...matchedEntries.flatMap((entry) => getIntentSignals(entry)),
    ...matchedSearchGroups.flatMap((group) => group.expansionTerms),
  ]);
  const chips = uniqueTerms([
    ...matchedSearchGroups.flatMap((group) => group.expansionTerms),
    ...(primaryEntry ? primaryEntry.matchedBodyRegions : []),
    ...(primaryEntry ? primaryEntry.matchedSymptoms : []),
    ...(primaryEntry ? primaryEntry.symptoms : []),
    ...(primaryEntry ? primaryEntry.associatedKeywords : []),
    ...(primaryEntry ? primaryEntry.specialtyTerms.filter((term) => !term.includes('fisioterapia')) : []),
    ...(primaryEntry ? primaryEntry.relatedSpecialtyTerms.filter((term) => !term.includes('fisioterapia')) : []),
    ...(primaryEntry ? primaryEntry.synonyms : []),
    ...significantTerms,
  ])
    .filter((term) => term && !GENERIC_QUERY_TERMS.has(term))
    .slice(0, 8);

  const expandedTerms = uniqueTerms([
    ...significantTerms,
    ...relatedTerms,
    ...genericTerms,
  ]);

  return {
    originalQuery,
    normalizedQuery,
    tokens,
    genericTerms,
    significantTerms,
    expandedTerms,
    matchedEntries,
    matchedSearchGroups,
    primaryEntry,
    primaryIntent,
    chips,
    minimumScore: significantTerms.length ? 30 : 8,
    fallbackScore: significantTerms.length ? 10 : 3,
  };
}

function expandPatientSearch(query, context = buildSearchContext()) {
  return analyzeSearchIntent(query, context).expandedTerms;
}

function getProfileNameText(profile) {
  return normalizeSearchText([
    profile.nome,
    profile.name,
    profile.titulo,
    profile.title,
  ].filter(Boolean).join(' '));
}

function getProfileBioText(profile) {
  return normalizeSearchText([
    profile.descricao,
    profile.bio,
    profile.atendimento,
    profile.attendance,
  ].filter(Boolean).join(' '));
}

function collectSearchableValues(value, bucket = []) {
  if (value == null) return bucket;

  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchableValues(item, bucket));
    return bucket;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      if (/^(id|_id|avatar|image|photo|foto|senha|password|token)$/i.test(key)) return;
      collectSearchableValues(child, bucket);
    });
    return bucket;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = normalizeSearchText(String(value));
    if (normalized) bucket.push(normalized);
  }

  return bucket;
}

function getProfileTagText(profile) {
  return normalizeSearchText([
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
  return uniqueTerms(collectSearchableValues(profile)).join(' ');
}

function getProfileSearchFields(profile) {
  return {
    specialtyText: getSearchableSpecialties(profile),
    bioText: getProfileBioText(profile),
    nameText: getProfileNameText(profile),
    tagText: getProfileTagText(profile),
    cityText: normalizeSearchText(profile.cidade || profile.city),
    neighborhoodText: normalizeSearchText(profile.bairro || profile.neighborhood),
    profileText: getProfileSearchText(profile),
  };
}

function scoreProfileRelevance(profile, analysis, options = {}) {
  const { city = '', neighborhood = '' } = options;
  const fields = getProfileSearchFields(profile);
  const reasons = [];
  let score = 0;
  let hasStrongRelevance = false;
  let hasSearchRelevance = !analysis.significantTerms.length && !analysis.normalizedQuery;
  const hasPhoto = Boolean(profile.foto || profile.photoUrl || profile.photo_url || profile.avatar_url);
  const hasBio = Boolean(profile.descricao || profile.bio);

  if (analysis.normalizedQuery && fields.specialtyText.includes(analysis.normalizedQuery)) {
    score += 100;
    hasStrongRelevance = true;
    hasSearchRelevance = true;
    reasons.push(`specialty exact query match: ${analysis.normalizedQuery}`);
  } else if (analysis.normalizedQuery && fields.profileText.includes(analysis.normalizedQuery)) {
    score += 15;
    hasSearchRelevance = true;
    reasons.push(`profile exact query match: ${analysis.normalizedQuery}`);
  }

  const seenMatches = new Set();
  const matchedSpecialties = [];
  // Only the top detected intents are allowed to shape ranking.
  // This prevents distant specialties from accumulating points through random overlap.
  const intentEntries = (analysis.matchedEntries || []).slice(0, 3);

  intentEntries.forEach((entry, entryIndex) => {
    const queryDrivenTerms = uniqueTerms([
      ...entry.matchedBodyRegions,
      ...entry.matchedSymptoms,
      ...entry.matchedSynonyms,
      ...entry.matchedInformal,
      ...entry.matchedSpecialties,
      ...entry.matchedRelatedSpecialties,
      ...entry.matchedAssociated,
    ]);
    // The primary detected intent can use its related specialties for fallback.
    // Secondary intents should not expand again into their own related lists,
    // otherwise one search can drift too far from the patient's real need.
    const canUseRelatedSpecialties =
      entryIndex === 0 ||
      entry.matchedSpecialties.length ||
      entry.matchedBodyRegions.length ||
      entry.matchedSymptoms.length ||
      entry.matchedSynonyms.length ||
      entry.matchedInformal.length;
    const supportTerms = uniqueTerms([
      ...entry.bodyRegions,
      ...entry.symptoms,
      ...entry.synonyms,
      ...entry.informalTerms,
    ]).filter((term) => !queryDrivenTerms.includes(term));
    const specialtyMatches = getMatchedTerms(fields.specialtyText, entry.specialtyTerms);
    const relatedSpecialtyMatches = canUseRelatedSpecialties
      ? getMatchedTerms(fields.specialtyText, entry.relatedSpecialtyTerms)
      : [];
    const bodyRegionMatches = getMatchedTerms(`${fields.specialtyText} ${fields.tagText} ${fields.profileText}`, entry.matchedBodyRegions);
    const symptomMatches = getMatchedTerms(`${fields.specialtyText} ${fields.tagText} ${fields.profileText}`, entry.matchedSymptoms);
    const synonymMatches = getMatchedTerms(`${fields.specialtyText} ${fields.tagText} ${fields.profileText}`, [...entry.matchedSynonyms, ...entry.matchedInformal]);
    const bioMatches = getMatchedTerms(fields.bioText, queryDrivenTerms);
    const tagMatches = getMatchedTerms(fields.tagText, queryDrivenTerms);
    const nameMatches = getMatchedTerms(fields.nameText, queryDrivenTerms);
    const unrelatedMatches = getMatchedTerms(fields.specialtyText, entry.unrelatedSpecialties);

    if (specialtyMatches.length && !seenMatches.has(`specialty-group:${entry.id}`)) {
      seenMatches.add(`specialty-group:${entry.id}`);
      score += 100;
      hasStrongRelevance = true;
      hasSearchRelevance = true;
      matchedSpecialties.push(specialtyMatches[0]);
      reasons.push(`specialty match: ${specialtyMatches.join(', ')}`);
    }

    if (relatedSpecialtyMatches.length && !seenMatches.has(`related-specialty-group:${entry.id}`)) {
      seenMatches.add(`related-specialty-group:${entry.id}`);
      score += 65;
      hasStrongRelevance = true;
      hasSearchRelevance = true;
      reasons.push(`related specialty match: ${relatedSpecialtyMatches.join(', ')}`);
    }

    bodyRegionMatches.forEach((term) => {
      const key = `body:${term}`;
      if (seenMatches.has(key)) return;
      seenMatches.add(key);
      score += 80;
      hasStrongRelevance = true;
      hasSearchRelevance = true;
      reasons.push(`body-region match: ${term}`);
    });

    symptomMatches.forEach((term) => {
      const key = `symptom:${term}`;
      if (seenMatches.has(key)) return;
      seenMatches.add(key);
      score += 80;
      hasStrongRelevance = true;
      hasSearchRelevance = true;
      reasons.push(`symptom match: ${term}`);
    });

    synonymMatches.forEach((term) => {
      const key = `synonym:${term}`;
      if (seenMatches.has(key)) return;
      seenMatches.add(key);
      score += 80;
      hasStrongRelevance = true;
      hasSearchRelevance = true;
      reasons.push(`related synonym match: ${term}`);
    });

    const hasIntentAnchor =
      specialtyMatches.length ||
      relatedSpecialtyMatches.length ||
      bodyRegionMatches.length ||
      symptomMatches.length ||
      synonymMatches.length ||
      bioMatches.length ||
      tagMatches.length ||
      nameMatches.length;

    // Support keywords only help after the profile has shown a real anchor match
    // such as specialty, body region, symptom, or direct query-driven bio match.
    if (hasIntentAnchor) {
      const supportMatches = getMatchedTerms(
        `${fields.specialtyText} ${fields.tagText} ${fields.profileText}`,
        [...supportTerms, ...entry.associatedKeywords]
      );

      supportMatches.forEach((term) => {
        const key = `support:${term}`;
        if (seenMatches.has(key)) return;
        seenMatches.add(key);
        score += 15;
        hasSearchRelevance = true;
        reasons.push(`support keyword match: ${term}`);
      });
    }

    bioMatches.forEach((term) => {
      const key = `bio:${term}`;
      if (seenMatches.has(key)) return;
      seenMatches.add(key);
      score += 15;
      hasSearchRelevance = true;
      reasons.push(`bio match: ${term}`);
    });

    tagMatches.forEach((term) => {
      const key = `tag:${term}`;
      if (seenMatches.has(key)) return;
      seenMatches.add(key);
      score += 15;
      hasSearchRelevance = true;
      reasons.push(`tag match: ${term}`);
    });

    nameMatches.forEach((term) => {
      const key = `name:${term}`;
      if (seenMatches.has(key)) return;
      seenMatches.add(key);
      score += 10;
      hasSearchRelevance = true;
      reasons.push(`name match: ${term}`);
    });

    unrelatedMatches.forEach((term) => {
      const key = `unrelated:${term}`;
      if (seenMatches.has(key)) return;
      seenMatches.add(key);
      const penalty = term === 'dermatofuncional' && entry.id !== 'dermatofuncional' ? 80 : 30;
      score -= penalty;
      reasons.push(`unrelated specialty penalty: ${term}`);
    });
  });

  const genericMatches = getMatchedTerms(fields.profileText, analysis.genericTerms);
  genericMatches.forEach((term) => {
    score += 2;
    reasons.push(`generic term match: ${term}`);
  });

  if (!hasStrongRelevance && genericMatches.length && score <= genericMatches.length * 3) {
    score -= 40;
    reasons.push('only generic terms matched');
  }

  if (city) {
    if (fields.cityText === city) {
      score += 40;
      reasons.push(`exact city match: ${city}`);
    } else if (fields.cityText.includes(city)) {
      score += 20;
      reasons.push(`partial city match: ${city}`);
    }
  }

  if (neighborhood) {
    if (fields.neighborhoodText === neighborhood) {
      score += 25;
      reasons.push(`exact neighborhood match: ${neighborhood}`);
    } else if (fields.neighborhoodText.includes(neighborhood)) {
      score += 12;
      reasons.push(`partial neighborhood match: ${neighborhood}`);
    }
  }

  if (hasPhoto) score += 3;
  if (hasBio) score += 3;

  let tier = 4;
  if (score >= 140) tier = 1;
  else if (score >= 80) tier = 2;
  else if (score >= analysis.fallbackScore) tier = 3;

  return {
    profile,
    score,
    tier,
    reasons,
    matchedSpecialty: matchedSpecialties[0] || '',
    hasSearchRelevance,
  };
}

function calculateRelevance(profile, query, expandedTerms = []) {
  const context = buildSearchContext([profile]);
  const analysis = expandedTerms?.__analysis || analyzeSearchIntent(query, context);
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

function shuffleWithinScoreBands(items) {
  const byScore = new Map();

  items.forEach((item) => {
    const scoreKey = item.score;
    if (!byScore.has(scoreKey)) byScore.set(scoreKey, []);
    byScore.get(scoreKey).push(item);
  });

  return Array.from(byScore.entries())
    .sort((a, b) => b[0] - a[0])
    .flatMap(([, sameScoreItems]) => shuffleArray(sameScoreItems));
}

function rankProfilesByRelevance(profiles, analysis, options = {}) {
  const requiresSearchRelevance = Boolean(analysis.normalizedQuery || analysis.significantTerms.length);
  const requestedCity = normalizeSearchText(options.city || '');
  const rankedProfiles = profiles
    .map((profile) => scoreProfileRelevance(profile, analysis, options))
    .sort((a, b) => b.score - a.score);

  const ordered = shuffleWithinScoreBands(rankedProfiles);
  // Visible results must pass both a base relevance floor and a relative floor
  // based on the strongest match, so weak matches do not float beside strong ones.
  const topScore = ordered[0]?.score || 0;
  const dynamicMinimumScore = topScore >= 160
    ? Math.max(analysis.minimumScore, Math.floor(topScore * 0.45))
    : analysis.minimumScore;
  const visible = ordered.filter((item) =>
    item.score >= dynamicMinimumScore &&
    (!requiresSearchRelevance || item.hasSearchRelevance)
  );
  const fallback = ordered.filter((item) =>
    item.score >= analysis.fallbackScore &&
    (!requiresSearchRelevance || item.hasSearchRelevance)
  );

  if (requestedCity) {
    const isRequestedCity = (item) =>
      normalizeSearchText(item.profile.cidade || item.profile.city) === requestedCity;
    const isExactSpecialty = (item) =>
      item.reasons.some((reason) =>
        reason.startsWith('specialty exact query match') ||
        reason.startsWith('specialty match')
      );
    const relevant = ordered.filter((item) =>
      item.score >= analysis.fallbackScore &&
      (!requiresSearchRelevance || item.hasSearchRelevance)
    );
    const exactInCity = relevant.filter((item) => isRequestedCity(item) && isExactSpecialty(item));
    const relatedInCity = relevant.filter((item) => isRequestedCity(item) && !exactInCity.includes(item));
    const exactOtherCities = relevant.filter((item) => !isRequestedCity(item) && isExactSpecialty(item));
    const relatedOtherCities = relevant.filter((item) =>
      !isRequestedCity(item) &&
      !exactOtherCities.includes(item)
    );
    const locationAwareVisible = [
      ...exactInCity,
      ...relatedInCity,
      ...exactOtherCities,
      ...relatedOtherCities,
    ];

    if (locationAwareVisible.length) {
      return {
        rankedProfiles,
        ordered: locationAwareVisible,
        visible: locationAwareVisible,
      };
    }
  }

  return {
    rankedProfiles,
    ordered,
    visible: visible.length ? visible : fallback,
  };
}

function getFallbackMessage({ mode, requestedCity, visibleItems, hasExactInRequestedCity }) {
  const relevantItems = visibleItems.filter((item) => item.score >= 30);
  if (!relevantItems.length) {
    return 'Nenhum profissional encontrado. Tente pesquisar outra especialidade ou sintoma.';
  }

  const hasRelevantInCity = requestedCity
    ? relevantItems.some((item) => normalizeSearchText(item.profile.cidade || item.profile.city) === requestedCity)
    : false;

  if (requestedCity && !hasRelevantInCity) {
    return 'Nenhum profissional encontrado nessa cidade. Mostrando op&ccedil;&otilde;es relacionadas em outras cidades.';
  }

  if (!hasExactInRequestedCity && mode === 'especialidade') {
    return 'Nenhum profissional exato encontrado. Mostrando profissionais relacionados que talvez possam ajudar.';
  }

  return '';
}

function renderFallbackMessage(message) {
  const existing = document.querySelector('.search-fallback-message');
  if (existing) existing.remove();
  if (!message) return;

  const resumo = document.getElementById('resultadoResumo');
  if (!resumo) return;

  resumo.insertAdjacentHTML(
    'afterend',
    `<p class="search-fallback-message">${message}</p>`
  );
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
    'matched fallback groups:',
    (analysis.matchedSearchGroups || []).map((group) => ({
      triggers: group.matchedTriggers,
      expansionTerms: group.expansionTerms,
    }))
  );
  console.log(
    'matched specialties:',
    analysis.matchedEntries.map((entry) => ({
      specialty: entry.specialty,
      score: entry.score,
      matchedBodyRegions: entry.matchedBodyRegions,
      matchedSymptoms: entry.matchedSymptoms,
      matchedSynonyms: entry.matchedSynonyms,
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

  const debouncedRefreshSuggestions = debounce(refreshSuggestions, 400);

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
  let searchAnalysis = analyzeSearchIntent(searchQuery, buildSearchContext());

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

    const profiles = await window.physioApi.fetchProfiles({ useCache: true });
    searchAnalysis = analyzeSearchIntent(searchQuery, buildSearchContext(profiles));

    const rankedResult = rankProfilesByRelevance(profiles, searchAnalysis, {
      city: cidade,
      neighborhood: bairro,
    });

    debugRankedResults(searchQuery, searchAnalysis, rankedResult.ordered);

    const visibleResults = rankedResult.visible;
    const isExactMatch = (item) =>
      item.reasons.some((reason) =>
        reason.startsWith('specialty exact query match') ||
        reason.startsWith('specialty match')
      );
    const isInRequestedCity = (item) =>
      !cidade || normalizeText(item.profile.cidade || item.profile.city) === cidade;
    const hasExactInRequestedCity = visibleResults.some((item) =>
      isExactMatch(item) && isInRequestedCity(item)
    );
    const fallbackMessage = getFallbackMessage({
      mode: modoBusca,
      requestedCity: cidade,
      visibleItems: visibleResults,
      hasExactInRequestedCity,
    });

    const filtered = visibleResults.map((item) => item.profile);

    const resultLabel = filtered.length === 1
      ? '1 profissional encontrado'
      : `${filtered.length} profissionais encontrados`;

    resumo.textContent = resultLabel;
    renderFallbackMessage(fallbackMessage);

    if (modoBusca === 'leigo' && queixa) {
      const existingSummary = document.querySelector('.smart-search-summary');
      if (existingSummary) existingSummary.remove();

      const hintTerms = (searchAnalysis.chips || []).slice(0, 8);
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
