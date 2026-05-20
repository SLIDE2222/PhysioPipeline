import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_FILE = path.join(ROOT, 'search-taxonomy.generated.js');

const DEFAULT_INPUT_FILES = [
  'physiopipeline_20000_specialties.txt',
  'physiopipeline_25000_searches.txt',
];

const LIMITS = {
  coreSpecialties: 180,
  treatmentTags: 900,
  audienceTags: 220,
  seoSearchCombinations: 6000,
};

const BAD_WORDS = [
  'barato',
  'barata',
  'gratis',
  'gratuito',
  'milagroso',
  'moderno',
  'moderna',
  'humanizado',
  'humanizada',
  'personalizado',
  'personalizada',
  'intensivo',
  'intensiva',
  'especializado',
  'especializada',
  'focado',
  'focada',
  'avaliacao',
  'premium',
  'top',
  'melhor',
  'rapido',
  'rapida',
  'avancado',
  'avancada',
  'imperdivel',
  'promocao',
  'particular',
  'urgente',
  'bom',
  'boa',
];

const COMMERCIAL_HINTS = [
  'preco',
  'valor',
  'convenio',
  'orcamento',
  'quanto custa',
  'mais barato',
];

const CORE_HINTS = [
  'fisioterapia',
  'pilates',
  'rpg',
  'quiropraxia',
  'osteopatia',
  'terapia manual',
  'liberacao miofascial',
  'ventosaterapia',
  'drenagem linfatica',
  'ergonomia',
];

const TREATMENT_HINTS = [
  'dor',
  'hernia',
  'ciatica',
  'postura',
  'pos-operatorio',
  'pos operatorio',
  'reabilitacao',
  'mobilidade',
  'tendinite',
  'bursite',
  'artrose',
  'artrite',
  'lesao',
  'fratura',
  'entorse',
  'atm',
  'bruxismo',
  'vertigem',
  'labirintite',
  'dormencia',
  'formigamento',
  'rigidez',
  'fraqueza muscular',
  'avc',
  'asma',
  'bronquite',
  'dpoc',
  'ler',
  'dort',
  'dedo em gatilho',
  'tunel do carpo',
  'incontinencia',
];

const AUDIENCE_HINTS = [
  'idoso',
  'idosos',
  'idosa',
  'atleta',
  'atletas',
  'gestante',
  'gestantes',
  'crianca',
  'criancas',
  'bebe',
  'bebes',
  'corredor',
  'corredores',
  'trabalhador',
  'trabalhadores',
  'mulheres',
  'homens',
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toTitleCase(value) {
  const lowerWords = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'para', 'com', 'e']);

  return normalizeText(value)
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && lowerWords.has(word)) return word;
      if (word === 'rpg') return 'RPG';
      if (word === 'ler/dort' || word === 'ler' || word === 'dort') return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .replace(/\bFisioterapia\b/g, 'Fisioterapia')
    .replace(/\bPilates Clinico\b/g, 'Pilates Clinico');
}

function cleanEntry(value) {
  let text = String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/^\s*(?:[-*]|\d+[.)-])\s*/, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  text = normalizeText(text)
    .replace(/\bespecialista em\b/g, '')
    .replace(/\batendimento de\b/g, '')
    .replace(/\bclinica de\b/g, '')
    .replace(/\bcentro de\b/g, '')
    .replace(/\bprofissional de\b/g, '')
    .replace(/\b24 horas\b/g, '')
    .replace(/\bcomo aliviar\b/g, '')
    .replace(/\bcomo melhorar\b/g, '')
    .replace(/\bcomo tratar\b/g, '')
    .replace(/\bprecisa de fisioterapia\b/g, '')
    .replace(/\btratamento com\b/g, '')
    .replace(/\btratamento para\b/g, '')
    .replace(/\bfisioterapeuta para\b/g, 'fisioterapia para')
    .replace(/^(em|no|na|para)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  text = text.replace(/^domiciliar\s+(.+)$/g, '$1 domiciliar').replace(/\s+/g, ' ').trim();

  if (COMMERCIAL_HINTS.some((hint) => text.includes(hint))) return null;

  BAD_WORDS.forEach((word) => {
    text = text.replace(new RegExp(`\\b${word}\\b`, 'g'), '').replace(/\s+/g, ' ').trim();
  });

  text = text.replace(/\b(\w+)(\s+\1\b)+/g, '$1').replace(/\s+/g, ' ').trim();
  text = text.replace(/^(de|em|no|na|para)\s+/g, '').replace(/\s+/g, ' ').trim();

  if (!text || text.length < 3 || text.length > 130) return null;
  if (/https?:\/\//.test(text)) return null;
  if (/(whatsapp|telefone|contato|agende|orcamento)/.test(text)) return null;
  if (/^\d+$/.test(text)) return null;

  return text;
}

function flattenJson(value) {
  if (Array.isArray(value)) return value.flatMap(flattenJson);
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenJson);
  return [value];
}

function extractEntries(rawText) {
  const trimmed = rawText.trim();

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return flattenJson(JSON.parse(trimmed));
    } catch (_) {
      // Fall back to line parsing.
    }
  }

  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasAny(text, hints) {
  return hints.some((hint) => text.includes(hint));
}

function isSeoCombo(text) {
  return (
    /\b(para|por|em|no|na|com)\b/.test(text) &&
    text.split(/\s+/).length >= 3
  );
}

function isAudience(text) {
  if (isSeoCombo(text)) return false;
  return hasAny(text, AUDIENCE_HINTS) && text.split(/\s+/).length <= 5;
}

function isTreatment(text) {
  if (isSeoCombo(text)) return false;
  return hasAny(text, TREATMENT_HINTS) && text.split(/\s+/).length <= 7;
}

function isCoreSpecialty(text) {
  if (isSeoCombo(text)) return false;
  if (isTreatment(text) && !text.startsWith('fisioterapia')) return false;
  return hasAny(text, CORE_HINTS) && text.split(/\s+/).length <= 5;
}

function addUnique(bucket, rawValue, limit) {
  if (bucket.length >= limit) return;
  const display = toTitleCase(rawValue);
  const key = normalizeText(display);
  if (!key || bucket._seen.has(key)) return;
  bucket._seen.add(key);
  bucket.push(display);
}

function createBucket() {
  const bucket = [];
  Object.defineProperty(bucket, '_seen', {
    value: new Set(),
    enumerable: false,
  });
  return bucket;
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const inputFiles = args.length
    ? args.map((arg) => path.resolve(process.cwd(), arg))
    : DEFAULT_INPUT_FILES.map((file) => path.join(ROOT, file));

  const existingFiles = [];
  for (const file of inputFiles) {
    if (await pathExists(file)) existingFiles.push(file);
  }

  if (!existingFiles.length) {
    throw new Error(
      `No taxonomy input files found. Put ${DEFAULT_INPUT_FILES.join(' and ')} in the repo root, or pass file paths as args.`
    );
  }

  const coreSpecialties = createBucket();
  const treatmentTags = createBucket();
  const audienceTags = createBucket();
  const seoSearchCombinations = createBucket();
  let totalRawEntries = 0;

  for (const file of existingFiles) {
    const rawText = await readFile(file, 'utf8');
    const entries = extractEntries(rawText);
    totalRawEntries += entries.length;

    entries.forEach((entry) => {
      const clean = cleanEntry(entry);
      if (!clean) return;

      if (isCoreSpecialty(clean)) {
        addUnique(coreSpecialties, clean, LIMITS.coreSpecialties);
      } else if (isAudience(clean)) {
        addUnique(audienceTags, clean, LIMITS.audienceTags);
      } else if (isTreatment(clean)) {
        addUnique(treatmentTags, clean, LIMITS.treatmentTags);
      } else if (isSeoCombo(clean)) {
        addUnique(seoSearchCombinations, clean, LIMITS.seoSearchCombinations);
      }
    });
  }

  const generated = {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceFiles: existingFiles.map((file) => path.relative(ROOT, file)),
      totalRawEntries,
      limits: LIMITS,
      note: 'Generated by tools/build-search-taxonomy.js. Keep profile dropdowns curated; use expanded data for search/autocomplete/SEO.',
    },
    coreSpecialties: [...coreSpecialties],
    treatmentTags: [...treatmentTags],
    audienceTags: [...audienceTags],
    seoSearchCombinations: [...seoSearchCombinations],
    searchSynonymGroups: [],
  };

  const output = `(function () {\n  window.PhysioGeneratedTaxonomy = ${JSON.stringify(generated, null, 2)};\n})();\n`;
  await writeFile(OUTPUT_FILE, output, 'utf8');

  console.log(`Wrote ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log(JSON.stringify({
    sourceFiles: generated.metadata.sourceFiles,
    totalRawEntries,
    coreSpecialties: generated.coreSpecialties.length,
    treatmentTags: generated.treatmentTags.length,
    audienceTags: generated.audienceTags.length,
    seoSearchCombinations: generated.seoSearchCombinations.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
