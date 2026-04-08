"use strict";

const { clearEquipment } = require("../../state/equipment/store");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const { buildEquipmentFull } = require("../../state/equipment/fullPayload");

async function rebuildEquipmentPayload(playerId) {
  clearEquipment(playerId);
  const eqRt = await ensureEquipmentLoaded(playerId);
  return {
    ok: true,
    equipment: buildEquipmentFull(eqRt),
  };
}

module.exports = {
  rebuildEquipmentPayload,
};
