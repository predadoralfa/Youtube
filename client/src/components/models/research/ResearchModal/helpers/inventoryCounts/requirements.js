import { canonicalItemCode, normalizeIdentity } from "./normalize";

export function getRequirementLabel(cost, inventoryIndex) {
  if (!cost) return "Unknown";
  if (cost.itemDefId != null) {
    const def = inventoryIndex.defById.get(String(cost.itemDefId)) ?? null;
    if (def?.name) return def.name;
  }
  if (cost.itemCode != null) {
    const code = String(cost.itemCode).toUpperCase();
    const def = inventoryIndex.defByCode.get(code) ?? null;
    if (def?.name) return def.name;
    return code;
  }
  return "Unknown";
}

export function getRequirementCount(cost, inventoryIndex) {
  if (!cost) return 0;
  if (cost.itemDefId != null) {
    const count = inventoryIndex.countsByDefId.get(String(cost.itemDefId));
    if (Number.isFinite(count)) return Number(count);
  }
  if (cost.itemCode != null) {
    const count = inventoryIndex.countsByCode.get(canonicalItemCode(cost.itemCode));
    if (Number.isFinite(count)) return Number(count);
  }
  if (cost.itemCode != null) {
    const countByName = inventoryIndex.countsByName.get(normalizeIdentity(canonicalItemCode(cost.itemCode)));
    if (Number.isFinite(countByName)) return Number(countByName);
  }
  return 0;
}
