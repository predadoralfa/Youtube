"use strict";

const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { buildInventoryFull } = require("../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const { equipItemToSlot, unequipItemFromSlot } = require("../../service/equipmentService");

function safeAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function registerEquipmentHandler(io, socket) {
  function requireUser() {
    const userId = socket.data.userId;
    if (!userId) throw new Error("Socket not authenticated");
    return userId;
  }

  socket.on("equipment:equip", async (intent = {}, ack) => {
    try {
      const userId = requireUser();
      const result = await equipItemToSlot(userId, intent?.itemInstanceId, intent?.slotCode);

      if (result?.ok !== true) {
        safeAck(ack, result);
        return;
      }

      const eqRt = await ensureEquipmentLoaded(userId);
      const invRt = await ensureInventoryLoaded(userId);
      const inventory = buildInventoryFull(invRt, eqRt);

      socket.emit("equipment:full", result.equipment);
      socket.emit("inv:full", inventory);
      safeAck(ack, { ok: true, equipment: result.equipment });
    } catch (error) {
      safeAck(ack, {
        ok: false,
        code: error.code || "EQUIP_ERR",
        message: error.message,
      });
    }
  });

  socket.on("equipment:unequip", async (intent = {}, ack) => {
    try {
      const userId = requireUser();
      const result = await unequipItemFromSlot(userId, intent?.slotCode);

      if (result?.ok !== true) {
        safeAck(ack, result);
        return;
      }

      const eqRt = await ensureEquipmentLoaded(userId);
      const invRt = await ensureInventoryLoaded(userId);
      const inventory = buildInventoryFull(invRt, eqRt);

      socket.emit("equipment:full", result.equipment);
      socket.emit("inv:full", inventory);
      safeAck(ack, { ok: true, equipment: result.equipment });
    } catch (error) {
      safeAck(ack, {
        ok: false,
        code: error.code || "UNEQUIP_ERR",
        message: error.message,
      });
    }
  });
}

module.exports = { registerEquipmentHandler };
