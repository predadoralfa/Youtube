"use strict";

const { clearEquipment } = require("../../state/equipment/store");
const { clearInventory } = require("../../state/inventory/store");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { buildEquipmentFull } = require("../../state/equipment/fullPayload");

async function rebuildEquipmentPayload(playerId) {
  clearEquipment(playerId);
  clearInventory(playerId);
  const eqRt = await ensureEquipmentLoaded(playerId);
  const invRt = await ensureInventoryLoaded(playerId);
  return {
    ok: true,
    equipment: buildEquipmentFull(eqRt, invRt),
  };
}

module.exports = {
  rebuildEquipmentPayload,
};
