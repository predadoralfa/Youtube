"use strict";

const db = require("../../../models");
const { flush } = require("../../../state/inventory/persist/flush");
const { move } = require("../../../state/inventory/ops/move");
const { ensureInventoryLoaded } = require("../../../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../../../state/equipment/loader");
const { buildInventoryFull } = require("../../../state/inventory/fullPayload");
const { buildEquipmentFull } = require("../../../state/equipment/fullPayload");
const {
  equipItemToSlot,
  swapEquipmentSlots,
  unequipItemFromSlot,
} = require("../../../service/equipmentService");
const { emitEquipmentAndInventory } = require("./refresh");
const { safeAck, logEquip, findOccupiedSlotIndex } = require("./shared");

function requireUser(socket) {
  const userId = socket.data.userId;
  if (!userId) throw new Error("Socket not authenticated");
  return userId;
}

function registerEquipmentEvents(socket) {
  socket.on("equipment:equip", async (intent = {}, ack) => {
    try {
      const userId = requireUser(socket);
      const result = await equipItemToSlot(userId, intent?.itemInstanceId, intent?.slotCode);
      if (result?.ok !== true) {
        safeAck(ack, result);
        return;
      }

      await emitEquipmentAndInventory(socket, userId, result.equipment);
      safeAck(ack, { ok: true, equipment: result.equipment });
    } catch (error) {
      logEquip("error", "event=equipment:equip exception", {
        code: error.code || "EQUIP_ERR",
        message: error.message,
      });
      safeAck(ack, {
        ok: false,
        code: error.code || "EQUIP_ERR",
        message: error.message,
      });
    }
  });

  socket.on("equipment:unequip", async (intent = {}, ack) => {
    try {
      const userId = requireUser(socket);
      const result = await unequipItemFromSlot(userId, intent?.slotCode);
      if (result?.ok !== true) {
        safeAck(ack, result);
        return;
      }

      await emitEquipmentAndInventory(socket, userId, result.equipment);
      safeAck(ack, { ok: true, equipment: result.equipment });
    } catch (error) {
      safeAck(ack, {
        ok: false,
        code: error.code || "UNEQUIP_ERR",
        message: error.message,
      });
    }
  });

  socket.on("equipment:swap", async (intent = {}, ack) => {
    try {
      const userId = requireUser(socket);
      const result = await swapEquipmentSlots(userId, intent?.fromSlotCode, intent?.toSlotCode);

      if (result?.ok !== true && result?.code === "SOURCE_SLOT_EMPTY") {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);
        const fromContainer = invRt?.containersByRole?.get?.(String(intent?.fromSlotCode)) ?? null;
        const toContainer = invRt?.containersByRole?.get?.(String(intent?.toSlotCode)) ?? null;

        if (!fromContainer || !toContainer) {
          safeAck(ack, result);
          return;
        }

        const fromSlotIndex = findOccupiedSlotIndex(fromContainer);
        const toSlotIndex = findOccupiedSlotIndex(toContainer);
        if (fromSlotIndex == null) {
          safeAck(ack, result);
          return;
        }

        const tx = await db.sequelize.transaction();
        try {
          const moveResult = move(invRt, {
            from: { role: String(intent?.fromSlotCode), slot: fromSlotIndex },
            to: {
              role: String(intent?.toSlotCode),
              slot: toSlotIndex == null ? 0 : toSlotIndex,
            },
            qty: 1,
          });

          await flush(invRt, moveResult, tx);
          await tx.commit();

          const updatedInventory = buildInventoryFull(invRt, eqRt);
          const updatedEquipment = buildEquipmentFull(eqRt, invRt);
          socket.emit("inv:full", updatedInventory);
          socket.emit("equipment:full", updatedEquipment);
          safeAck(ack, { ok: true, equipment: updatedEquipment });
          return;
        } catch (legacyError) {
          await tx.rollback().catch(() => {});
          safeAck(ack, {
            ok: false,
            code: legacyError.code || result?.code || "EQUIP_SWAP_ERR",
            message: legacyError.message || result?.message || "EQUIP_SWAP_ERR",
          });
          return;
        }
      }

      if (result?.ok !== true) {
        safeAck(ack, result);
        return;
      }

      await emitEquipmentAndInventory(socket, userId, result.equipment);
      safeAck(ack, { ok: true, equipment: result.equipment });
    } catch (error) {
      safeAck(ack, {
        ok: false,
        code: error.code || "EQUIP_SWAP_ERR",
        message: error.message,
      });
    }
  });
}

module.exports = {
  registerEquipmentEvents,
};
