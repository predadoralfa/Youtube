"use strict";

const { ensureInventoryLoaded } = require("../../../state/inventory/loader");
const { buildInventoryFull } = require("../../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../../state/equipment/loader");

async function emitEquipmentAndInventory(socket, userId, equipment) {
  const eqRt = await ensureEquipmentLoaded(userId);
  const invRt = await ensureInventoryLoaded(userId);
  const inventory = buildInventoryFull(invRt, eqRt);

  socket.emit("equipment:full", equipment);
  socket.emit("inv:full", inventory);

  return { eqRt, invRt, inventory };
}

module.exports = {
  emitEquipmentAndInventory,
};
