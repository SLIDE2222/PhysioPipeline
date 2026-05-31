export const ACCOUNT_TYPES = Object.freeze({
  PHYSIO: "physio",
  CLINIC: "clinic",
});

export const ACCOUNT_TYPE_VALUES = Object.freeze(Object.values(ACCOUNT_TYPES));

// Account type is the top-level switch that decides which private dashboard
// and editable data model the authenticated user should use.
export function normalizeAccountType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ACCOUNT_TYPE_VALUES.includes(normalized)
    ? normalized
    : ACCOUNT_TYPES.PHYSIO;
}

export function isValidAccountType(value) {
  return ACCOUNT_TYPE_VALUES.includes(String(value || "").trim().toLowerCase());
}
