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

const UPDATEABLE_PROFILE_FIELDS = [
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
];

function repairMojibake(value) {
  const text = String(value ?? "");
  if (!text) return text;
  if (!/[ÃƒÃ¢Ã°]/.test(text)) return text;

  try {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    return repaired.includes("\uFFFD") ? text : repaired;
  } catch (_) {
    return text;
  }
}

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
  const text = repairMojibake(String(value ?? ""))
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

  const mergedPreposition = slug.match(/^([a-zÃ -Ã¿]+?)(de|da|do|dos|das)([a-zÃ -Ã¿]+)$/i);
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

function normalizeInstagramKey(value) {
  const text = normalizeNullishText(value);
  if (!text) return null;

  try {
    const candidate = /^https?:\/\//i.test(text) ? text : `https://instagram.com/${text.replace(/^@/, "")}`;
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (hostname !== "instagram.com") {
      return normalizeLoose(text.replace(/^@/, ""));
    }

    const handle = parsed.pathname
      .split("/")
      .map((part) => cleanText(part))
      .filter(Boolean)[0];

    return handle ? normalizeLoose(String(handle).replace(/^@/, "")) : normalizeLoose(text.replace(/^@/, ""));
  } catch (_) {
    return normalizeLoose(text.replace(/^@/, ""));
  }
}

function normalizeNameCityKey(name, city) {
  const normalizedName = normalizeLoose(name);
  const normalizedCity = normalizeLoose(city);
  if (!normalizedName || !normalizedCity) return null;
  return `${normalizedName}::${normalizedCity}`;
}

function isProtectedClaimedProfile(profile) {
  return Boolean(profile?.isClaimed || profile?.ownerUserId);
}

function hasMeaningfulValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function isCompletelyEmptyRow(values) {
  const entries = Object.entries(values || {});
  const meaningful = entries.filter(([key, value]) => {
    const normalizedKey = normalizeHeader(key);
    const text = cleanText(value);
    if (!text) return false;
    if (normalizedKey === "isclaimed" && normalizeLoose(text).includes("falseforimportedprofiles")) {
      return false;
    }
    if ((normalizedKey === "createdat" || normalizedKey === "updatedat") && /^auto$/i.test(text)) {
      return false;
    }
    return true;
  });

  return meaningful.length === 0;
}

async function loadReferenceData() {
  const profiles = await prisma.profile.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      phone: true,
      instagram: true,
      isClaimed: true,
      ownerUserId: true,
      specialty: true,
      secondarySpecialty: true,
      tertiarySpecialty: true,
      neighborhood: true,
      bio: true,
      attendance: true,
      linkedin: true,
      photoUrl: true,
      createdAt: true,
      updatedAt: true,
    },
    take: 10000,
    orderBy: { updatedAt: "desc" },
  });

  const knownCities = [...new Set(profiles.map((profile) => cleanText(profile.city)).filter(Boolean))];
  const existingProfiles = profiles.map((profile) => ({
    ...profile,
    normalizedPhone: normalizePhoneNumber(profile.phone),
    normalizedInstagram: normalizeInstagramKey(profile.instagram),
    normalizedNameCity: normalizeNameCityKey(profile.name, profile.city),
  }));

  return { knownCities, existingProfiles };
}

function inferCityFromText(text, knownCities) {
  const haystack = normalizeLoose(text);
  if (!haystack) return null;
  for (const city of knownCities) {
    if (haystack.includes(normalizeLoose(city))) return city;
  }
  return null;
}

function buildNormalizedRecord(row, headerMap, referenceData) {
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
  const city =
    normalizeNullishText(record.city) ||
    inferCityFromText(`${record.bio || ""} ${record.attendance || ""} ${record.neighborhood || ""}`, referenceData.knownCities);
  const neighborhood = normalizeNullishText(record.neighborhood);
  const attendance = normalizeNullishText(record.attendance);
  const bio = normalizeNullishText(record.bio);
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

  const csvRequestedClaimed = normalizeBoolean(record.isClaimed, false);
  if (csvRequestedClaimed) {
    warnings.push("Spreadsheet isClaimed flag was ignored; imported seed profiles remain unclaimed.");
  }

  if (normalizeNullishText(record.ownerUserId)) {
    warnings.push("Spreadsheet ownerUserId was ignored for public seed imports.");
  }

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
    isClaimed: false,
    ownerUserId: null,
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
  const merged = { ...baseRecord };

  for (const field of PROFILE_FIELDS) {
    if (field === "isClaimed") {
      merged[field] = false;
      continue;
    }

    if (field === "ownerUserId") {
      merged[field] = null;
      continue;
    }

    if (hasMeaningfulValue(nextRecord[field])) {
      merged[field] = nextRecord[field];
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(baseRecord, field)) {
      merged[field] = baseRecord[field];
    }
  }

  return merged;
}

function pushProfileIndex(map, key, profile) {
  if (!key) return;
  const bucket = map.get(key) || [];
  bucket.push(profile);
  map.set(key, bucket);
}

function buildProfileMatchIndexes(existingProfiles) {
  const indexes = {
    byId: new Map(),
    byPhone: new Map(),
    byInstagram: new Map(),
    byNameCity: new Map(),
  };

  for (const profile of existingProfiles) {
    if (profile?.id) indexes.byId.set(profile.id, profile);
    pushProfileIndex(indexes.byPhone, profile?.normalizedPhone, profile);
    pushProfileIndex(indexes.byInstagram, profile?.normalizedInstagram, profile);
    pushProfileIndex(indexes.byNameCity, profile?.normalizedNameCity, profile);
  }

  return indexes;
}

function findExistingProfileMatch(record, indexes) {
  if (record.id && indexes.byId.has(record.id)) {
    return { reason: "id", profile: indexes.byId.get(record.id) };
  }

  const checks = [
    { reason: "phone", key: normalizePhoneNumber(record.phone), map: indexes.byPhone },
    { reason: "instagram", key: normalizeInstagramKey(record.instagram), map: indexes.byInstagram },
    { reason: "name_city", key: normalizeNameCityKey(record.name, record.city), map: indexes.byNameCity },
  ];

  for (const check of checks) {
    if (!check.key) continue;
    const matches = check.map.get(check.key) || [];
    if (!matches.length) continue;
    if (matches.length > 1) {
      return {
        reason: check.reason,
        ambiguous: true,
        profiles: matches,
      };
    }

    return {
      reason: check.reason,
      profile: matches[0],
    };
  }

  return null;
}

function createPlannedCreateIndexes() {
  return {
    byPhone: new Map(),
    byInstagram: new Map(),
    byNameCity: new Map(),
  };
}

function findPlannedCreateDuplicate(record, plannedIndexes) {
  const checks = [
    { reason: "phone", key: normalizePhoneNumber(record.phone), map: plannedIndexes.byPhone },
    { reason: "instagram", key: normalizeInstagramKey(record.instagram), map: plannedIndexes.byInstagram },
    { reason: "name_city", key: normalizeNameCityKey(record.name, record.city), map: plannedIndexes.byNameCity },
  ];

  for (const check of checks) {
    if (!check.key) continue;
    if (check.map.has(check.key)) {
      return {
        reason: check.reason,
        duplicateOf: check.map.get(check.key),
      };
    }
  }

  return null;
}

function registerPlannedCreate(record, decisionId, plannedIndexes) {
  const phoneKey = normalizePhoneNumber(record.phone);
  const instagramKey = normalizeInstagramKey(record.instagram);
  const nameCityKey = normalizeNameCityKey(record.name, record.city);

  if (phoneKey) plannedIndexes.byPhone.set(phoneKey, decisionId);
  if (instagramKey) plannedIndexes.byInstagram.set(instagramKey, decisionId);
  if (nameCityKey) plannedIndexes.byNameCity.set(nameCityKey, decisionId);
}

function buildCreateData(normalized) {
  return {
    id: normalized.id,
    name: normalized.name,
    specialty: normalized.specialty,
    secondarySpecialty: normalized.secondarySpecialty,
    tertiarySpecialty: normalized.tertiarySpecialty,
    city: normalized.city,
    neighborhood: normalized.neighborhood,
    phone: normalized.phone,
    bio: normalized.bio,
    attendance: normalized.attendance,
    instagram: normalized.instagram,
    linkedin: normalized.linkedin,
    photoUrl: normalized.photoUrl,
    isClaimed: false,
    ownerUserId: null,
    ...(normalized.createdAt ? { createdAt: normalized.createdAt } : {}),
    ...(normalized.updatedAt ? { updatedAt: normalized.updatedAt } : {}),
  };
}

function buildUpdateData(normalized) {
  const data = {};

  for (const field of UPDATEABLE_PROFILE_FIELDS) {
    if (hasMeaningfulValue(normalized[field])) {
      data[field] = normalized[field];
    }
  }

  return data;
}

function buildDryRunSavedObject(existing, action, createData, updateData) {
  if (action === "create") {
    return {
      ...createData,
      plannedAction: action,
    };
  }

  return {
    ...existing,
    ...updateData,
    isClaimed: existing?.isClaimed ?? false,
    ownerUserId: existing?.ownerUserId ?? null,
    plannedAction: action,
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
  const referenceData = await loadReferenceData();

  const report = {
    filePath,
    importedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    totalRowsRead: Array.isArray(extracted.rows) ? extracted.rows.length : 0,
    totalProfilesFound: 0,
    skippedEmptyRows: 0,
    rowsToCreate: 0,
    rowsToUpdate: 0,
    importedProfiles: 0,
    updatedProfiles: 0,
    skippedClaimed: 0,
    skippedDuplicates: 0,
    skippedInvalid: 0,
    skippedProfiles: 0,
    validationErrors: [],
    urlsDetected: [],
    urlsRejected: [],
    finalSavedProfileObjects: [],
    rows: [],
    decisions: [],
  };

  const rowsById = new Map();

  for (const row of extracted.rows) {
    if (isCompletelyEmptyRow(row.cells)) {
      report.skippedEmptyRows += 1;
      continue;
    }

    report.totalProfilesFound += 1;

    const parsed = buildNormalizedRecord(row, headerMap, referenceData);
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
      matchingReason: null,
      matchedProfileId: null,
    };

    if (parsed.skipped) {
      report.skippedInvalid += 1;
      report.skippedProfiles += 1;
      rowReport.action = "skipped_invalid";
      report.validationErrors.push({
        sheet: row.sheet,
        rowNumber: row.rowNumber,
        id: parsed.normalized.id || null,
        errors: parsed.errors,
      });
      report.rows.push(rowReport);
      report.decisions.push({
        id: parsed.normalized.id || null,
        sourceRows: [row.rowNumber],
        sheet: row.sheet,
        action: "skipped_invalid",
        matchingReason: null,
        matchedProfileId: null,
        duplicateOf: null,
        warnings: parsed.warnings,
        errors: parsed.errors,
      });
      continue;
    }

    const existing = rowsById.get(parsed.normalized.id);
    if (existing) {
      existing.normalized = mergeRecords(existing.normalized, parsed.normalized);
      existing.sourceRows.push(row.rowNumber);
      existing.warnings.push(...parsed.warnings);
      rowReport.action = "merged_duplicate_id";
      rowReport.matchingReason = "id";
      rowReport.matchedProfileId = parsed.normalized.id;
      report.rows.push(rowReport);
      continue;
    }

    rowsById.set(parsed.normalized.id, {
      normalized: parsed.normalized,
      sourceRows: [row.rowNumber],
      warnings: [...parsed.warnings],
      sheet: row.sheet,
    });

    rowReport.action = "queued";
    report.rows.push(rowReport);
  }

  const existingIndexes = buildProfileMatchIndexes(referenceData.existingProfiles);
  const plannedCreateIndexes = createPlannedCreateIndexes();
  const plannedUpdateTargets = new Map();

  for (const [id, queued] of rowsById.entries()) {
    const normalized = queued.normalized;
    const existingMatch = findExistingProfileMatch(normalized, existingIndexes);

    const decision = {
      id,
      sheet: queued.sheet,
      sourceRows: queued.sourceRows,
      normalized,
      warnings: queued.warnings,
      errors: [],
      action: "pending",
      matchingReason: existingMatch?.reason || null,
      matchedProfileId: existingMatch?.profile?.id || null,
      duplicateOf: null,
    };

    if (existingMatch?.ambiguous) {
      decision.action = "skipped_duplicate";
      decision.errors.push(`Multiple existing profiles matched by ${existingMatch.reason}.`);
      decision.matchedProfileId = null;
      report.skippedDuplicates += 1;
      report.skippedProfiles += 1;
      report.decisions.push(decision);
      continue;
    }

    if (existingMatch?.profile) {
      const matchedProfile = existingMatch.profile;
      decision.matchedProfileId = matchedProfile.id;

      if (isProtectedClaimedProfile(matchedProfile)) {
        decision.action = "skipped_claimed";
        decision.errors.push("Matched existing profile is claimed/owned and was protected from overwrite.");
        report.skippedClaimed += 1;
        report.skippedProfiles += 1;
        report.decisions.push(decision);
        continue;
      }

      if (plannedUpdateTargets.has(matchedProfile.id)) {
        decision.action = "skipped_duplicate";
        decision.duplicateOf = plannedUpdateTargets.get(matchedProfile.id);
        decision.errors.push("Another spreadsheet row already targets this same existing profile.");
        report.skippedDuplicates += 1;
        report.skippedProfiles += 1;
        report.decisions.push(decision);
        continue;
      }

      const updateData = buildUpdateData(normalized);
      decision.action = "update";
      report.rowsToUpdate += 1;
      plannedUpdateTargets.set(matchedProfile.id, id);

      const saved = args.dryRun
        ? buildDryRunSavedObject(matchedProfile, "update", null, updateData)
        : await prisma.profile.update({
            where: { id: matchedProfile.id },
            data: updateData,
          });

      report.finalSavedProfileObjects.push(saved);
      if (!args.dryRun) report.updatedProfiles += 1;
      report.decisions.push(decision);
      continue;
    }

    const plannedDuplicate = findPlannedCreateDuplicate(normalized, plannedCreateIndexes);
    if (plannedDuplicate) {
      decision.action = "skipped_duplicate";
      decision.matchingReason = plannedDuplicate.reason;
      decision.duplicateOf = plannedDuplicate.duplicateOf;
      decision.errors.push("Another spreadsheet row already represents this same public seed profile.");
      report.skippedDuplicates += 1;
      report.skippedProfiles += 1;
      report.decisions.push(decision);
      continue;
    }

    const createData = buildCreateData(normalized);
    decision.action = "create";
    report.rowsToCreate += 1;
    registerPlannedCreate(normalized, id, plannedCreateIndexes);

    const saved = args.dryRun
      ? buildDryRunSavedObject(null, "create", createData, null)
      : await prisma.profile.create({ data: createData });

    report.finalSavedProfileObjects.push(saved);
    if (!args.dryRun) report.importedProfiles += 1;
    report.decisions.push(decision);
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
          dryRun: report.dryRun,
          totalRowsRead: report.totalRowsRead,
          totalProfilesFound: report.totalProfilesFound,
          skippedEmptyRows: report.skippedEmptyRows,
          rowsToCreate: report.rowsToCreate,
          rowsToUpdate: report.rowsToUpdate,
          skippedClaimed: report.skippedClaimed,
          skippedDuplicates: report.skippedDuplicates,
          skippedInvalid: report.skippedInvalid,
          skippedProfiles: report.skippedProfiles,
          importedProfiles: report.importedProfiles,
          updatedProfiles: report.updatedProfiles,
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
