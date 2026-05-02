import { canonicalItemCode, normalizeIdentity } from "./normalize";

export function getRequirementLabel(cost, inventoryIndex) {
  if (!cost) return "Unknown";
  const index = inventoryIndex ?? {};
  if (cost.itemDefId != null) {
    const def = index.defById?.get(String(cost.itemDefId)) ?? null;
    if (def?.name) return def.name;
  }
  if (cost.itemCode != null) {
    const code = String(cost.itemCode).toUpperCase();
    const def = index.defByCode?.get(code) ?? null;
    if (def?.name) return def.name;
    return code;
  }
  return "Unknown";
}

export function getRequirementCount(cost, inventoryIndex) {
  if (!cost) return 0;
  const index = inventoryIndex ?? {};
  if (cost.itemDefId != null) {
    const count = index.countsByDefId?.get(String(cost.itemDefId));
    if (Number.isFinite(count)) return Number(count);
  }
  if (cost.itemCode != null) {
    const count = index.countsByCode?.get(canonicalItemCode(cost.itemCode));
    if (Number.isFinite(count)) return Number(count);
  }
  if (cost.itemCode != null) {
    const countByName = index.countsByName?.get(normalizeIdentity(canonicalItemCode(cost.itemCode)));
    if (Number.isFinite(countByName)) return Number(countByName);
  }
  return 0;
}
