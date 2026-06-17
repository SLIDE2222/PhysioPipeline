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

const CANONICAL_SPECIALTY_DEFINITIONS = {
  ortopedica: {
    label: 'Fisioterapia Ortopedica',
    aliases: ['fisioterapia ortopedica', 'ortopedica', 'ortopedia', 'traumato ortopedica', 'traumato-ortopedica', 'musculoesqueletica'],
    related: ['esportiva', 'pilates', 'rpg', 'funcional', 'pos_operatorio', 'domiciliar'],
    tags: ['joelho', 'ombro', 'coluna', 'lombar', 'cervical', 'quadril', 'tornozelo', 'calcanhar', 'mao', 'punho', 'cotovelo', 'lesao', 'dor', 'reabilitacao', 'esporte', 'menisco', 'ligamento', 'lca', 'acl'],
  },
  esportiva: {
    label: 'Fisioterapia Esportiva',
    aliases: ['fisioterapia esportiva', 'esportiva', 'esporte', 'atleta', 'corrida', 'musculacao', 'performance esportiva'],
    related: ['ortopedica', 'pilates', 'funcional', 'pos_operatorio'],
    tags: ['joelho', 'ombro', 'tornozelo', 'lesao esportiva', 'corrida', 'atleta', 'academia', 'reabilitacao', 'menisco', 'ligamento'],
  },
  pelvica: {
    label: 'Fisioterapia Pelvica',
    aliases: ['fisioterapia pelvica', 'pelvica', 'uroginecologica', 'uroginecologia', 'saude da mulher', 'obstetrica'],
    related: ['pilates'],
    tags: ['pelve', 'pelvica', 'urinaria', 'incontinencia', 'pos-parto', 'pos parto', 'gestante', 'gravidez', 'vagina', 'saude da mulher', 'dor pelvica', 'perineo', 'assoalho pelvico', 'urina', 'perereca'],
  },
  neurologica: {
    label: 'Fisioterapia Neurologica',
    aliases: ['fisioterapia neurologica', 'neurologica', 'neurofuncional', 'neuro', 'reabilitacao neurologica'],
    related: ['geriatrica', 'pilates', 'funcional', 'pediatrica', 'domiciliar'],
    tags: ['avc', 'derrame', 'parkinson', 'alzheimer', 'equilibrio', 'coordenacao', 'neurologico', 'paralisia', 'marcha', 'reabilitacao'],
  },
  respiratoria: {
    label: 'Fisioterapia Respiratoria',
    aliases: ['fisioterapia respiratoria', 'respiratoria', 'cardiorrespiratoria', 'pulmonar', 'hospitalar respiratoria'],
    related: ['hospitalar', 'geriatrica', 'domiciliar'],
    tags: ['respiracao', 'respirar', 'falta de ar', 'asma', 'bronquite', 'dpoc', 'pulmonar', 'pulmao', 'folego', 'cansaco'],
  },
  pediatrica: {
    label: 'Fisioterapia Pediatrica',
    aliases: ['fisioterapia pediatrica', 'pediatrica', 'pediatria', 'infantil', 'crianca', 'bebe'],
    related: ['neurologica', 'respiratoria'],
    tags: ['crianca', 'bebe', 'infantil', 'desenvolvimento infantil', 'atraso motor', 'marcos motores', 'torcicolo congenito'],
  },
  geriatrica: {
    label: 'Fisioterapia Geriatrica',
    aliases: ['fisioterapia geriatrica', 'geriatrica', 'geriatria', 'gerontologia', 'idoso', 'idosa'],
    related: ['neurologica', 'ortopedica', 'pilates', 'funcional', 'domiciliar'],
    tags: ['idoso', 'idosa', 'queda', 'quedas', 'risco de queda', 'equilibrio', 'marcha', 'mobilidade', 'fortalecimento'],
  },
  pilates: {
    label: 'Pilates',
    aliases: ['pilates', 'pilates clinico', 'pilates terapeutico'],
    related: ['ortopedica', 'rpg', 'funcional', 'geriatrica', 'pelvica'],
    tags: ['postura', 'coluna', 'lombar', 'cervical', 'fortalecimento', 'mobilidade', 'dor', 'qualidade de vida', 'alongamento', 'core'],
  },
  rpg: {
    label: 'RPG',
    aliases: ['rpg', 'reeducacao postural global', 'postural'],
    related: ['ortopedica', 'pilates', 'funcional'],
    tags: ['postura', 'postural', 'coluna', 'lombar', 'cervical', 'escoliose', 'dor nas costas'],
  },
  funcional: {
    label: 'Funcional',
    aliases: ['funcional', 'fisioterapia funcional', 'treinamento funcional'],
    related: ['ortopedica', 'esportiva', 'pilates', 'geriatrica'],
    tags: ['mobilidade', 'fortalecimento', 'equilibrio', 'funcao', 'reabilitacao', 'movimento'],
  },
  domiciliar: {
    label: 'Fisioterapia Domiciliar',
    aliases: ['domiciliar', 'domicilar', 'home care', 'atendimento domiciliar', 'atendimento em casa', 'fisioterapia domiciliar'],
    related: ['geriatrica', 'neurologica', 'ortopedica', 'pos_operatorio'],
    tags: ['home care', 'casa', 'atendimento em casa', 'idoso', 'mobilidade', 'pos-operatorio', 'pos operatorio', 'acamado'],
  },
  pos_operatorio: {
    label: 'Pos-operatorio',
    aliases: ['pos-operatorio', 'pos operatorio', 'pos cirurgia', 'pos-cirurgico', 'reabilitacao pos operatoria', 'reabilitacao pos-operatoria'],
    related: ['ortopedica', 'dermatofuncional', 'domiciliar', 'hospitalar'],
    tags: ['cirurgia', 'recuperacao', 'reabilitacao', 'pos-cirurgico', 'hospitalar', 'lca', 'menisco', 'protese'],
  },
  dermatofuncional: {
    label: 'Fisioterapia Dermatofuncional',
    aliases: ['dermatofuncional', 'estetica', 'drenagem', 'drenagem linfatica', 'fisioterapia dermatofuncional'],
    related: ['pos_operatorio'],
    tags: ['pele', 'celulite', 'gordura', 'drenagem', 'linfedema', 'fibrose', 'cicatriz', 'pos operatorio estetico', 'pos lipo'],
  },
  acupuntura: {
    label: 'Acupuntura',
    aliases: ['acupuntura', 'agulhamento', 'agulhamento seco'],
    related: ['ortopedica', 'funcional'],
    tags: ['dor', 'agulhamento', 'alivio', 'tensao', 'bem-estar', 'bem estar', 'contratura'],
  },
  hospitalar: {
    label: 'Fisioterapia Hospitalar',
    aliases: ['hospitalar', 'fisioterapia hospitalar', 'uti'],
    related: ['respiratoria', 'cardiorrespiratoria', 'pos_operatorio', 'geriatrica'],
    tags: ['hospital', 'uti', 'internacao', 'pos operatorio', 'respiratoria', 'mobilidade'],
  },
};

// This is the main intent catalog for patient-language searches.
// Each entry describes how a clínical area can be discovered from body parts,
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

function mergeDynamicOptionPayloads(...optionSets) {
  const merged = {
    cities: [],
    neighborhoods: [],
    neighborhoodsByCity: {},
    specialties: [],
  };

  optionSets.forEach((options) => {
    if (!options) return;

    merged.cities = mergeOptionLists(merged.cities, options.cities || []);
    merged.neighborhoods = mergeOptionLists(merged.neighborhoods, options.neighborhoods || []);
    merged.specialties = mergeOptionLists(merged.specialties, options.specialties || []);

    Object.entries(options.neighborhoodsByCity || {}).forEach(([city, neighborhoods]) => {
      merged.neighborhoodsByCity[city] = mergeOptionLists(
        merged.neighborhoodsByCity[city] || [],
        neighborhoods || []
      );
    });
  });

  return merged;
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
    const [profileOptions, clinicOptions] = await Promise.all([
      window.physioApi.fetchProfileOptions({ useCache: true }),
      window.physioApi.fetchClinicOptions ? window.physioApi.fetchClinicOptions() : Promise.resolve(null),
    ]);
    const options = mergeDynamicOptionPayloads(profileOptions, clinicOptions);
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
    .replace(/['â€™`]/g, ' ')
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

function getCanonicalSpecialty(value = '') {
  const normalized = normalizeSearchText(value);
  if (!normalized) return '';

  const aliasMatches = Object.entries(CANONICAL_SPECIALTY_DEFINITIONS)
    .flatMap(([slug, definition]) => (definition.aliases || []).map((alias) => ({
      slug,
      alias: normalizeSearchText(alias),
    })))
    .filter(({ alias }) => alias && phraseMatchesText(normalized, alias))
    .sort((a, b) => b.alias.length - a.alias.length);

  return aliasMatches[0]?.slug || '';
}

function getSpecialtySlug(value = '') {
  return getCanonicalSpecialty(value) || normalizeSearchText(value).replace(/[\s-]+/g, '_');
}

function getCanonicalRelatedSpecialties(slug = '') {
  const definition = CANONICAL_SPECIALTY_DEFINITIONS[slug];
  if (!definition) return [];
  return uniqueTerms([...(definition.related || [])]);
}

function getCanonicalSpecialtyTags(slug = '') {
  const definition = CANONICAL_SPECIALTY_DEFINITIONS[slug];
  if (!definition) return [];
  return uniqueTerms([
    slug,
    definition.label,
    ...(definition.aliases || []),
    ...(definition.tags || []),
    ...(definition.related || []),
  ].map(normalizeSearchText).filter(isMeaningfulIntentTerm));
}

function getRelatedSpecialties(value) {
  const normalized = normalizeSearchText(value);
  const words = getWordsFromLabel(value);
  const related = getCanonicalRelatedSpecialties(getCanonicalSpecialty(value));

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
    ...Object.entries(CANONICAL_SPECIALTY_DEFINITIONS).map(([slug, definition]) => ({
      id: slug,
      specialty: definition.label,
      specialtyAliases: [slug, ...(definition.aliases || [])],
      relatedSpecialties: (definition.related || []).map((relatedSlug) =>
        CANONICAL_SPECIALTY_DEFINITIONS[relatedSlug]?.label || relatedSlug
      ),
      bodyRegions: [],
      symptoms: definition.tags || [],
      synonyms: definition.aliases || [],
      informalTerms: [],
      associatedKeywords: [...(definition.tags || []), ...(definition.related || [])],
      unrelatedSpecialties: [],
    })),
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

function getProfileSpecialtyValues(profile) {
  return [
    profile.especialidade,
    profile.specialty,
    profile.especialidadeSecundaria,
    profile.secondarySpecialty,
    profile.especialidadeTerciaria,
    profile.tertiarySpecialty,
    profile.specialization,
    profile.specialty2,
    profile.extraSpecialty,
  ].flat().filter(Boolean);
}

function getProfileCanonicalSlugs(profile) {
  const specialtySlugs = getProfileSpecialtyValues(profile)
    .map(getCanonicalSpecialty)
    .filter(Boolean);
  const bioText = getProfileBioText(profile);
  const serviceText = normalizeSearchText([
    profile.atendimento,
    profile.attendance,
    profile.serviceType,
    profile.service_type,
    profile.modalidade,
  ].filter(Boolean).join(' '));
  const detectedFromBio = Object.entries(CANONICAL_SPECIALTY_DEFINITIONS)
    .filter(([, definition]) =>
      (definition.aliases || []).some((alias) => {
        const term = normalizeSearchText(alias);
        return term.length > 4 && (phraseMatchesText(bioText, term) || phraseMatchesText(serviceText, term));
      })
    )
    .map(([slug]) => slug);

  return uniqueTerms([...specialtySlugs, ...detectedFromBio]);
}

function getProfileSearchTags(profile) {
  const canonicalSlugs = getProfileCanonicalSlugs(profile);
  const profileTags = [
    profile.keywords,
    profile.tags,
    profile.searchKeywords,
    profile.searchTags,
    profile.treatments,
    profile.treatmentTags,
  ].flat().filter(Boolean);

  return uniqueTerms([
    ...canonicalSlugs,
    ...canonicalSlugs.flatMap(getCanonicalSpecialtyTags),
    ...profileTags.map(normalizeSearchText),
  ].filter(Boolean));
}

function getProfileSearchKeywords(profile) {
  return uniqueTerms([
    ...getProfileSearchTags(profile),
    ...getProfileSpecialtyValues(profile).flatMap(getWordsFromLabel),
    ...tokenizeSearch(getProfileBioText(profile)),
  ].filter(isMeaningfulIntentTerm));
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
    getProfileSearchTags(profile),
  ].flat().filter(Boolean).join(' '));
}

function getProfileSearchText(profile) {
  return uniqueTerms(collectSearchableValues(profile)).join(' ');
}

function getProfileSearchFields(profile) {
  const canonicalSlugs = getProfileCanonicalSlugs(profile);
  const searchTags = getProfileSearchTags(profile);
  return {
    specialtyText: getSearchableSpecialties(profile),
    bioText: getProfileBioText(profile),
    nameText: getProfileNameText(profile),
    tagText: getProfileTagText(profile),
    canonicalSlugs,
    canonicalText: normalizeSearchText(canonicalSlugs.join(' ')),
    keywordText: normalizeSearchText(getProfileSearchKeywords(profile).join(' ')),
    searchTags,
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
  const queryCanonicalSlug = getCanonicalSpecialty(analysis.normalizedQuery);

  if (analysis.normalizedQuery && fields.specialtyText.includes(analysis.normalizedQuery)) {
    score += 100;
    hasStrongRelevance = true;
    hasSearchRelevance = true;
    reasons.push(`specialty exact query match: ${analysis.normalizedQuery}`);
  } else if (queryCanonicalSlug && fields.canonicalSlugs.includes(queryCanonicalSlug)) {
    score += 90;
    hasStrongRelevance = true;
    hasSearchRelevance = true;
    reasons.push(`canonical specialty match: ${queryCanonicalSlug}`);
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
    const entryCanonicalSlug = CANONICAL_SPECIALTY_DEFINITIONS[entry.id]
      ? entry.id
      : getCanonicalSpecialty(entry.specialty);
    const canonicalSpecialtyMatch =
      entryCanonicalSlug && fields.canonicalSlugs.includes(entryCanonicalSlug);
    const canonicalRelatedMatches = entryCanonicalSlug
      ? fields.canonicalSlugs.filter((slug) => getCanonicalRelatedSpecialties(entryCanonicalSlug).includes(slug))
      : [];
    const relatedSpecialtyMatches = canUseRelatedSpecialties
      ? getMatchedTerms(fields.specialtyText, entry.relatedSpecialtyTerms)
      : [];
    const bodyRegionMatches = getMatchedTerms(`${fields.specialtyText} ${fields.tagText} ${fields.profileText}`, entry.matchedBodyRegions);
    const symptomMatches = getMatchedTerms(`${fields.specialtyText} ${fields.tagText} ${fields.profileText}`, entry.matchedSymptoms);
    const synonymMatches = getMatchedTerms(`${fields.specialtyText} ${fields.tagText} ${fields.profileText}`, [...entry.matchedSynonyms, ...entry.matchedInformal]);
    const bioMatches = getMatchedTerms(fields.bioText, queryDrivenTerms);
    const tagMatches = getMatchedTerms(`${fields.tagText} ${fields.keywordText}`, queryDrivenTerms);
    const nameMatches = getMatchedTerms(fields.nameText, queryDrivenTerms);
    const unrelatedMatches = uniqueTerms([
      ...getMatchedTerms(fields.specialtyText, entry.unrelatedSpecialties),
      ...fields.canonicalSlugs.filter((slug) => entry.unrelatedSpecialties.includes(slug)),
    ]);

    if (specialtyMatches.length && !seenMatches.has(`specialty-group:${entry.id}`)) {
      seenMatches.add(`specialty-group:${entry.id}`);
      score += 100;
      hasStrongRelevance = true;
      hasSearchRelevance = true;
      matchedSpecialties.push(specialtyMatches[0]);
      reasons.push(`specialty match: ${specialtyMatches.join(', ')}`);
    }

    if (canonicalSpecialtyMatch && !specialtyMatches.length && !seenMatches.has(`canonical-group:${entry.id}`)) {
      seenMatches.add(`canonical-group:${entry.id}`);
      score += 90;
      hasStrongRelevance = true;
      hasSearchRelevance = true;
      matchedSpecialties.push(entryCanonicalSlug);
      reasons.push(`canonical specialty match: ${entryCanonicalSlug}`);
    }

    if (relatedSpecialtyMatches.length && !seenMatches.has(`related-specialty-group:${entry.id}`)) {
      seenMatches.add(`related-specialty-group:${entry.id}`);
      score += 60;
      hasStrongRelevance = true;
      hasSearchRelevance = true;
      reasons.push(`related specialty match: ${relatedSpecialtyMatches.join(', ')}`);
    }

    if (canonicalRelatedMatches.length && !relatedSpecialtyMatches.length && !seenMatches.has(`canonical-related-group:${entry.id}`)) {
      seenMatches.add(`canonical-related-group:${entry.id}`);
      score += 60;
      hasStrongRelevance = true;
      hasSearchRelevance = true;
      reasons.push(`canonical related specialty match: ${canonicalRelatedMatches.join(', ')}`);
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
      score += 20;
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

function calculateProfileRelevance(profile, analysisOrQuery, options = {}) {
  const analysis = typeof analysisOrQuery === 'string'
    ? analyzeSearchIntent(analysisOrQuery, buildSearchContext([profile]))
    : analysisOrQuery;

  return scoreProfileRelevance(profile, analysis, options);
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
  return shuffleWithinRelevanceGroups(items);
}

function rankProfilesByRelevance(profiles, analysis, options = {}) {
  const requiresSearchRelevance = Boolean(analysis.normalizedQuery || analysis.significantTerms.length);
  const requestedCity = normalizeSearchText(options.city || '');
  const rankedProfiles = profiles
    .map((profile) => scoreProfileRelevance(profile, analysis, options));

  const ordered = prioritizeCityFallback(rankedProfiles, requestedCity);
  const topScore = ordered[0]?.score || 0;
  const dynamicMinimumScore = topScore >= 160
    ? Math.max(analysis.minimumScore, Math.floor(topScore * 0.45))
    : analysis.minimumScore;

  const exactMatches = ordered.filter((item) =>
    item.reasons.some((reason) =>
      reason.startsWith('specialty exact query match') ||
      reason.startsWith('specialty match') ||
      reason.startsWith('canonical specialty match')
    ) && (!requiresSearchRelevance || item.hasSearchRelevance)
  );
  const closeMatches = ordered.filter((item) =>
    !exactMatches.includes(item) &&
    item.score >= dynamicMinimumScore &&
    (!requiresSearchRelevance || item.hasSearchRelevance)
  );
  const relatedMatches = ordered.filter((item) =>
    !exactMatches.includes(item) &&
    !closeMatches.includes(item) &&
    item.score >= analysis.fallbackScore &&
    (!requiresSearchRelevance || item.hasSearchRelevance)
  );
  const sameCityFallback = ordered.filter((item) =>
    !exactMatches.includes(item) &&
    !closeMatches.includes(item) &&
    !relatedMatches.includes(item) &&
    requestedCity &&
    normalizeSearchText(item.profile.cidade || item.profile.city) === requestedCity
  );
  const broadFallback = ordered.filter((item) =>
    !exactMatches.includes(item) &&
    !closeMatches.includes(item) &&
    !relatedMatches.includes(item) &&
    !sameCityFallback.includes(item)
  );

  const visible = [
    ...prioritizeCityFallback(exactMatches, requestedCity),
    ...prioritizeCityFallback(closeMatches, requestedCity),
    ...prioritizeCityFallback(relatedMatches, requestedCity),
    ...prioritizeCityFallback(sameCityFallback, requestedCity),
    ...prioritizeCityFallback(broadFallback, requestedCity),
  ].filter((item, index, arr) => arr.indexOf(item) === index);

  return {
    rankedProfiles,
    ordered,
    visible,
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
    const modeToggle = form.querySelector('.search-mode-toggle');
    const specialtyField = form.querySelector('.specialty-search-field');
    const patientField = form.querySelector('.patient-search-field');
    const specialtyInput = specialtyField?.querySelector('input[name="especialidade"]');
    const patientInput = patientField?.querySelector('input[name="queixa"]');
    const titleTarget = form.querySelector('[data-search-title]') || document.querySelector('[data-search-title]');
    const subtitleTarget = form.querySelector('[data-search-subtitle]') || document.querySelector('[data-search-subtitle]');
    const specialtyLabel = form.querySelector('[data-specialty-label]');
    const cityLabel = form.querySelector('[data-city-label]');
    const neighborhoodLabel = form.querySelector('[data-neighborhood-label]');
    const submitButton = form.querySelector('button[type="submit"]');

    if (!modeInputs.length || !specialtyField || !patientField) return;

    if (modeToggle) modeToggle.classList.add('search-mode-toggle--triple');

    const syncMode = () => {
      const mode = modeInputs.find((input) => input.checked)?.value || 'especialidade';
      const isPatientMode = mode === 'leigo';
      const isClinicMode = mode === 'clinica';

      specialtyField.hidden = isPatientMode || isClinicMode;
      patientField.hidden = !isPatientMode;

      if (specialtyInput) specialtyInput.required = !isPatientMode && !isClinicMode;
      if (patientInput) patientInput.required = isPatientMode;

      if (titleTarget) {
        titleTarget.textContent = isClinicMode
          ? 'Encontre uma clínica'
          : 'Encontre um fisioterapeuta';
      }

      if (subtitleTarget) {
        subtitleTarget.textContent = isClinicMode
          ? 'Escolha a cidade e, se quiser, refine pelo bairro para ver clínicas da regiao.'
          : 'Digite a area que voce procura e veja sugestoes automaticamente.';
      }

      if (specialtyLabel) specialtyLabel.textContent = 'Especialidade';
      if (cityLabel) cityLabel.textContent = 'Cidade';
      if (neighborhoodLabel) neighborhoodLabel.textContent = isClinicMode ? 'Bairro (opcional)' : 'Bairro';

      if (submitButton) {
        submitButton.textContent = isClinicMode ? 'Buscar clínicas' : 'Pesquisar agora';
      }
    };

    modeInputs.forEach((input) => input.addEventListener('change', syncMode));
    syncMode();
  });
}

async function getLoggedUser(force = false) {
  if (!force && cachedMyProfile) return cachedMyProfile;

  const authStart = performance.now();

  try {
    const auth =
      window.physioApi.getStoredAuth?.() ||
      await waitForAuthStorage();

    console.info(`PhysioPipeline auth/session: storage lido em ${Math.round(performance.now() - authStart)}ms`);

    if (!auth?.token) {
      cachedMyProfile = null;
      console.info(`PhysioPipeline auth/session: sem sessão em ${Math.round(performance.now() - authStart)}ms`);
      return null;
    }

    let rawUser = auth.user || {};
    const storedHasProfileId = Boolean(
      rawUser.profiles?.[0]?.id ||
      rawUser.profile?.id
    );
    const storedHasClinicProfileId = Boolean(rawUser.clinicProfile?.id);

    if ((!storedHasProfileId && !storedHasClinicProfileId) && window.physioApi.me) {
      try {
        const meData = await window.physioApi.me();
        rawUser = meData?.user ?? meData ?? rawUser;
        console.info(`PhysioPipeline auth/session: /auth/me concluido em ${Math.round(performance.now() - authStart)}ms`);
      } catch (error) {
        console.warn('Using stored auth fallback because /auth/me failed:', error);
      }
    }

    const accountType = window.PhysioAccountTypes?.normalizeAccountType
      ? window.PhysioAccountTypes.normalizeAccountType(rawUser.accountType)
      : 'physio';
    const resolvedAccountType =
      accountType === 'clinic' || rawUser?.clinicProfile?.id || rawUser?.clinicProfileId
        ? 'clinic'
        : 'physio';

    console.info('PhysioPipeline profile lookup accountType:', resolvedAccountType);

    let profile = null;
    let clinicProfile = rawUser.clinicProfile
      ? window.physioApi?.normalizeClinicProfile?.(rawUser.clinicProfile) || rawUser.clinicProfile
      : null;

    const storedProfileId =
      rawUser.profiles?.[0]?.id ||
      rawUser.profile?.id ||
      null;

    if (resolvedAccountType === 'clinic') {
      if (window.physioApi.fetchMyClinicProfile) {
        try {
          console.info('PhysioPipeline profile lookup route called: /clinics/me');
          clinicProfile = await window.physioApi.fetchMyClinicProfile();
        } catch (error) {
          console.error('PhysioPipeline clinic session lookup failed:', error);
          if (!clinicProfile && rawUser.clinicProfile?.id) {
            clinicProfile = window.physioApi?.normalizeClinicProfile?.(rawUser.clinicProfile) || rawUser.clinicProfile;
          }
        }
      }
    } else {
      if (storedProfileId && window.physioApi.fetchProfile) {
        try {
          console.info('PhysioPipeline profile lookup route called: /profiles/:id');
          profile = await window.physioApi.fetchProfile(storedProfileId);
        } catch (_) {
          profile = { id: storedProfileId };
        }
      }

      if (!profile && window.physioApi.fetchMyProfile) {
        try {
          console.info('PhysioPipeline profile lookup route called: /profiles/me');
          profile = await window.physioApi.fetchMyProfile();
        } catch (_) {
          profile = null;
        }
      }
    }

    cachedMyProfile = {
      id: rawUser.id ?? null,
      email: rawUser.email ?? '',
      name: rawUser.name ?? '',
      phone: rawUser.phone ?? '',
      accountType: resolvedAccountType,
      emailVerified: rawUser.emailVerified ?? false,
      profile,
      clinicProfile,
    };

    console.info(`PhysioPipeline auth/session: carregado em ${Math.round(performance.now() - authStart)}ms`);
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
  return window.physioApi?.resolveUserHomePath?.(user) || 'profile.html';
}

function isClinicAccountUser(user) {
  return Boolean(
    user?.accountType === 'clinic' ||
    user?.clinicProfile?.id ||
    user?.clinicProfileId
  );
}

function isOwnPublicClinicProfilePage(user) {
  if (!isClinicAccountUser(user)) return false;

  const pageName = window.location.pathname.split('/').pop() || 'index.html';
  if (pageName !== 'profile.html') return false;

  const params = new URLSearchParams(window.location.search);
  if ((params.get('type') || '').toLowerCase() !== 'clinic') return false;

  const currentProfileId = params.get('id');
  const ownClinicProfileId = user.clinicProfile?.id || user.clinicProfileId || null;

  // Clinic owners already are on their public profile here, so keep only edit/plans/logout.
  return Boolean(currentProfileId && ownClinicProfileId && currentProfileId === String(ownClinicProfileId));
}

function isClinicDashboardPage(user) {
  if (!isClinicAccountUser(user)) return false;

  const pageName = window.location.pathname.split('/').pop() || 'index.html';
  return pageName === 'clinic-dashboard.html';
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

function closeNotificationMenus(exceptMenu = null) {
  document.querySelectorAll('[data-notification-menu]').forEach((menu) => {
    if (menu === exceptMenu) return;

    const button = menu.querySelector('[data-notification-toggle]');
    const panel = menu.querySelector('[data-notification-panel]');
    if (!button || !panel) return;

    button.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
  });
}

const notificationDetailsById = new Map();
const DISMISSED_NOTIFICATIONS_STORAGE_KEY = 'physioDismissedNotifications:v1';
const dismissedNotificationIds = new Set();
let activeClinicLinkNotificationModal = null;

try {
  const storedDismissedNotifications = JSON.parse(sessionStorage.getItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY) || '[]');
  if (Array.isArray(storedDismissedNotifications)) {
    storedDismissedNotifications.forEach((notificationId) => {
      if (notificationId) dismissedNotificationIds.add(String(notificationId));
    });
  }
} catch (_) {
  // ignore storage hydration issues
}

function persistDismissedNotificationIds() {
  try {
    sessionStorage.setItem(
      DISMISSED_NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(Array.from(dismissedNotificationIds))
    );
  } catch (_) {
    // ignore storage write issues
  }
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
      closeNotificationMenus();
      toggle.setAttribute('aria-expanded', String(willOpen));
      panel.hidden = !willOpen;
      return;
    }

    const notificationToggle = event.target.closest('[data-notification-toggle]');
    if (notificationToggle) {
      const menu = notificationToggle.closest('[data-notification-menu]');
      const panel = menu?.querySelector('[data-notification-panel]');
      if (!menu || !panel) return;

      const willOpen = panel.hidden;
      closeNotificationMenus(menu);
      closeAccountMenus();
      notificationToggle.setAttribute('aria-expanded', String(willOpen));
      panel.hidden = !willOpen;
      return;
    }

    if (!event.target.closest('[data-account-menu]') && !event.target.closest('[data-notification-menu]')) {
      closeAccountMenus();
      closeNotificationMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAccountMenus();
      closeNotificationMenus();
    }
  });
}

function isClinicLinkRequestNotification(notification) {
  const title = String(notification?.title || '').toLowerCase();
  const message = String(notification?.message || '').toLowerCase();

  return notification?.type === 'clinic_link_request' ||
    title.includes('solicitação de vínculo') ||
    title.includes('solicitacao de vinculo') ||
    message.includes('solicitou vínculo') ||
    message.includes('solicitou vinculo');
}

function getClinicLinkNotificationLinkId(notification) {
  return notification?.relatedRequestId ||
    notification?.clinicLinkRequestId ||
    notification?.linkId ||
    notification?.id ||
    null;
}

function getClinicLinkNotificationPhysioId(notification) {
  return notification?.relatedPhysioId ||
    notification?.physioProfileId ||
    notification?.requesterProfileId ||
    notification?.profileId ||
    null;
}

function normalizeClinicLinkNotificationDetails(notification, detailData = null, profileData = null) {
  const physio = detailData?.physio || null;
  const fallbackProfile = profileData || null;

  return {
    ...notification,
    relatedRequestId: getClinicLinkNotificationLinkId(notification),
    relatedPhysioId: getClinicLinkNotificationPhysioId(notification),
    requesterName: notification?.requesterName || physio?.name || fallbackProfile?.nome || 'Fisioterapeuta',
    requesterCity: notification?.requesterCity || physio?.city || fallbackProfile?.cidade || '',
    requesterNeighborhood: notification?.requesterNeighborhood || physio?.neighborhood || fallbackProfile?.bairro || '',
    requesterSpecialty: notification?.requesterSpecialty || physio?.specialty || fallbackProfile?.especialidade || '',
    requesterBio: notification?.requesterBio || physio?.bio || fallbackProfile?.descricao || '',
    requesterAvatarUrl: notification?.requesterAvatarUrl || physio?.avatarUrl || fallbackProfile?.foto || '',
  };
}

function renderNotificationItem(notification, isClinicAccount) {
  const unreadClass = notification.unread ? ' is-unread' : '';
  const location = notification.clinicLocation ? `<span>${escapeHtml(notification.clinicLocation)}</span>` : '';
  const isClinicLinkRequest = isClinicLinkRequestNotification(notification);
  const usesPhysioPipelineIcon = isClinicLinkRequest;
  const isClickableClinicRequest = isClinicAccount && isClinicLinkRequest;
  const iconMarkup = usesPhysioPipelineIcon
    ? `
      <span class="notification-menu__item-icon" aria-hidden="true">
        <svg class="notification-menu__item-p-icon" viewBox="0 0 76 82" focusable="false">
          <path class="notification-menu__p-curve" d="M12 31 C25 14 60 13 61 36 C62 57 35 62 23 50" />
          <path class="notification-menu__p-slash" d="M36 27 L18 69" />
          <circle class="notification-menu__p-dot" cx="44" cy="74" r="4.2" />
        </svg>
      </span>
    `
    : '';
  const canReviewClinicLinkRequest =
    isClinicAccount &&
    isClinicLinkRequest &&
    notification.status === 'PENDING';

  if (isClickableClinicRequest) {
    return `
      <button type="button" class="notification-item notification-card notification-card-clickable notification-menu__item${unreadClass}" data-notification-id="${escapeHtml(notification.id)}" data-clinic-link-review="true" data-notification-open="true">
        ${iconMarkup}
        <div class="notification-menu__item-copy">
          <strong>${escapeHtml(notification.title || 'Nova solicitação de vínculo')}</strong>
          <p>${escapeHtml(notification.message || '')}</p>
          <small>Clique para revisar</small>
        </div>
      </button>
    `;
  }

  return `
    <article class="notification-menu__item${unreadClass}" data-notification-id="${escapeHtml(notification.id)}">
      ${iconMarkup}
      <div class="notification-menu__item-copy">
        <strong>${escapeHtml(notification.title || 'Notificação')}</strong>
        <p>${escapeHtml(notification.message || '')}</p>
        ${location}
        ${canReviewClinicLinkRequest ? `
          <div class="notification-menu__actions">
            <button type="button" data-notification-accept="${escapeHtml(notification.id)}">Aceitar</button>
            <button type="button" data-notification-reject="${escapeHtml(notification.id)}">Recusar</button>
          </div>
        ` : ''}
      </div>
    </article>
  `;
}

function getNotificationRequesterProfileHref(notification) {
  const physioProfileId = getClinicLinkNotificationPhysioId(notification);
  return physioProfileId
    ? `profile.html?type=physio&id=${encodeURIComponent(physioProfileId)}`
    : 'profile.html';
}

function dismissNotificationLocally(notificationId) {
  if (!notificationId) return;

  dismissedNotificationIds.add(String(notificationId));
  persistDismissedNotificationIds();
  notificationDetailsById.delete(notificationId);

  document.querySelectorAll(`[data-notification-id="${CSS.escape(String(notificationId))}"]`).forEach((element) => {
    element.remove();
  });

  document.querySelectorAll('[data-notification-panel]').forEach((panel) => {
    if (!panel.querySelector('[data-notification-id]') && !panel.querySelector('.notification-menu__empty')) {
      panel.insertAdjacentHTML('beforeend', '<p class="notification-menu__empty">Nenhuma notificação no momento.</p>');
    }
  });
}

function closeClinicLinkNotificationModal() {
  if (!activeClinicLinkNotificationModal) return;
  activeClinicLinkNotificationModal.remove();
  activeClinicLinkNotificationModal = null;
}

function createNotificationModalShell() {
  closeClinicLinkNotificationModal();

  const overlay = document.createElement('div');
  overlay.className = 'notification-review-modal';
  overlay.innerHTML = `
    <div class="notification-review-modal__backdrop" data-notification-modal-close></div>
    <div class="notification-review-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="clinicLinkReviewTitle">
      <button type="button" class="notification-review-modal__close" aria-label="Fechar" data-notification-modal-close>&times;</button>
      <div class="notification-review-modal__content"></div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-notification-modal-close]')) {
      closeClinicLinkNotificationModal();
    }
  });

  document.body.appendChild(overlay);
  activeClinicLinkNotificationModal = overlay;
  return overlay;
}

async function loadClinicLinkNotificationDetails(notification) {
  let detailData = null;
  const requestId = getClinicLinkNotificationLinkId(notification);
  const physioId = getClinicLinkNotificationPhysioId(notification);

  if (requestId && window.physioApi?.fetchClinicLinkRequest) {
    try {
      detailData = await window.physioApi.fetchClinicLinkRequest(requestId);
    } catch (error) {
      console.warn('Could not load clinic link request details:', error);
    }
  }

  if (!detailData && window.physioApi?.fetchPendingClinicLinkRequestForClinic) {
    try {
      detailData = await window.physioApi.fetchPendingClinicLinkRequestForClinic();
    } catch (error) {
      console.warn('Could not load pending clinic link request fallback:', error);
    }
  }

  let profileData = null;
  const fallbackPhysioId = detailData?.physioProfileId || physioId;
  if (fallbackPhysioId && window.physioApi?.fetchProfile) {
    try {
      profileData = await window.physioApi.fetchProfile(fallbackPhysioId);
    } catch (error) {
      console.warn('Could not load physiotherapist profile fallback for notification:', error);
    }
  }

  return normalizeClinicLinkNotificationDetails(notification, detailData, profileData);
}

async function handleClinicLinkNotificationOpen(notificationId, item = null) {
  if (!notificationId || !window.physioApi) return;

  const notification = notificationDetailsById.get(notificationId) || {
    id: notificationId,
    title: item?.querySelector('strong')?.textContent || 'Nova solicitação de vínculo',
    message: item?.querySelector('p')?.textContent || '',
  };

  console.log('clicked notification:', notification);
  console.log('notification type:', notification.type);
  console.log('relatedRequestId:', notification.relatedRequestId || notification.clinicLinkRequestId || null);
  console.log('relatedPhysioId:', notification.relatedPhysioId || notification.physioProfileId || notification.requesterProfileId || null);

  let hydratedNotification = notification;
  try {
    hydratedNotification = await loadClinicLinkNotificationDetails(notification);
  } catch (error) {
    console.warn('Could not hydrate clinic link notification before opening modal:', error);
  }

  openClinicLinkRequestModal(hydratedNotification);
  await window.physioApi.markNotificationRead(notificationId).catch(() => {});
}

function bindNotificationCardInteractions(root = document) {
  root.querySelectorAll('[data-clinic-link-review="true"]').forEach((card) => {
    if (card.dataset.notificationCardBound === 'true') return;

    card.dataset.notificationCardBound = 'true';
    card.style.cursor = 'pointer';
    card.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const notificationId = card.dataset.notificationId;
      if (!notificationId) return;

      await handleClinicLinkNotificationOpen(notificationId, card);
    });
  });
}

function renderClinicLinkNotificationModal(notification) {
  const overlay = createNotificationModalShell();
  const content = overlay.querySelector('.notification-review-modal__content');
  const profileHref = getNotificationRequesterProfileHref(notification);
  const requesterName = notification.requesterName || notification.profileName || 'Fisioterapeuta';
  const requesterCity = notification.requesterCity || 'Cidade não informada';
  const requesterNeighborhood = notification.requesterNeighborhood || 'Bairro não informado';
  const requesterSpecialty = notification.requesterSpecialty || 'Especialidade não informada';
  const requesterBio = notification.requesterBio || 'Este fisioterapeuta ainda não adicionou uma bio curta.';
  const requesterAvatarUrl = notification.requesterAvatarUrl || '';
  const avatarMarkup = requesterAvatarUrl
    ? `<img src="${escapeHtml(requesterAvatarUrl)}" alt="${escapeHtml(requesterName)}" class="notification-review-modal__avatar" />`
    : `<div class="notification-review-modal__avatar notification-review-modal__avatar--fallback" aria-hidden="true">${escapeHtml(requesterName.charAt(0).toUpperCase())}</div>`;

  content.innerHTML = `
    <div class="notification-review-modal__header">
      <span class="eyebrow">Solicitação de vínculo</span>
      <h3 id="clinicLinkReviewTitle">Solicitação de vínculo</h3>
      <p>${escapeHtml(requesterName)} quer fazer parte da equipe desta clínica.</p>
    </div>
    <div class="notification-review-modal__profile">
      ${avatarMarkup}
      <div class="notification-review-modal__profile-copy">
        <strong>${escapeHtml(requesterName)}</strong>
        <span>${escapeHtml(requesterCity)}${requesterNeighborhood ? ` • ${escapeHtml(requesterNeighborhood)}` : ''}</span>
        <span>${escapeHtml(requesterSpecialty)}</span>
      </div>
    </div>
    <p class="notification-review-modal__bio">${escapeHtml(requesterBio)}</p>
    <div class="notification-review-modal__actions">
      <a class="btn btn-outline" href="${escapeHtml(profileHref)}" target="_blank" rel="noreferrer">Ver perfil do fisioterapeuta</a>
      <button type="button" class="btn btn-primary" data-notification-modal-accept="${escapeHtml(notification.id)}">Aceitar vínculo</button>
      <button type="button" class="btn btn-secondary" data-notification-modal-reject="${escapeHtml(notification.id)}">Recusar vínculo</button>
      <button type="button" class="btn btn-outline" data-notification-modal-close>Fechar</button>
    </div>
  `;

  const acceptButton = content.querySelector('[data-notification-modal-accept]');
  const rejectButton = content.querySelector('[data-notification-modal-reject]');
  const actionButtons = [acceptButton, rejectButton].filter(Boolean);

  overlay.addEventListener('click', async (event) => {
    const accept = event.target.closest('[data-notification-modal-accept]');
    const reject = event.target.closest('[data-notification-modal-reject]');
    if (!accept && !reject) return;

    event.preventDefault();
    event.stopPropagation();

    const linkId = accept?.dataset.notificationModalAccept || reject?.dataset.notificationModalReject;
    if (!linkId || !window.physioApi) return;

    try {
      actionButtons.forEach((button) => {
        button.disabled = true;
      });

      if (accept) {
        await window.physioApi.acceptClinicLinkRequest(linkId);
      } else {
        await window.physioApi.rejectClinicLinkRequest(linkId);
      }

      dismissNotificationLocally(notification.id);
      closeNotificationMenus();
      closeClinicLinkNotificationModal();
      await renderAuthArea();
    } catch (error) {
      console.error('Clinic link notification modal action failed:', error);
      actionButtons.forEach((button) => {
        button.disabled = false;
      });
    }
  });
}

function openClinicLinkRequestModal(notification) {
  console.log('opening modal', notification);
  return renderClinicLinkNotificationModal(notification);
}

window.openClinicLinkRequestModal = openClinicLinkRequestModal;

function renderNotificationIcon(unreadCount = 0) {
  const safeCount = Math.max(0, Number(unreadCount || 0));
  const badgeText = safeCount > 9 ? '9+' : String(safeCount);

  return `
    <span class="notification-menu__mark${safeCount > 0 ? ' has-unread' : ''}" aria-hidden="true">
      <svg class="notification-menu__p-icon" viewBox="0 0 76 82" focusable="false">
        <path class="notification-menu__p-curve" d="M12 31 C25 14 60 13 61 36 C62 57 35 62 23 50" />
        <path class="notification-menu__p-slash" d="M36 27 L18 69" />
        <circle class="notification-menu__p-dot" cx="44" cy="74" r="4.2" />
      </svg>
      ${safeCount > 0 ? `<strong class="notification-menu__badge">${badgeText}</strong>` : ''}
    </span>
  `;
}

async function buildNotificationMenu(user) {
  try {
    const data = window.physioApi?.fetchNotifications
      ? await window.physioApi.fetchNotifications()
      : { notifications: [], unreadCount: 0 };
    const notifications = (Array.isArray(data?.notifications) ? data.notifications : [])
      .filter((notification) => notification?.id && !dismissedNotificationIds.has(notification.id));
    notificationDetailsById.clear();
    notifications.forEach((notification) => {
      if (notification?.id) notificationDetailsById.set(notification.id, notification);
    });
    const unreadCount = notifications.filter((notification) => notification?.unread).length;
    const isClinicAccount = isClinicAccountUser(user);
    const panelContent = notifications.length
      ? notifications.map((item) => renderNotificationItem(item, isClinicAccount)).join('')
      : '<p class="notification-menu__empty">Nenhuma notificação no momento.</p>';

    return `
      <div class="notification-menu" data-notification-menu>
        <button
          class="notification-menu__button"
          type="button"
          aria-label="Notifications"
          aria-expanded="false"
          data-notification-toggle
        >
          ${renderNotificationIcon(unreadCount)}
        </button>
        <div class="notification-menu__panel" role="menu" data-notification-panel hidden>
          <h3>Notificações</h3>
          ${panelContent}
        </div>
      </div>
    `;
  } catch (error) {
    console.warn('Could not load notifications:', error);
    return `
      <div class="notification-menu" data-notification-menu>
        <button
          class="notification-menu__button"
          type="button"
          aria-label="Notifications"
          aria-expanded="false"
          data-notification-toggle
        >
          ${renderNotificationIcon(0)}
        </button>
        <div class="notification-menu__panel" role="menu" data-notification-panel hidden>
          <h3>Notificações</h3>
          <p class="notification-menu__empty">Nenhuma notificação no momento.</p>
        </div>
      </div>
    `;
  }
}

document.addEventListener('click', async (event) => {
  const acceptButton = event.target.closest('[data-notification-accept]');
  const rejectButton = event.target.closest('[data-notification-reject]');
  const openButton = event.target.closest('[data-notification-open]');
  const item = event.target.closest('[data-notification-id]');

  if (!acceptButton && !rejectButton && !openButton && !item) return;
  if (!window.physioApi) return;

  const id = acceptButton?.dataset.notificationAccept ||
    rejectButton?.dataset.notificationReject ||
    openButton?.dataset.notificationId ||
    item?.dataset.notificationId;

  if (!id) return;

  try {
    if (acceptButton) {
      acceptButton.disabled = true;
      await window.physioApi.acceptClinicLinkRequest(id);
      dismissNotificationLocally(id);
    } else if (rejectButton) {
      rejectButton.disabled = true;
      await window.physioApi.rejectClinicLinkRequest(id);
      dismissNotificationLocally(id);
    } else if (openButton || item?.dataset.clinicLinkReview === 'true') {
      await handleClinicLinkNotificationOpen(id, item);
    } else if (!event.target.closest('button')) {
      await window.physioApi.markNotificationRead(id);
    }

    await renderAuthArea();
  } catch (error) {
    console.error('Notification action failed:', error);
  }
});


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

  const isClinicAccount = isClinicAccountUser(user);
  const displayName = (
    user.clinicProfile?.nomeClinica ||
    user.clinicProfile?.clinicName ||
    user.profile?.nome ||
    user.profile?.name ||
    user.name ||
    user.email ||
    (isClinicAccount ? 'Clínica' : 'Profissional')
  ).trim();
  const greetingName = isClinicAccount ? displayName : displayName.split(' ')[0];
  const profileHref = getUserProfileHref(user);
  const editHref = isClinicAccount ? 'clinic-dashboard.html' : 'editar-perfil.html';
  const profileLabel = 'Meu perfil';
  const profileMenuItem = `<a role="menuitem" href="${profileHref}">${profileLabel}</a>`;
  const notificationMenu = await buildNotificationMenu(user);

  authArea.innerHTML = `
    <span class="user-greeting">Olá, ${escapeHtml(greetingName)}</span>
    ${notificationMenu}
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
        ${profileMenuItem}
        <a role="menuitem" href="${editHref}">${isClinicAccount ? 'Editar dados da clínica' : 'Editar perfil'}</a>
        <a role="menuitem" href="planos.html">Planos</a>
        <button role="menuitem" type="button" onclick="logout()">Sair</button>
      </div>
    </div>
  `;

  bindNotificationCardInteractions(authArea);
}

window.renderAuthArea = renderAuthArea;

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('resultsGrid')) {
    console.time('PhysioPipeline header/menu setup');
    setupAccountMenuEvents();
    renderAuthArea().finally(() => console.timeEnd('PhysioPipeline header/menu setup'));
    window.setTimeout(() => {
      cachedMyProfile = null;
      renderAuthArea();
    }, 1200);
    return;
  }

  setupAccountMenuEvents();
  setupSearchModeSwitches();
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
  const specialtyValues = getProfileSpecialtyValues(profile);
  const canonicalSlugs = getProfileCanonicalSlugs(profile);

  return [
    ...specialtyValues,
    ...canonicalSlugs,
    ...canonicalSlugs.map((slug) => CANONICAL_SPECIALTY_DEFINITIONS[slug]?.label),
    ...canonicalSlugs.flatMap((slug) => CANONICAL_SPECIALTY_DEFINITIONS[slug]?.aliases || []),
  ]
    .filter(Boolean)
    .map(normalizeText)
    .join(' ');
}

function getProfileSpecialtiesList(profile) {
  const explicitList = Array.isArray(profile?.specialties)
    ? profile.specialties
    : Array.isArray(profile?.especialidades)
      ? profile.especialidades
      : [];

  const seen = new Set();

  return [
    ...explicitList,
    profile?.especialidade || profile?.specialty,
    profile?.especialidadeSecundaria || profile?.secondarySpecialty,
    profile?.especialidadeTerciaria || profile?.tertiarySpecialty || profile?.specialty2,
  ]
    .map((specialty) => String(specialty || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((specialty) => {
      const key = specialty
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getDisplaySpecialties(profile) {
  return getProfileSpecialtiesList(profile).join(' â€¢ ');
}

function getClinicServicesList(clinic) {
  const explicitList = Array.isArray(clinic?.servicesList)
    ? clinic.servicesList
    : Array.isArray(clinic?.servicosLista)
      ? clinic.servicosLista
      : Array.isArray(clinic?.specialties)
        ? clinic.specialties
        : Array.isArray(clinic?.especialidades)
          ? clinic.especialidades
          : null;

  const seen = new Set();

  if (explicitList?.length) {
    return explicitList
      .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((item) => {
        const key = item
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  return String(clinic?.servicos || clinic?.services || '')
    .split(/[,n/|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getClinicServicesText(clinic) {
  return String(clinic?.servicos || clinic?.services || '')
    .split(/[,\n/|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' â€¢ ');
}

function getClinicTeamList(clinic) {
  return Array.isArray(clinic?.physioTeamList)
    ? clinic.physioTeamList
    : Array.isArray(clinic?.fisioterapeutas)
      ? clinic.fisioterapeutas
      : [];
}

function renderBadgePills(items) {
  return (items || [])
    .filter(Boolean)
    .map((item) => `<span class="profile-badge">${escapeHtml(item)}</span>`)
    .join('');
}

function getClinicSearchFields(clinic = {}) {
  const services = getClinicServicesList(clinic);
  const team = getClinicTeamList(clinic);

  return {
    cityText: normalizeSearchText(clinic.cidade || clinic.city || ''),
    neighborhoodText: normalizeSearchText(clinic.bairro || clinic.neighborhood || ''),
    nameText: normalizeSearchText(clinic.nomeClinica || clinic.nome || ''),
    specialtyText: normalizeSearchText(services.join(' ')),
    searchableText: normalizeSearchText([
      clinic.nomeClinica,
      clinic.nome,
      clinic.responsavel,
      clinic.servicos,
      clinic.services,
      ...services,
      ...team.flatMap((member) => [member?.name, member?.specialty]),
      clinic.descricao,
      clinic.description,
      clinic.cidade,
      clinic.city,
      clinic.bairro,
      clinic.neighborhood,
    ].filter(Boolean).join(' ')),
  };
}

function scoreClinicRelevance(clinic, analysis, options = {}) {
  const fields = getClinicSearchFields(clinic);
  const city = normalizeSearchText(options.city || '');
  const neighborhood = normalizeSearchText(options.neighborhood || '');
  const significantTerms = Array.isArray(analysis?.significantTerms) ? analysis.significantTerms : [];
  const expandedTerms = Array.isArray(analysis?.expandedTerms) ? analysis.expandedTerms : [];
  const queryText = normalizeSearchText(analysis?.normalizedQuery || analysis?.originalQuery || '');
  const candidateTerms = Array.from(new Set([queryText, ...significantTerms, ...expandedTerms].filter(Boolean)));
  const reasons = [];
  let score = 0;

  const exactMatches = queryText
    ? getMatchedTerms(fields.specialtyText, [queryText]).concat(getMatchedTerms(fields.nameText, [queryText]))
    : [];
  if (exactMatches.length) {
    score += 150;
    reasons.push(`clinic exact specialty match: ${exactMatches.join(', ')}`);
  }

  const partialMatches = getMatchedTerms(fields.searchableText, significantTerms);
  if (partialMatches.length) {
    score += Math.min(90, partialMatches.length * 28);
    reasons.push(`clinic partial match: ${partialMatches.join(', ')}`);
  }

  const relatedMatches = getMatchedTerms(fields.searchableText, expandedTerms);
  if (relatedMatches.length) {
    score += Math.min(60, relatedMatches.length * 16);
    reasons.push(`clinic related match: ${relatedMatches.join(', ')}`);
  }

  const nameMatches = candidateTerms.length ? getMatchedTerms(fields.nameText, candidateTerms) : [];
  if (nameMatches.length) {
    score += Math.min(40, nameMatches.length * 18);
    reasons.push(`clinic name match: ${nameMatches.join(', ')}`);
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

  if (!score && city && fields.cityText === city) {
    score += 22;
    reasons.push('same-city clinic fallback');
  }

  let tier = 5;
  if (score >= 150) tier = 1;
  else if (score >= 90) tier = 2;
  else if (score >= 40) tier = 3;
  else if (score > 0) tier = 4;

  return {
    profile: clinic,
    score,
    tier,
    reasons,
    hasSearchRelevance: score > 0,
  };
}

function shuffleWithinRelevanceGroups(items) {
  const grouped = new Map();

  items.forEach((item) => {
    const tier = Number.isFinite(item?.tier) ? item.tier : 999;
    const score = Number.isFinite(item?.score) ? item.score : 0;
    const key = `${tier}::${score}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        tier,
        score,
        items: [],
      });
    }

    grouped.get(key).items.push(item);
  });

  return Array.from(grouped.values())
    .sort((a, b) => (a.tier - b.tier) || (b.score - a.score))
    .flatMap((group) => shuffleArray(group.items));
}

function prioritizeCityFallback(items, requestedCity) {
  if (!requestedCity) return shuffleWithinRelevanceGroups(items);

  const exactCity = [];
  const otherCities = [];

  items.forEach((item) => {
    const cityText = normalizeSearchText(item?.profile?.cidade || item?.profile?.city || '');
    if (cityText === requestedCity) {
      exactCity.push(item);
    } else {
      otherCities.push(item);
    }
  });

  return [
    ...shuffleWithinRelevanceGroups(exactCity),
    ...shuffleWithinRelevanceGroups(otherCities),
  ];
}

function rankClinicsByRelevance(clinics, analysis, options = {}) {
  const requestedCity = normalizeSearchText(options.city || '');
  const normalizedNeighborhood = normalizeSearchText(options.neighborhood || '');
  const rankedClinics = clinics.map((clinic) => scoreClinicRelevance(clinic, analysis, options));

  const exactNeighborhood = rankedClinics.filter((item) =>
    requestedCity &&
    normalizeSearchText(item.profile.cidade || item.profile.city || '') === requestedCity &&
    normalizedNeighborhood &&
    normalizeSearchText(item.profile.bairro || item.profile.neighborhood || '') === normalizedNeighborhood
  );

  if (exactNeighborhood.length) {
    const orderedNeighborhood = prioritizeCityFallback(exactNeighborhood, requestedCity);
    return {
      rankedClinics,
      ordered: orderedNeighborhood,
      visible: orderedNeighborhood,
    };
  }

  const sameCity = rankedClinics.filter((item) =>
    requestedCity &&
    normalizeSearchText(item.profile.cidade || item.profile.city || '') === requestedCity
  );

  if (sameCity.length) {
    const orderedSameCity = prioritizeCityFallback(sameCity, requestedCity);
    return {
      rankedClinics,
      ordered: orderedSameCity,
      visible: orderedSameCity,
    };
  }

  const ordered = prioritizeCityFallback(rankedClinics.filter((item) => item.score > 0 || !requestedCity), requestedCity);
  return {
    rankedClinics,
    ordered,
    visible: ordered,
  };
}

function buildSearchErrorDetails({ mode, query, city, neighborhood, endpoint, error }) {
  return {
    mode,
    query,
    city,
    neighborhood,
    endpoint,
    status: error?.status || error?.response?.status || null,
    code: error?.code || error?.data?.code || null,
    backendMessage: error?.data?.message || error?.message || null,
    backendResponse: error?.data || error?.response?.data || null,
  };
}

function getSpecialtySearchTerms(query, analysis) {
  return Array.from(new Set([
    normalizeSearchText(query || ''),
    ...(Array.isArray(analysis?.significantTerms) ? analysis.significantTerms : []),
    ...(Array.isArray(analysis?.expandedTerms) ? analysis.expandedTerms : []),
  ].filter(Boolean)));
}

function scoreSpecialtySearchItem(item, { query = '', city = '', neighborhood = '', analysis = null } = {}) {
  const normalizedQuery = normalizeSearchText(query || '');
  const normalizedCity = normalizeSearchText(city || '');
  const normalizedNeighborhood = normalizeSearchText(neighborhood || '');
  const searchAnalysis = analysis || analyzeSearchIntent(query, buildSearchContext());
  const specialtyTerms = getSpecialtySearchTerms(query, searchAnalysis);
  const isClinic = item.type === 'clinic';
  const profile = item.profile || item;
  const specialties = isClinic ? getClinicServicesList(profile) : getProfileSpecialtiesList(profile);
  const primaryText = normalizeSearchText(specialties.join(' '));
  const searchableText = normalizeSearchText([
    profile.nome,
    profile.nomeClinica,
    profile.responsavel,
    profile.descricao,
    profile.description,
    profile.cidade,
    profile.city,
    profile.bairro,
    profile.neighborhood,
    ...specialties,
    ...(isClinic ? getClinicTeamList(profile).flatMap((member) => [member?.name, member?.specialty]) : []),
  ].filter(Boolean).join(' '));
  const itemCity = normalizeSearchText(profile.cidade || profile.city || '');
  const itemNeighborhood = normalizeSearchText(profile.bairro || profile.neighborhood || '');
  const reasons = [];
  let score = 0;

  if (normalizedQuery && primaryText.includes(normalizedQuery)) {
    score += 100;
    reasons.push(`exact specialty match: ${normalizedQuery}`);
  } else if (specialtyTerms.some((term) => term && primaryText.includes(term))) {
    const matchedTerm = specialtyTerms.find((term) => term && primaryText.includes(term));
    score += 70;
    reasons.push(`partial specialty match: ${matchedTerm}`);
  } else if (specialtyTerms.some((term) => term && searchableText.includes(term))) {
    const matchedTerm = specialtyTerms.find((term) => term && searchableText.includes(term));
    score += 40;
    reasons.push(`related term match: ${matchedTerm}`);
  }

  if (normalizedCity && itemCity === normalizedCity) {
    score += 20;
    reasons.push(`same city: ${normalizedCity}`);
  }

  if (normalizedNeighborhood && itemNeighborhood && itemNeighborhood.includes(normalizedNeighborhood)) {
    score += 10;
    reasons.push(`same neighborhood: ${normalizedNeighborhood}`);
  }

  let tier = 5;
  if (score >= 100) tier = 1;
  else if (score >= 70) tier = 2;
  else if (score >= 40) tier = 3;
  else if (score >= 20) tier = 4;

  return {
    ...item,
    profile,
    score,
    tier,
    reasons,
    hasSearchRelevance: score > 0,
  };
}

function rankSpecialtyModeResults(physioProfiles, clinicProfiles, options = {}) {
  const analysis = options.analysis || analyzeSearchIntent(options.query || '', buildSearchContext(physioProfiles));
  const scored = [
    ...physioProfiles.map((profile) => scoreSpecialtySearchItem({ type: 'physio', profile }, {
      query: options.query,
      city: options.city,
      neighborhood: options.neighborhood,
      analysis,
    })),
    ...clinicProfiles.map((profile) => scoreSpecialtySearchItem({ type: 'clinic', profile }, {
      query: options.query,
      city: options.city,
      neighborhood: options.neighborhood,
      analysis,
    })),
  ];

  return prioritizeCityFallback(
    scored.sort((a, b) => {
      if ((a.tier || 999) !== (b.tier || 999)) return (a.tier || 999) - (b.tier || 999);
      return (b.score || 0) - (a.score || 0);
    }),
    normalizeSearchText(options.city || '')
  );
}

function buildClinicWhatsAppLink(clinic) {
  const digits = String(clinic?.whatsapp || clinic?.telefone || clinic?.phone || '').replace(/\D/g, '');
  if (!digits) return '#';

  const name = clinic?.nomeClinica || clinic?.nome || 'a clínica';
  const message = `Ola, encontrei ${name} no PhysioPipeline e gostaria de saber mais sobre os atendimentos.`;
  return `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`;
}

function filterClinicsBySearch(clinics, { query = '', city = '', neighborhood = '' } = {}) {
  const analysis = analyzeSearchIntent(query, buildSearchContext());
  return rankClinicsByRelevance(clinics, analysis, { city, neighborhood }).visible;
}

function getProfileImageUrl(profile = {}) {
  return [
    profile.foto,
    profile.photoUrl,
    profile.photo_url,
    profile.avatar_url,
    profile.avatarUrl,
    profile.imageUrl,
    profile.profileImage,
    profile.profile_image,
  ].find((value) => typeof value === 'string' && value.trim()) || '';
}

function getProfileInitials(name = '') {
  const words = String(name || 'Fisioterapeuta')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return ((words[0]?.[0] || 'P') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

function renderResultAvatar({ photoUrl, initials, displayName, decorative = false }) {
  const fallback = `<span class="result-card__avatar result-card__avatar--fallback result-card__avatar-fallback" aria-hidden="true">${escapeHtml(initials)}</span>`;

  if (!photoUrl) return fallback;

  return `
    <img
      class="result-card__avatar result-card__avatar-img"
      src="${escapeHtml(photoUrl)}"
      alt="${decorative ? '' : `Foto de ${escapeHtml(displayName)}`}"
      width="112"
      height="112"
      loading="lazy"
      decoding="async"
    />
    <span class="result-card__avatar result-card__avatar--fallback result-card__avatar-fallback is-hidden" aria-hidden="true">${escapeHtml(initials)}</span>
  `;
}

function attachResultAvatarFallbacks(container = document) {
  console.time('PhysioPipeline image handling');
  const images = container.querySelectorAll('.result-card__avatar-img');
  console.info(`PhysioPipeline resultados: image handling preparado para ${images.length} imagem(ns)`);

  images.forEach((image) => {
    const useFallback = (reason) => {
      if (image.dataset.fallbackApplied === 'true') return;

      const fallback = image.nextElementSibling;
      image.dataset.fallbackApplied = 'true';
      console.warn(`Imagem de perfil ${reason}; usando avatar padrão:`, image.currentSrc || image.src);
      image.classList.add('is-hidden');
      if (fallback?.classList.contains('result-card__avatar-fallback')) {
        fallback.classList.remove('is-hidden');
      }
    };

    image.addEventListener('error', () => useFallback('falhou'), { once: true });
    image.addEventListener('load', () => {
      if (!image.naturalWidth) useFallback('inválida');
    }, { once: true });

    window.setTimeout(() => {
      if (!image.complete) useFallback('demorou para carregar');
    }, 8000);
  });
  console.timeEnd('PhysioPipeline image handling');
}

// ===============================
// RESULTADOS DA BUSCA
// ===============================

const RESULTS_PER_PAGE = 12;

document.addEventListener('DOMContentLoaded', async () => {
  console.time('PhysioPipeline resultados page init');
  const resultsGrid = document.getElementById('resultsGrid');

  // Só executa em resultados.html
  if (!resultsGrid) {
    console.timeEnd('PhysioPipeline resultados page init');
    return;
  }

  const resumo = document.getElementById('resultadoResumo');
  const resultsShowingSummary = document.getElementById('resultsShowingSummary');
  const paginationControls = document.getElementById('paginationControls');
  const resultPerfStart = performance.now();
  let resultsLoaded = false;
  let slowLoadingTimeoutId = null;
  let failedLoadingTimeoutId = null;
  const logResultsTiming = (label) => {
    console.info(`PhysioPipeline resultados: ${label} em ${Math.round(performance.now() - resultPerfStart)}ms`);
  };

  const renderResultsSkeleton = (count = 6) => {
    resultsGrid.innerHTML = Array.from({ length: count }, () => `
      <article class="result-card result-card-skeleton" aria-hidden="true">
        <div class="result-card__layout">
          <div class="result-card__title">
            <span class="skeleton-line skeleton-title"></span>
          </div>
          <span class="result-card__avatar result-card__avatar--fallback skeleton-avatar result-card__media"></span>
          <div class="result-card__content">
            <span class="skeleton-pill"></span>
            <span class="skeleton-pill skeleton-pill-short"></span>
            <span class="skeleton-pill skeleton-pill-shorter"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-button"></span>
          </div>
        </div>
      </article>
    `).join('');
  };

  const params = new URLSearchParams(window.location.search);
  const requestedPage = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  const especialidade = normalizeText(
    params.get('especialidade') || ''
  );

  const SEARCH_TYPE_MAP = {
    especialidade: 'specialty',
    leigo: 'symptom',
    clinica: 'clinic',
  };
  const SEARCH_MODE_BY_TYPE = {
    specialty: 'especialidade',
    symptom: 'leigo',
    clinic: 'clinica',
  };
  const rawMode = normalizeText(params.get('modo') || '');
  const rawSearchType = normalizeText(params.get('searchType') || '');
  const searchType = rawSearchType === 'specialty' || rawSearchType === 'symptom' || rawSearchType === 'clinic'
    ? rawSearchType
    : (SEARCH_TYPE_MAP[rawMode] || 'specialty');
  const modoBusca = SEARCH_MODE_BY_TYPE[searchType] || 'especialidade';
  const queixa = params.get('queixa') || '';
  const searchQuery = searchType === 'symptom'
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
  setupSpecialtyAutocomplete('specialtyInput', 'specialtySuggestions');
  setupCityNeighborhoodAutocomplete(
    'cityIndexSelect',
    'cityIndexSuggestions',
    'buscarBairroIndex',
    'bairroIndexSuggestions'
  );
  setupSearchModeSwitches();
  document.querySelectorAll('input[name="modo"]').forEach((input) => {
    input.checked = input.value === modoBusca;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  try {
    logResultsTiming(`iniciando busca de ${searchType === 'clinic' ? 'clínicas' : searchType === 'specialty' ? 'resultados' : 'profissionais'}`);
    resumo.textContent = searchType === 'clinic'
      ? 'Buscando clínicas...'
      : searchType === 'specialty'
        ? 'Buscando resultados...'
        : 'Buscando profissionais...';
    renderResultsSkeleton();
    slowLoadingTimeoutId = window.setTimeout(() => {
      if (resultsLoaded) return;

      resumo.textContent = searchType === 'clinic'
        ? 'Ainda carregando clínicas...'
        : searchType === 'specialty'
          ? 'Ainda carregando resultados...'
          : 'Ainda carregando profissionais...';
      console.warn('PhysioPipeline resultados: busca ainda pendente após 5s');
    }, 5000);

    failedLoadingTimeoutId = window.setTimeout(() => {
      if (resultsLoaded) return;

      resultsLoaded = true;
      resumo.textContent = searchType === 'clinic'
        ? 'Não foi possível carregar as clínicas agora.'
        : searchType === 'specialty'
          ? 'Não foi possível carregar os resultados agora.'
          : 'Não foi possível carregar os profissionais agora.';
      resultsGrid.innerHTML = `
        <div class="empty-results">
          <h3>A busca demorou demais.</h3>
          <p>Tente atualizar a página em alguns segundos.</p>
        </div>
      `;
      if (resultsShowingSummary) resultsShowingSummary.textContent = '';
      if (paginationControls) paginationControls.innerHTML = '';
      console.warn('PhysioPipeline resultados: timeout de 10s acionado');
    }, 10000);

    let filtered = [];
    let resultLabel = '';

    if (searchType === 'clinic') {
      console.time('PhysioPipeline fetching clinics');
      let clinics = [];
      try {
        clinics = await window.physioApi.fetchClinics();
      } catch (error) {
        error.__searchEndpoint = '/clinics';
        throw error;
      } finally {
        console.timeEnd('PhysioPipeline fetching clinics');
      }

      if (resultsLoaded && failedLoadingTimeoutId) return;
      resultsLoaded = true;
      if (slowLoadingTimeoutId) window.clearTimeout(slowLoadingTimeoutId);
      if (failedLoadingTimeoutId) window.clearTimeout(failedLoadingTimeoutId);
      logResultsTiming(`clinic fetch finalizado com ${clinics.length} clínicas`);
      resultsGrid.innerHTML = '';
      renderFallbackMessage('');

      const clinicRanking = rankClinicsByRelevance(
        clinics,
        analyzeSearchIntent('', buildSearchContext()),
        { city: cidade, neighborhood: bairro }
      );

      filtered = clinicRanking.visible.map((item) => ({ type: 'clinic', profile: item.profile }));

      resultLabel = filtered.length === 1
        ? '1 clínica encontrada'
        : `${filtered.length} clínicas encontradas`;

      resumo.textContent = resultLabel;
    } else {
      console.time('PhysioPipeline fetching professionals');
      let profiles = [];
      let clinics = [];
      try {
        if (searchType === 'specialty') {
          const [profilesResult, clinicsResult] = await Promise.allSettled([
            window.physioApi.fetchProfiles({
              useCache: true,
            }),
            window.physioApi.fetchClinics(),
          ]);

          if (profilesResult.status === 'fulfilled') {
            profiles = profilesResult.value;
          }

          if (clinicsResult.status === 'fulfilled') {
            clinics = clinicsResult.value;
          }

          if (profilesResult.status === 'rejected' && clinicsResult.status === 'rejected') {
            const error = profilesResult.reason || clinicsResult.reason || new Error('Falha ao buscar resultados.');
            error.__searchEndpoint = '/profiles + /clinics';
            throw error;
          }

          if (profilesResult.status === 'rejected') {
            console.error('PhysioPipeline resultados: falha parcial na busca de fisioterapeutas', buildSearchErrorDetails({
              mode: searchType,
              query: searchQuery,
              city: params.get('cidade') || '',
              neighborhood: params.get('bairro') || '',
              endpoint: '/profiles',
              error: profilesResult.reason,
            }));
          }

          if (clinicsResult.status === 'rejected') {
            console.error('PhysioPipeline resultados: falha parcial na busca de clínicas', buildSearchErrorDetails({
              mode: searchType,
              query: searchQuery,
              city: params.get('cidade') || '',
              neighborhood: params.get('bairro') || '',
              endpoint: '/clinics',
              error: clinicsResult.reason,
            }));
          }
        } else {
          profiles = await window.physioApi.fetchProfiles({
            useCache: true,
          }).catch((error) => {
            error.__searchEndpoint = '/profiles';
            throw error;
          });
        }
      } finally {
        console.timeEnd('PhysioPipeline fetching professionals');
      }
      if (resultsLoaded && failedLoadingTimeoutId) return;
      resultsLoaded = true;
      if (slowLoadingTimeoutId) window.clearTimeout(slowLoadingTimeoutId);
      if (failedLoadingTimeoutId) window.clearTimeout(failedLoadingTimeoutId);
      logResultsTiming(`professional fetch finalizado com ${profiles.length} perfis`);
      resultsGrid.innerHTML = '';

      console.time('PhysioPipeline filtering/search ranking');
      searchAnalysis = analyzeSearchIntent(searchQuery, buildSearchContext(profiles));
      logResultsTiming('análise de busca concluída');

      const rankedResult = rankProfilesByRelevance(profiles, searchAnalysis, {
        city: cidade,
        neighborhood: bairro,
      });
      logResultsTiming('search/filter processing concluído');
      console.timeEnd('PhysioPipeline filtering/search ranking');

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

      const physioResults = visibleResults.map((item) => ({ ...item, type: 'physio', profile: item.profile }));
      const combinedResults = searchType === 'specialty'
        ? rankSpecialtyModeResults(profiles, clinics, {
            query: params.get('especialidade') || '',
            city: cidade,
            neighborhood: bairro,
            analysis: searchAnalysis,
          })
        : physioResults;

      filtered = combinedResults.map((item) => ({ type: item.type, profile: item.profile }));

      resultLabel = searchType === 'specialty'
        ? (filtered.length === 1 ? '1 resultado encontrado' : `${filtered.length} resultados encontrados`)
        : (filtered.length === 1 ? '1 profissional encontrado' : `${filtered.length} profissionais encontrados`);

      resumo.textContent = resultLabel;
      renderFallbackMessage(searchType === 'specialty' ? '' : fallbackMessage);
    }

    if (searchType === 'specialty') {
      const resultsTitle = document.querySelector('[data-search-title]');
      if (resultsTitle) resultsTitle.textContent = 'Resultados encontrados';
    }

    if (searchType === 'symptom' && queixa) {
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
          <h3>${searchType === 'clinic' ? 'Nenhum resultado encontrado.' : searchType === 'specialty' ? 'Nenhum resultado encontrado.' : 'Nenhum resultado encontrado.'}</h3>
          <p>${searchType === 'clinic' ? 'Tente outra cidade ou remova o bairro para ampliar a busca.' : searchType === 'symptom' ? 'Tente pesquisar outro sintoma, dor ou cidade.' : 'Tente pesquisar outra especialidade ou cidade.'}</p>
        </div>
      `;
      if (resultsShowingSummary) {
        resultsShowingSummary.textContent = searchType === 'clinic'
          ? 'Mostrando 0 de 0 clínicas'
          : searchType === 'specialty'
            ? 'Mostrando 0 de 0 resultados'
            : 'Mostrando 0 de 0 profissionais';
      }
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
      console.time('PhysioPipeline renderResults');
      const renderStart = performance.now();
      currentPage = clampPage(page);

      const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
      const endIndex = Math.min(startIndex + RESULTS_PER_PAGE, filtered.length);
      const pageProfiles = filtered.slice(startIndex, endIndex);

      resultsGrid.innerHTML = pageProfiles.map((item) => {
        const profile = item.profile || item;

        if (item.type === 'clinic') {
          const displayName = profile.nomeClinica || profile.nome || 'Clínica';
          const displayCity = profile.cidade || profile.city || 'Não informado';
          const displayNeighborhood = profile.bairro || profile.neighborhood || 'Não informado';
          const photoUrl = getProfileImageUrl({ foto: profile.logo, photoUrl: profile.logoUrl });
          const initials = getProfileInitials(displayName);
          const clinicTeamCount = getClinicTeamList(profile).length;
          const clinicSpecialties = getClinicServicesList(profile);
          const servicePills = renderBadgePills(clinicSpecialties);
          const teamSummary = clinicTeamCount
            ? ` &bull; ${clinicTeamCount} ${clinicTeamCount === 1 ? 'fisioterapeuta' : 'fisioterapeutas'}`
            : '';

          return `
            <article class="result-card result-card--clinic">
              <div class="result-card__layout">
                <div class="result-card__title">
                  <h3>${escapeHtml(displayName)}</h3>
                  <p class="result-card__mobile-meta">&#127973; Clínica &bull; ${escapeHtml(displayCity)}</p>
                </div>

                <div class="result-card__media" aria-hidden="true">
                  ${renderResultAvatar({ photoUrl, initials, displayName, decorative: true })}
                </div>

                <div class="result-card__content">
                  <p><strong>Badge:</strong> <span class="profile-badge">&#127973; Clínica</span>${teamSummary}</p>
                  <p><strong>Especialidades:</strong></p>
                  <div class="result-card__badge-row">
                    ${clinicSpecialties.length ? servicePills : '<span class="profile-badge">Não informado</span>'}
                  </div>
                  <p><strong>Cidade:</strong> ${escapeHtml(displayCity)}</p>
                  <p><strong>Bairro:</strong> ${escapeHtml(displayNeighborhood)}</p>

                  <div class="bio-wrapper">
                    <p class="bio collapsed">
                      ${escapeHtml(profile.descricao || profile.description || 'Sem descrição.')}
                    </p>

                    <button class="toggle-bio-btn" type="button">
                      Veja mais
                    </button>
                  </div>

                  <a
                    href="profile.html?type=clinic&id=${encodeURIComponent(profile.id)}"
                    class="btn btn-primary"
                  >
                    Ver perfil
                  </a>
                </div>
              </div>
            </article>
          `;
        }

        const displayName = profile.nome || profile.name || 'Fisioterapeuta';
        const physioSpecialties = getProfileSpecialtiesList(profile);
        const displaySpecialty = physioSpecialties.join(' â€¢ ') || 'N?o informado';
        const displayCity = profile.cidade || profile.city || 'N?o informado';
        const displayNeighborhood = profile.bairro || profile.neighborhood || 'N?o informado';
        const photoUrl = getProfileImageUrl(profile);
        const initials = getProfileInitials(displayName);

        return `
          <article class="result-card">
            <div class="result-card__layout">
              <div class="result-card__title">
                <h3>${escapeHtml(displayName)}</h3>
                <p class="result-card__mobile-meta">${escapeHtml(displaySpecialty)} &bull; ${escapeHtml(displayCity)}</p>
              </div>

              <div class="result-card__media" aria-hidden="true">
                ${renderResultAvatar({ photoUrl, initials, displayName, decorative: true })}
              </div>

              <div class="result-card__content">
                <p><strong>Badge:</strong> &#129489; Fisioterapeuta</p>
                <p><strong>Especialidades:</strong></p>
                <div class="result-card__badge-row">
                  ${physioSpecialties.length ? renderBadgePills(physioSpecialties) : '<span class="profile-badge">Não informado</span>'}
                </div>
                <p><strong>Cidade:</strong> ${escapeHtml(displayCity)}</p>
                <p><strong>Bairro:</strong> ${escapeHtml(displayNeighborhood)}</p>

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
              </div>
            </div>
          </article>
        `;
      }).join('');

      attachResultAvatarFallbacks(resultsGrid);
      logResultsTiming(`renderResults p?gina ${currentPage} conclu?do (${Math.round(performance.now() - renderStart)}ms)`);
      console.timeEnd('PhysioPipeline renderResults');

      document.querySelectorAll('.toggle-bio-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const bio = button.previousElementSibling;
          bio.classList.toggle('collapsed');
          button.textContent = bio.classList.contains('collapsed') ? 'Veja mais' : 'Veja menos';
        });
      });

      renderPagination();
      updatePageUrl(currentPage);

      if (resultsShowingSummary) {
        resultsShowingSummary.textContent = searchType === 'clinic'
          ? `Mostrando ${endIndex} de ${filtered.length} clínicas`
          : searchType === 'specialty'
            ? `Mostrando ${endIndex} de ${filtered.length} resultados`
            : `Mostrando ${endIndex} de ${filtered.length} profissionais`;
      }

      if (shouldScroll) {
        resultsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    renderPage(currentPage);
    loadDynamicSearchOptions().catch((error) => {
      console.warn('Opções dinâmicas carregando em segundo plano falharam:', error);
    });
    console.timeEnd('PhysioPipeline resultados page init');

} catch (error) {
  console.error(
    'PhysioPipeline resultados: falha real na busca',
    buildSearchErrorDetails({
      mode: searchType,
      query: searchQuery,
      city: params.get('cidade') || '',
      neighborhood: params.get('bairro') || '',
      endpoint: error?.__searchEndpoint || (searchType === 'clinic' ? '/clinics' : searchType === 'specialty' ? '/profiles + /clinics' : '/profiles'),
      error,
    })
  );
  resultsLoaded = true;
  if (slowLoadingTimeoutId) window.clearTimeout(slowLoadingTimeoutId);
  if (failedLoadingTimeoutId) window.clearTimeout(failedLoadingTimeoutId);

  resumo.textContent = modoBusca === 'clinica'
    ? 'Erro ao buscar clínicas.'
    : 'Erro ao buscar resultados.';
  if (resultsShowingSummary) resultsShowingSummary.textContent = '';
  if (paginationControls) paginationControls.innerHTML = '';

  resultsGrid.innerHTML = `
    <div class="empty-results">
      <h3>${modoBusca === 'clinica' ? 'Erro ao buscar clínicas.' : 'Erro ao buscar resultados.'}</h3>
      <p>Tente atualizar a página e pesquisar novamente.</p>
    </div>
  `;
  console.timeEnd('PhysioPipeline resultados page init');
}
});






