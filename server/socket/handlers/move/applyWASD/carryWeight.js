"use strict";

const { ensureInventoryLoaded } = require("../../../../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../../../../state/equipment/loader");
const { getRuntime } = require("../../../../state/runtime/store");
const { ensureResearchLoaded } = require("../../../../service/researchService");
const { computeCarryWeight } = require("../../../../state/inventory/weight");

async function resolveCarryWeightRatio(userId) {
  const invRt = await ensureInventoryLoaded(userId);
  const eqRt = await ensureEquipmentLoaded(userId);
  const runtime = getRuntime(String(userId));
  const research = runtime?.research ?? (await ensureResearchLoaded(userId, runtime ?? { userId }));
  const computed = computeCarryWeight(invRt, eqRt, research);
  const current = computed.current;
  const max = computed.max;
  return max > 0 ? current / max : 0;
}

module.exports = {
  resolveCarryWeightRatio,
};
