"use strict";

const { ensureInventoryLoaded } = require("../../../../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../../../../state/equipment/loader");
const { computeCarryWeight } = require("../../../../state/inventory/weight");

async function resolveCarryWeightRatio(userId) {
  const invRt = await ensureInventoryLoaded(userId);
  const eqRt = await ensureEquipmentLoaded(userId);
  const current = computeCarryWeight(invRt, eqRt).current;
  const max = Number.isFinite(Number(invRt?.carryWeight)) ? Number(invRt.carryWeight) : 20;
  return max > 0 ? current / max : 0;
}

module.exports = {
  resolveCarryWeightRatio,
};
