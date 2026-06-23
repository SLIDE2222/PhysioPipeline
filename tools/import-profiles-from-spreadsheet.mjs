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
const EXTRACTOR_PATH = path.join(__dirname, "extract-profile-rows-from-spreadsheet.py");
const DEFAULT_PYTHON_CANDIDATES = [
  process.env.SPREADSHEET_IMPORT_PYTHON,
  "C:\\Users\\Jeffrey Walker\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
  "python",
  "py",
].filter(Boolean);

const PROFILE_FIELDS = [
  "id",
  "name",
  "specialty",
  "secondarySpecialty",
  "tertiarySpecialty",
  "city",
  "neighborhood",
  "phone",
  "bio",
  "attendance",
  "instagram",
  "linkedin",
  "photoUrl",
  "isClaimed",
  "ownerUserId",
  "createdAt",
  "updatedAt",
];

function parseArgs(argv) {
  const args = {
    filePath: null,
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

    if (!args.filePath) args.filePath = argument;
  }

  if (!args.filePath) {
    throw new Error(
      "Usage: node tools/import-profiles-from-spreadsheet.mjs <csv-or-xlsx-path> [--dry-run] [--report <path>]"
    );
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
    normalized === "seminformacao"
  ) {
    return null;
  }
  return text;
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildHeaderMap(headers) {
  const aliases = new Map([
    ["id", "id"],
    ["name", "name"],
    ["nome", "name"],
    ["specialty", "specialty"],
    ["especialidade", "specialty"],
    ["secondaryspecialty", "secondarySpecialty"],
    ["especialidadesecundaria", "secondarySpecialty"],
    ["tertiaryspecialty", "tertiarySpecialty"],
    ["especialidadeterciaria", "tertiarySpecialty"],
    ["city", "city"],
    ["cidade", "city"],
    ["neighborhood", "neighborhood"],
    ["bairro", "neighborhood"],
    ["phone", "phone"],
    ["telefone", "phone"],
    ["whatsapp", "phone"],
    ["bio", "bio"],
    ["descricao", "bio"],
    ["description", "bio"],
    ["attendance", "attendance"],
    ["atendimento", "attendance"],
    ["instagram", "instagram"],
    ["linkedin", "linkedin"],
    ["photourl", "photoUrl"],
    ["foto", "photoUrl"],
    ["imagem", "photoUrl"],
    ["isclaimed", "isClaimed"],
    ["owneruserid", "ownerUserId"],
    ["createdat", "createdAt"],
    ["updatedat", "updatedAt"],
  ]);

  const map = new Map();
  for (const header of headers || []) {
    const alias = aliases.get(normalizeHeader(header));
    if (alias) map.set(alias, header);
  }
  return map;
}

function titleCaseNamePart(value) {
  const lower = String(value || "").toLowerCase();
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
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (normalized.length === 10 || normalized.length === 11) normalized = `55${normalized}`;
  if (normalized.length < 12 || normalized.length > 13) return null;
  return normalized;
}

function isValidUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function normalizeBoolean(value, defaultValue = false) {
  const normalized = normalizeLoose(value);
  if (!normalized) return defaultValue;
  if (normalized.includes("true")) return true;
  if (normalized.includes("false")) return false;
  return defaultValue;
}

function parseSpreadsheetDate(value) {
  const text = cleanText(value);
  if (!text || /^auto$/i.test(text)) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function recoverUrlsFromRow(rowValues) {
  const values = Object.values(rowValues || {}).map((value) => String(value || ""));
  const compactText = values.join("");
  const detected = new Set();

  for (const source of values) {
    const matches = source.match(/https?:\/\/[^\s,;]+/gi) || [];
    for (const match of matches) {
      detected.add(match.replace(/[)"'.;,]+$/g, ""));
    }
  }

  const compactMatches = compactText.match(/https?:\/\/.*?(?=https?:\/\/|$)/gi) || [];
  for (const match of compactMatches) {
    const cleaned = match
      .replace(/(?:Auto)+$/i, "")
      .replace(/[)"'.;,]+$/g, "");
    if (isValidUrl(cleaned)) detected.add(cleaned);
  }

  return [...detected];
}

function splitUrlsByType(urls) {
  const detected = [];
  const rejected = [];
  let instagram = null;
  let linkedin = null;
  let photoUrl = null;

  for (const url of urls) {
    if (!isValidUrl(url)) {
      rejected.push({ url, reason: "Invalid URL format." });
      continue;
    }

    detected.push(url);

    if (!instagram && /instagram\.com/i.test(url)) {
      instagram = url;
      continue;
    }

    if (!linkedin && /linkedin\.com/i.test(url)) {
      linkedin = url;
      continue;
    }

    const pathname = (() => {
      try {
        return new URL(url).pathname.toLowerCase();
      } catch (_) {
        return "";
      }
    })();

    if (!photoUrl && (pathname.includes("/profile-images/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(pathname))) {
      photoUrl = url;
      continue;
    }
  }

  return { detected, rejected, instagram, linkedin, photoUrl };
}

function isCompletelyEmptyRow(values) {
  return Object.values(values || {}).every((value) => !cleanText(value));
}

function buildNormalizedRecord(row, headerMap) {
  const cells = row.cells || {};
  const warnings = [];
  const errors = [];

  const getField = (fieldName) => {
    const rawHeader = headerMap.get(fieldName);
    return rawHeader ? cells[rawHeader] : "";
  };

  const record = {};
  for (const field of PROFILE_FIELDS) {
    record[field] = getField(field);
  }

  const id = normalizeNullishText(record.id);
  const name = normalizeNullishText(record.name) || humanizeNameFromId(id);
  const specialty = normalizeNullishText(record.specialty);
  const city = normalizeNullishText(record.city);
  const neighborhood = normalizeNullishText(record.neighborhood);
  const attendance = normalizeNullishText(record.attendance);
  const bio = normalizeNullishText(record.bio);
  const ownerUserId = normalizeNullishText(record.ownerUserId);
  const secondarySpecialty = normalizeNullishText(record.secondarySpecialty);
  const tertiarySpecialty = normalizeNullishText(record.tertiarySpecialty);
  const createdAt = parseSpreadsheetDate(record.createdAt);
  const updatedAt = parseSpreadsheetDate(record.updatedAt);

  if (!id) errors.push("Missing id.");
  if (!name) errors.push("Missing name.");
  if (!specialty) errors.push("Missing specialty.");
  if (!city) errors.push("Missing city.");

  const urls = splitUrlsByType(recoverUrlsFromRow(cells));
  const instagram = urls.instagram || (isValidUrl(record.instagram) ? cleanText(record.instagram) : null);
  const linkedin = urls.linkedin || (isValidUrl(record.linkedin) ? cleanText(record.linkedin) : null);
  const photoUrl = urls.photoUrl || (isValidUrl(record.photoUrl) ? cleanText(record.photoUrl) : null);

  if (record.instagram && !instagram) warnings.push("Instagram URL was rejected.");
  if (record.linkedin && !linkedin) warnings.push("LinkedIn URL was rejected.");
  if (record.photoUrl && !photoUrl) warnings.push("Photo URL was rejected.");

  const phone = normalizePhoneNumber(record.phone || bio || "");
  if (record.phone && !phone) warnings.push("Phone number could not be normalized.");

  const resolvedAttendance =
    attendance ||
    (() => {
      const bioText = normalizeNullishText(record.bio);
      if (!bioText) return null;
      const match = bioText.match(/Atendimento[^]+$/i);
      return normalizeNullishText(match?.[0] || null);
    })();

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
    attendance: resolvedAttendance,
    instagram,
    linkedin,
    photoUrl,
    isClaimed: normalizeBoolean(record.isClaimed, false),
    ownerUserId: ownerUserId || null,
    createdAt,
    updatedAt,
  };

  return {
    normalized,
    warnings,
    errors,
    urlsDetected: urls.detected,
    urlsRejected: urls.rejected,
    skipped: errors.length > 0,
  };
}

function mergeRecords(baseRecord, nextRecord) {
  const merged = { ...baseRecord, ...nextRecord };
  for (const field of PROFILE_FIELDS) {
    if (field === "isClaimed") {
      merged[field] = nextRecord[field] ?? baseRecord[field] ?? false;
      continue;
    }

    if (nextRecord[field] !== null && nextRecord[field] !== undefined && nextRecord[field] !== "") {
      merged[field] = nextRecord[field];
    } else if (baseRecord[field] !== undefined) {
      merged[field] = baseRecord[field];
    }
  }
  return merged;
}

function resolvePythonCommand() {
  for (const candidate of DEFAULT_PYTHON_CANDIDATES) {
    if (!candidate) continue;
    if (candidate.toLowerCase().endsWith(".exe") && !existsSync(candidate)) continue;
    return candidate;
  }
  return "python";
}

function extractRowsFromSpreadsheet(filePath) {
  const python = resolvePythonCommand();
  const result = spawnSync(python, [EXTRACTOR_PATH, filePath], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`Failed to run spreadsheet extractor with ${python}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Spreadsheet extractor failed.");
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
  const filePath = path.resolve(args.filePath);
  const extracted = extractRowsFromSpreadsheet(filePath);
  const headerMap = buildHeaderMap(extracted.headers);

  const report = {
    filePath,
    importedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    totalProfilesFound: 0,
    importedProfiles: 0,
    updatedProfiles: 0,
    skippedProfiles: 0,
    validationErrors: [],
    urlsDetected: [],
    urlsRejected: [],
    finalSavedProfileObjects: [],
    rows: [],
  };

  const rowsById = new Map();

  for (const row of extracted.rows) {
    if (isCompletelyEmptyRow(row.cells)) continue;
    report.totalProfilesFound += 1;

    const parsed = buildNormalizedRecord(row, headerMap);
    report.urlsDetected.push(
      ...parsed.urlsDetected.map((url) => ({ rowNumber: row.rowNumber, sheet: row.sheet, url }))
    );
    report.urlsRejected.push(
      ...parsed.urlsRejected.map((item) => ({ rowNumber: row.rowNumber, sheet: row.sheet, ...item }))
    );

    const rowReport = {
      sheet: row.sheet,
      rowNumber: row.rowNumber,
      original: row.cells,
      normalized: parsed.normalized,
      warnings: parsed.warnings,
      errors: parsed.errors,
      action: "pending",
    };

    if (parsed.skipped) {
      report.skippedProfiles += 1;
      rowReport.action = "skipped";
      report.validationErrors.push({
        sheet: row.sheet,
        rowNumber: row.rowNumber,
        id: parsed.normalized.id || null,
        errors: parsed.errors,
      });
      report.rows.push(rowReport);
      continue;
    }

    const existing = rowsById.get(parsed.normalized.id);
    rowsById.set(
      parsed.normalized.id,
      existing
        ? {
            ...existing,
            normalized: mergeRecords(existing.normalized, parsed.normalized),
            sourceRows: [...existing.sourceRows, row.rowNumber],
            warnings: [...existing.warnings, ...parsed.warnings],
          }
        : {
            normalized: parsed.normalized,
            sourceRows: [row.rowNumber],
            warnings: parsed.warnings,
            sheet: row.sheet,
          }
    );

    rowReport.action = existing ? "merged-duplicate-id" : "queued";
    report.rows.push(rowReport);
  }

  for (const [id, queued] of rowsById.entries()) {
    const createData = {
      id,
      name: queued.normalized.name,
      specialty: queued.normalized.specialty,
      secondarySpecialty: queued.normalized.secondarySpecialty,
      tertiarySpecialty: queued.normalized.tertiarySpecialty,
      city: queued.normalized.city,
      neighborhood: queued.normalized.neighborhood,
      phone: queued.normalized.phone,
      bio: queued.normalized.bio,
      attendance: queued.normalized.attendance,
      instagram: queued.normalized.instagram,
      linkedin: queued.normalized.linkedin,
      photoUrl: queued.normalized.photoUrl,
      isClaimed: queued.normalized.isClaimed,
      ownerUserId: queued.normalized.ownerUserId,
      ...(queued.normalized.createdAt ? { createdAt: queued.normalized.createdAt } : {}),
      ...(queued.normalized.updatedAt ? { updatedAt: queued.normalized.updatedAt } : {}),
    };

    const updateData = {
      name: queued.normalized.name,
      specialty: queued.normalized.specialty,
      secondarySpecialty: queued.normalized.secondarySpecialty,
      tertiarySpecialty: queued.normalized.tertiarySpecialty,
      city: queued.normalized.city,
      neighborhood: queued.normalized.neighborhood,
      phone: queued.normalized.phone,
      bio: queued.normalized.bio,
      attendance: queued.normalized.attendance,
      instagram: queued.normalized.instagram,
      linkedin: queued.normalized.linkedin,
      photoUrl: queued.normalized.photoUrl,
      isClaimed: queued.normalized.isClaimed,
      ownerUserId: queued.normalized.ownerUserId,
      ...(queued.normalized.createdAt ? { createdAt: queued.normalized.createdAt } : {}),
      ...(queued.normalized.updatedAt ? { updatedAt: queued.normalized.updatedAt } : {}),
    };

    const existing = await prisma.profile.findUnique({ where: { id } });
    const saved = args.dryRun
      ? { ...createData, createdAt: createData.createdAt || null, updatedAt: createData.updatedAt || null }
      : await prisma.profile.upsert({
          where: { id },
          update: updateData,
          create: createData,
        });

    report.finalSavedProfileObjects.push(saved);
    if (existing) report.updatedProfiles += 1;
    else report.importedProfiles += 1;
  }

  const reportPath =
    args.reportPath
      ? path.resolve(args.reportPath)
      : path.join(DEFAULT_REPORT_DIR, `profile-spreadsheet-import-${timestampLabel()}.json`);

  await saveReport(reportPath, report);

  console.log(
    JSON.stringify(
      {
        summary: {
          totalProfilesFound: report.totalProfilesFound,
          importedProfiles: report.importedProfiles,
          updatedProfiles: report.updatedProfiles,
          skippedProfiles: report.skippedProfiles,
          validationErrors: report.validationErrors.length,
          urlsDetected: report.urlsDetected.length,
          urlsRejected: report.urlsRejected.length,
          reportPath,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Spreadsheet profile import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
