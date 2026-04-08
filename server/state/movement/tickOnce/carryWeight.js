"use strict";

const { getInventory } = require("../../inventory/store");
const { ensureInventoryLoaded } = require("../../inventory/loader");
const { getEquipment } = require("../../equipment/store");
const { ensureEquipmentLoaded } = require("../../equipment/loader");
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

  const carryWeightMax = Number.isFinite(Number(invRt?.carryWeight))
    ? Number(invRt.carryWeight)
    : 20;
  let carryWeightCurrent = Number(invRt?.carryWeightCurrent);

  if (!Number.isFinite(carryWeightCurrent)) {
    const computed = computeCarryWeight(invRt, eqRt);
    carryWeightCurrent = Number(computed.current ?? 0);
    if (invRt) {
      invRt.carryWeightCurrent = carryWeightCurrent;
      invRt.carryWeightRatio = carryWeightMax > 0 ? carryWeightCurrent / carryWeightMax : 0;
      invRt.carryWeightPercent = Math.min(100, Math.max(0, invRt.carryWeightRatio * 100));
      invRt.carryWeightMax = carryWeightMax;
    }
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
