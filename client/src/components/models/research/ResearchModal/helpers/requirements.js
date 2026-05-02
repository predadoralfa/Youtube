import { getRequirementLabel } from "./inventoryCounts";

export function formatRequirementCounts(have, need) {
  return `${Math.max(0, Number(have) || 0)} / ${Math.max(0, Number(need) || 0)}`;
}

export function formatResearchRequirementSummary(study, inventoryIndex) {
  const parts = [];
  const researchRequirements = Array.isArray(study?.levelResearchRequirements) ? study.levelResearchRequirements : [];

  if (study?.prerequisiteResearchName && researchRequirements.length === 0) {
    const level = Number(study?.prerequisiteLevel ?? 1) || 1;
    parts.push(`${study.prerequisiteResearchName} Lv.${level}`);
  }

  for (const requirement of researchRequirements) {
    const level = Math.max(1, Number(requirement?.level) || 1);
    const label = requirement?.researchName ?? requirement?.researchCode ?? "Unknown";
    parts.push(`${label} Lv.${level}`);
  }

  const costs = Array.isArray(study?.levelItemCosts) ? study.levelItemCosts : [];
  const hasInventoryIndex = Boolean(inventoryIndex?.defById && inventoryIndex?.defByCode);
  for (const cost of costs) {
    const qty = Math.max(0, Number(cost?.qty) || 0);
    if (qty <= 0) continue;
    const label = hasInventoryIndex ? getRequirementLabel(cost, inventoryIndex) : (cost?.itemCode ?? "Unknown");
    parts.push(`${qty} ${label}`);
  }

  return parts.length > 0 ? `Requires: ${parts.join(" + ")}` : null;
}

export { getRequirementCount } from "./inventoryCounts";
