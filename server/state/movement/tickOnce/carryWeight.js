"use strict";

const { getInventory } = require("../../inventory/store");
const { ensureInventoryLoaded } = require("../../inventory/loader");
const { getEquipment } = require("../../equipment/store");
const { ensureEquipmentLoaded } = require("../../equipment/loader");
const { getRuntime } = require("../../runtime/store");
const { ensureResearchLoaded } = require("../../../service/researchService");
const { computeCarryWeight } = require("../../inventory/weight");

async function resolveCarryWeightContext(userId) {
  let invRt = getInventory(userId);
  if (!invRt) {
    invRt = await ensureInventoryLoaded(userId);
  }

  let eqRt = getEquipment(userId);
  if (!eqRt) {
    eqRt = await ensureEquipmentLoaded(userId);
  }

  const runtime = getRuntime(String(userId));
  const research = runtime?.research ?? (await ensureResearchLoaded(userId, runtime ?? { userId }));
  const computed = computeCarryWeight(invRt, eqRt, research);
  const carryWeightCurrent = Number(computed.current ?? 0);
  const carryWeightMax = Number(computed.max ?? 0);

  if (invRt) {
    invRt.carryWeightCurrent = carryWeightCurrent;
    invRt.carryWeightRatio = carryWeightMax > 0 ? carryWeightCurrent / carryWeightMax : 0;
    invRt.carryWeightPercent = Math.min(100, Math.max(0, invRt.carryWeightRatio * 100));
    invRt.carryWeightMax = carryWeightMax;
  }

  return {
    current: carryWeightCurrent,
    max: carryWeightMax,
    ratio: carryWeightMax > 0 ? carryWeightCurrent / carryWeightMax : 0,
  };
}

module.exports = {
  resolveCarryWeightContext,
};
