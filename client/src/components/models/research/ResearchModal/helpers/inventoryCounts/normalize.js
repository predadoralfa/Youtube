export function normalizeIdentity(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

export function canonicalItemCode(value) {
  const normalized = normalizeIdentity(value);
  if (
    normalized === "STONE" ||
    normalized === "SMALLSTONE" ||
    normalized === "SMALL_STONE" ||
    normalized === "MATERIALSTONE" ||
    normalized === "MATERIAL_STONE" ||
    normalized === "AMMO_SMALL_ROCK"
  ) {
    return "SMALL_STONE";
  }
  return normalized;
}
