export function formatRequirementCounts(have, need) {
  return `${Math.max(0, Number(have) || 0)} / ${Math.max(0, Number(need) || 0)}`;
}

export { getRequirementCount, getRequirementLabel } from "./inventoryCounts";
