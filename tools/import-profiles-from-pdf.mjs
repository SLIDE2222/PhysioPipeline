import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const DEFAULT_REPORT_DIR = path.join(projectRoot, "storage", "import-reports");
const EXTRACTOR_PATH = path.join(__dirname, "extract-profile-rows.py");
const DEFAULT_PYTHON_CANDIDATES = [
  process.env.PDF_IMPORT_PYTHON,
  "C:\\Users\\Jeffrey Walker\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
  "python",
  "py",
].filter(Boolean);

function parseArgs(argv) {
  const args = {
    pdfPath: null,
    dryRun: false,
    reportPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) continue;

    if (argument === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (argument === "--report" && argv[index + 1]) {
      args.reportPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (!args.pdfPath) {
      args.pdfPath = argument;
    }
  }

  if (!args.pdfPath) {
    throw new Error("Usage: node tools/import-profiles-from-pdf.mjs <pdf-path> [--dry-run] [--report <path>]");
  }

  return args;
}

function normalizeLoose(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cleanText(value) {
  const text = String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function normalizeNullishText(value) {
  const text = cleanText(value);
  if (!text) return null;
  const normalized = normalizeLoose(text);
  if (!normalized) return null;
  if (
    normalized === "null" ||
    normalized === "undefined" ||
    normalized === "naoinformado" ||
    normalized === "naoinformada" ||
    normalized === "seminformacao" ||
    normalized === "falseforimportedprofiles"
  ) {
    return null;
  }
  return text;
}

function titleCaseNamePart(value) {
  if (!value) return value;
  const lower = value.toLowerCase();
  if (["de", "da", "do", "dos", "das", "e"].includes(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function humanizeNameFromId(id) {
  const slug = String(id || "")
    .replace(/^fisio[-_]?/i, "")
    .replace(/^profile[-_]?/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!slug) return null;

  const mergedPreposition = slug.match(/^([a-zà-ÿ]+?)(de|da|do|dos|das)([a-zà-ÿ]+)$/i);
  const expanded = mergedPreposition
    ? `${mergedPreposition[1]} ${mergedPreposition[2]} ${mergedPreposition[3]}`
    : slug;

  return expanded
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseNamePart)
    .join(" ");
}

function normalizePhoneNumber(value) {
  const match = String(value || "").match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})-?\d{4}/);
  if (!match) return null;

  let digits = match[0].replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 13) return null;

  return digits;
}

function isValidUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function validateImageUrl(value) {
  const url = cleanText(value);
  if (!url || !isValidUrl(url)) return null;

  const pathname = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch (_) {
      return "";
    }
  })();

  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(pathname) || pathname.includes("/profile-images/")) {
    return url;
  }

  return null;
}

function toBooleanOrNull(value) {
  const normalized = normalizeLoose(value);
  if (!normalized) return null;
  if (normalized.includes("true")) return true;
  if (normalized.includes("false")) return false;
  return null;
}

function uniqueCaseInsensitive(values) {
  const byKey = new Map();
  for (const value of values) {
    const clean = normalizeNullishText(value);
    if (!clean) continue;
    const key = normalizeLoose(clean);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, clean);
  }
  return [...byKey.values()];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const rows = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );
    }
  }

  return rows[a.length][b.length];
}

function similarity(a, b) {
  const left = normalizeLoose(a);
  const right = normalizeLoose(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = levenshtein(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

function findApproxContainedValue(text, options, minScore = 0.72) {
  const normalizedText = normalizeLoose(text);
  if (!normalizedText) return null;

  let best = { option: null, score: 0 };
  for (const option of options) {
    const normalizedOption = normalizeLoose(option);
    if (!normalizedOption) continue;

    if (normalizedText.includes(normalizedOption)) {
      return { option, score: 1 };
    }

    const lowerWindow = Math.max(4, normalizedOption.length - 2);
    const upperWindow = Math.min(normalizedText.length, normalizedOption.length + 2);

    for (let width = lowerWindow; width <= upperWindow; width += 1) {
      for (let index = 0; index <= normalizedText.length - width; index += 1) {
        const window = normalizedText.slice(index, index + width);
        const score = similarity(window, normalizedOption);
        if (score > best.score) best = { option, score };
      }
    }
  }

  return best.score >= minScore ? best : null;
}

function cleanupSpecialtyText(value, city) {
  let text = normalizeNullishText(value) || "";
  if (!text) return null;

  if (city) {
    const normalizedCity = normalizeLoose(city);
    const normalizedText = normalizeLoose(text);
    const cityIndex = normalizedText.lastIndexOf(normalizedCity);
    if (cityIndex >= 0) {
      const ratio = normalizedText.length ? cityIndex / normalizedText.length : 0;
      if (ratio >= 0.45) {
        text = text.slice(0, Math.max(0, text.length - city.length)).trim();
      }
    }
  }

  text = text
    .replace(/instrutor(a)?\s+de\s+pila[tli][a-z]*/i, (_, feminine) =>
      feminine ? "Instrutora de Pilates" : "Instrutor de Pilates"
    )
    .replace(/instrutor(a)?\s+depila[tli][a-z]*/i, (_, feminine) =>
      feminine ? "Instrutora de Pilates" : "Instrutor de Pilates"
    )
    .replace(/\bpila[tli][a-z]*/i, "Pilates")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!text) return null;
  return text;
}

async function loadReferenceData() {
  const profiles = await prisma.profile.findMany({
    select: {
      city: true,
      specialty: true,
      secondarySpecialty: true,
      tertiarySpecialty: true,
    },
    take: 5000,
    orderBy: { updatedAt: "desc" },
  });

  return {
    knownCities: uniqueCaseInsensitive(profiles.map((profile) => profile.city)),
    knownSpecialties: uniqueCaseInsensitive(
      profiles.flatMap((profile) => [
        profile.specialty,
        profile.secondarySpecialty,
        profile.tertiarySpecialty,
      ])
    ),
  };
}

function resolveCity(rawRow, knownCities) {
  const candidates = [
    rawRow.rawCells?.city,
    rawRow.rawCells?.attendance,
    rawRow.rawCells?.specialty,
    rawRow.fullText,
  ];

  for (const candidate of candidates) {
    const clean = normalizeNullishText(candidate);
    if (clean && knownCities.some((city) => normalizeLoose(city) === normalizeLoose(clean))) {
      return clean;
    }
  }

  let best = null;
  for (const candidate of candidates) {
    const result = findApproxContainedValue(candidate, knownCities, 0.72);
    if (result && (!best || result.score > best.score)) best = result;
  }

  return best?.option || null;
}

function resolveSpecialty(rawRow, city, knownSpecialties, warnings) {
  const isClaimedMarker = normalizeNullishText(rawRow.rawCells?.isClaimed);
  const specialtySegment = isClaimedMarker
    ? rawRow.fullText.split(isClaimedMarker)[0]
    : rawRow.rawCells?.specialty || rawRow.fullText;

  const combinedCells = [rawRow.rawCells?.specialty, rawRow.rawCells?.city]
    .map((item) => String(item || ""))
    .join(" ")
    .trim();

  const cleanedDirect = cleanupSpecialtyText(combinedCells || rawRow.rawCells?.specialty, city);
  if (cleanedDirect && cleanedDirect.length >= 4) return cleanedDirect;

  const cleanedSegment = cleanupSpecialtyText(
    specialtySegment.replace(String(rawRow.rawCells?.id || ""), "").trim(),
    city
  );

  if (cleanedSegment && cleanedSegment.length >= 4) {
    const fuzzy = findApproxContainedValue(cleanedSegment, knownSpecialties, 0.86);
    return fuzzy?.option || cleanedSegment;
  }

  const fallback = findApproxContainedValue(rawRow.fullText, knownSpecialties, 0.78);
  if (fallback?.option) return fallback.option;

  warnings.push("Could not confidently resolve specialty.");
  return null;
}

function extractBio(rawRow) {
  const candidate = normalizeNullishText(rawRow.rawCells?.bio);
  if (candidate && /[a-zà-ÿ]{4,}/i.test(candidate)) return candidate;

  const phoneCell = String(rawRow.rawCells?.phone || "");
  const afterPhone = phoneCell.replace(/.*?(?:\d{4,5}-\d{4})/i, "").trim();
  const cleanedPhoneTail = normalizeNullishText(afterPhone);
  if (cleanedPhoneTail && /^[A-Za-zÀ-ÿ\s]{4,80}$/i.test(cleanedPhoneTail)) {
    return cleanedPhoneTail;
  }

  const match = rawRow.fullText.match(
    /(?:\d{4,5}-\d{4}\s*)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{4,80}?)(?=\s+(?:https?:|www\.|@|[A-Za-z0-9._%+-]+\/))/i
  );
  return normalizeNullishText(match?.[1] || null);
}

function extractAttendance(rawRow, city) {
  const explicit = normalizeNullishText(rawRow.rawCells?.attendance);
  if (explicit && /domic|clinic|cl[ií]nic/i.test(explicit)) return explicit;

  const normalizedText = normalizeLoose(rawRow.fullText);
  if (normalizedText.includes("domic") || normalizedText.includes("domi") || normalizedText.includes("domo")) {
    return city ? `Atendimento domiciliar - ${city}/SP` : "Atendimento domiciliar";
  }
  if (normalizedText.includes("clin")) return "Clínica";
  return null;
}

function extractUrls(rawRow, warnings) {
  const values = [rawRow.rawCells?.instagram, rawRow.rawCells?.linkedin, rawRow.rawCells?.photoUrl, rawRow.fullText]
    .map((value) => String(value || ""))
    .join(" ");

  const urlMatches = values.match(/https?:\/\/[^\s]+/gi) || [];
  const urls = [...new Set(urlMatches.map((url) => url.replace(/[),.;]+$/g, "")))];

  const instagram = urls.find((url) => /instagram\.com/i.test(url)) || null;
  const linkedin = urls.find((url) => /linkedin\.com/i.test(url)) || null;
  const photoUrl = validateImageUrl(urls.find((url) => validateImageUrl(url)) || null);

  if (!photoUrl && /profile-images\/|\.png|\.jpg|\.jpeg|\.webp/i.test(values)) {
    warnings.push("Photo URL looked corrupted and was skipped.");
  }

  return {
    instagram: isValidUrl(instagram) ? instagram : null,
    linkedin: isValidUrl(linkedin) ? linkedin : null,
    photoUrl,
  };
}

function normalizeProfileRow(rawRow, referenceData) {
  const warnings = [];
  const errors = [];
  const id = normalizeNullishText(rawRow.rawCells?.id) || normalizeNullishText(rawRow.fullText.split(/\s+/)[0]);

  if (!id) {
    return {
      skipped: true,
      reason: "Missing profile id.",
      warnings,
      errors,
      normalized: null,
    };
  }

  const city = resolveCity(rawRow, referenceData.knownCities);
  const specialty = resolveSpecialty(rawRow, city, referenceData.knownSpecialties, warnings);
  const phone = normalizePhoneNumber(`${rawRow.rawCells?.phone || ""} ${rawRow.rawCells?.bio || ""} ${rawRow.fullText || ""}`);
  const urls = extractUrls(rawRow, warnings);
  const name = normalizeNullishText(rawRow.rawCells?.name) || humanizeNameFromId(id);
  const bio = extractBio(rawRow);
  const attendance = extractAttendance(rawRow, city);
  const claimedFlag = toBooleanOrNull(rawRow.rawCells?.isClaimed);

  if (!name) errors.push("Missing name.");
  if (!specialty) errors.push("Missing specialty.");
  if (!city) errors.push("Missing city.");

  const secondarySpecialtyCandidate = normalizeNullishText(rawRow.rawCells?.secondarySpecialty);
  const secondarySpecialty =
    secondarySpecialtyCandidate &&
    !/[\\/]|profile-images|https?|\.png|\.jpe?g|\.webp/i.test(secondarySpecialtyCandidate) &&
    secondarySpecialtyCandidate.length <= 80
      ? secondarySpecialtyCandidate
      : null;
  const tertiarySpecialty = normalizeNullishText(rawRow.rawCells?.tertiarySpecialty);
  const neighborhoodCandidate = normalizeNullishText(rawRow.rawCells?.neighborhood);
  const neighborhood =
    neighborhoodCandidate && !/imported\s*profiles/i.test(neighborhoodCandidate) ? neighborhoodCandidate : null;

  const normalized = {
    id,
    name,
    specialty,
    secondarySpecialty,
    tertiarySpecialty,
    city,
    neighborhood,
    phone,
    bio,
    instagram: urls.instagram,
    linkedin: urls.linkedin,
    photoUrl: urls.photoUrl,
    publicEmail: null,
    attendance,
    isClaimed: claimedFlag === true ? true : false,
    ownerUserId: null,
  };

  return {
    skipped: errors.length > 0,
    reason: errors.length ? errors.join(" ") : null,
    warnings,
    errors,
    normalized,
  };
}

function resolvePythonCommand() {
  for (const candidate of DEFAULT_PYTHON_CANDIDATES) {
    if (!candidate) continue;
    if (candidate.toLowerCase().endsWith(".exe") && !existsSync(candidate)) continue;
    return candidate;
  }
  return "python";
}

function extractRowsFromPdf(pdfPath) {
  const python = resolvePythonCommand();
  const result = spawnSync(python, [EXTRACTOR_PATH, pdfPath], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`Failed to run PDF extractor with ${python}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "PDF extractor failed.");
  }

  return JSON.parse(result.stdout);
}

function timestampLabel(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function saveReport(reportPath, report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pdfPath = path.resolve(args.pdfPath);
  const extracted = extractRowsFromPdf(pdfPath);
  const referenceData = await loadReferenceData();

  const report = {
    pdfPath,
    importedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    totalProfilesFound: extracted.rows.length,
    successfullyImportedProfiles: 0,
    updatedProfiles: 0,
    skippedProfiles: 0,
    validationErrors: [],
    warnings: [],
    rows: [],
  };

  for (const rawRow of extracted.rows) {
    if (!cleanText(rawRow.fullText)) continue;

    const normalizedRow = normalizeProfileRow(rawRow, referenceData);
    const rowReport = {
      page: rawRow.page,
      top: rawRow.top,
      rawCells: rawRow.rawCells,
      fullText: rawRow.fullText,
      warnings: normalizedRow.warnings,
      errors: normalizedRow.errors,
      normalized: normalizedRow.normalized,
      action: "skipped",
    };

    if (normalizedRow.skipped || !normalizedRow.normalized) {
      report.skippedProfiles += 1;
      report.validationErrors.push({
        id: normalizedRow.normalized?.id || null,
        page: rawRow.page,
        errors: normalizedRow.errors,
      });
      report.rows.push(rowReport);
      continue;
    }

    const payload = normalizedRow.normalized;
    const existing = await prisma.profile.findUnique({ where: { id: payload.id } });

    if (!args.dryRun) {
      await prisma.profile.upsert({
        where: { id: payload.id },
        update: payload,
        create: payload,
      });
    }

    if (existing) {
      report.updatedProfiles += 1;
      rowReport.action = "updated";
    } else {
      report.successfullyImportedProfiles += 1;
      rowReport.action = "created";
    }

    report.rows.push(rowReport);
  }

  const reportPath =
    args.reportPath
      ? path.resolve(args.reportPath)
      : path.join(DEFAULT_REPORT_DIR, `profile-pdf-import-${timestampLabel()}.json`);

  await saveReport(reportPath, report);

  console.log(JSON.stringify({
    summary: {
      totalProfilesFound: report.totalProfilesFound,
      successfullyImportedProfiles: report.successfullyImportedProfiles,
      updatedProfiles: report.updatedProfiles,
      skippedProfiles: report.skippedProfiles,
      validationErrors: report.validationErrors.length,
      reportPath,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("Profile PDF import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
