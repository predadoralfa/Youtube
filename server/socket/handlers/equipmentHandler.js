"use strict";

const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { buildInventoryFull } = require("../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const { flush } = require("../../state/inventory/persist/flush");
const { move } = require("../../state/inventory/ops/move");
const { equipItemToSlot, swapEquipmentSlots, unequipItemFromSlot } = require("../../service/equipmentService");

function safeAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function logEquip(level, message, data) {
  const logger = level === "warn" ? console.warn : level === "error" ? console.error : console.log;
  logger(`[EQUIP] ${message}`, data || {});
}

function findOccupiedSlotIndex(container) {
  const slots = Array.isArray(container?.slots) ? container.slots : [];
  const idx = slots.findIndex((slot) => slot?.itemInstanceId != null);
  return idx >= 0 ? idx : null;
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
      logEquip("log", "event=equipment:equip received", {
        userId,
        socketId: socket.id,
        intent: {
          itemInstanceId: intent?.itemInstanceId ?? null,
          slotCode: intent?.slotCode ?? null,
        },
      });
      const result = await equipItemToSlot(userId, intent?.itemInstanceId, intent?.slotCode);

      if (result?.ok !== true) {
        logEquip("warn", "event=equipment:equip failed", {
          userId,
          code: result?.code || "EQUIP_ERR",
          message: result?.message || "EQUIP_ERR",
        });
        safeAck(ack, result);
        return;
      }

      const eqRt = await ensureEquipmentLoaded(userId);
      const invRt = await ensureInventoryLoaded(userId);
      const inventory = buildInventoryFull(invRt, eqRt);

      socket.emit("equipment:full", result.equipment);
      socket.emit("inv:full", inventory);
      safeAck(ack, { ok: true, equipment: result.equipment });
      logEquip("log", "event=equipment:equip ok", {
        userId,
        slotCode: intent?.slotCode ?? null,
        itemInstanceId: intent?.itemInstanceId ?? null,
      });
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
      const userId = requireUser();
      logEquip("log", "event=equipment:unequip received", {
        userId,
        socketId: socket.id,
        intent: {
          slotCode: intent?.slotCode ?? null,
        },
      });
      const result = await unequipItemFromSlot(userId, intent?.slotCode);

      if (result?.ok !== true) {
        logEquip("warn", "event=equipment:unequip failed", {
          userId,
          code: result?.code || "UNEQUIP_ERR",
          message: result?.message || "UNEQUIP_ERR",
        });
        safeAck(ack, result);
        return;
      }

      const eqRt = await ensureEquipmentLoaded(userId);
      const invRt = await ensureInventoryLoaded(userId);
      const inventory = buildInventoryFull(invRt, eqRt);

      socket.emit("equipment:full", result.equipment);
      socket.emit("inv:full", inventory);
      safeAck(ack, { ok: true, equipment: result.equipment });
      logEquip("log", "event=equipment:unequip ok", {
        userId,
        slotCode: intent?.slotCode ?? null,
      });
    } catch (error) {
      logEquip("error", "event=equipment:unequip exception", {
        code: error.code || "UNEQUIP_ERR",
        message: error.message,
      });
      safeAck(ack, {
        ok: false,
        code: error.code || "UNEQUIP_ERR",
        message: error.message,
      });
    }
  });

  socket.on("equipment:swap", async (intent = {}, ack) => {
    try {
      const userId = requireUser();
      logEquip("log", "event=equipment:swap received", {
        userId,
        socketId: socket.id,
        intent: {
          fromSlotCode: intent?.fromSlotCode ?? null,
          toSlotCode: intent?.toSlotCode ?? null,
        },
      });
      const result = await swapEquipmentSlots(userId, intent?.fromSlotCode, intent?.toSlotCode);

      if (result?.ok !== true) {
        if (result?.code !== "SOURCE_SLOT_EMPTY") {
          logEquip("warn", "event=equipment:swap failed", {
            userId,
            code: result?.code || "EQUIP_SWAP_ERR",
            message: result?.message || "EQUIP_SWAP_ERR",
          });
          safeAck(ack, result);
          return;
        }

        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);
        const fromContainer = invRt?.containersByRole?.get?.(String(intent?.fromSlotCode)) ?? null;
        const toContainer = invRt?.containersByRole?.get?.(String(intent?.toSlotCode)) ?? null;

        if (!fromContainer || !toContainer) {
          logEquip("warn", "event=equipment:swap legacy-fallback-missing-container", {
            userId,
            fromSlotCode: intent?.fromSlotCode ?? null,
            toSlotCode: intent?.toSlotCode ?? null,
          });
          safeAck(ack, result);
          return;
        }

        const fromSlotIndex = findOccupiedSlotIndex(fromContainer);
        const toSlotIndex = findOccupiedSlotIndex(toContainer);

        if (fromSlotIndex == null) {
          logEquip("warn", "event=equipment:swap legacy-fallback-empty-source", {
            userId,
            fromSlotCode: intent?.fromSlotCode ?? null,
            toSlotCode: intent?.toSlotCode ?? null,
          });
          safeAck(ack, result);
          return;
        }

        const tx = await db.sequelize.transaction();
        try {
          const moveResult = move(invRt, {
            from: {
              role: String(intent?.fromSlotCode),
              slot: fromSlotIndex,
            },
            to: {
              role: String(intent?.toSlotCode),
              slot: toSlotIndex == null ? 0 : toSlotIndex,
            },
            qty: 1,
          });

          await flush(invRt, moveResult, tx);
          await tx.commit();

          const updatedInventory = buildInventoryFull(invRt, eqRt);
          const updatedEquipment = require("../../state/equipment/fullPayload").buildEquipmentFull(eqRt, invRt);

          socket.emit("inv:full", updatedInventory);
          socket.emit("equipment:full", updatedEquipment);
          safeAck(ack, { ok: true, equipment: updatedEquipment });
          logEquip("log", "event=equipment:swap legacy-fallback-ok", {
            userId,
            fromSlotCode: intent?.fromSlotCode ?? null,
            toSlotCode: intent?.toSlotCode ?? null,
            fromSlotIndex,
            toSlotIndex: toSlotIndex == null ? 0 : toSlotIndex,
          });
          return;
        } catch (legacyError) {
          await tx.rollback().catch(() => {});
          logEquip("warn", "event=equipment:swap legacy-fallback-failed", {
            userId,
            code: legacyError.code || "INV_ERR",
            message: legacyError.message,
          });
          safeAck(ack, {
            ok: false,
            code: legacyError.code || result?.code || "EQUIP_SWAP_ERR",
            message: legacyError.message || result?.message || "EQUIP_SWAP_ERR",
          });
          return;
        }
      }

      const eqRt = await ensureEquipmentLoaded(userId);
      const invRt = await ensureInventoryLoaded(userId);
      const inventory = buildInventoryFull(invRt, eqRt);

      socket.emit("equipment:full", result.equipment);
      socket.emit("inv:full", inventory);
      safeAck(ack, { ok: true, equipment: result.equipment });
      logEquip("log", "event=equipment:swap ok", {
        userId,
        fromSlotCode: intent?.fromSlotCode ?? null,
        toSlotCode: intent?.toSlotCode ?? null,
      });
    } catch (error) {
      logEquip("error", "event=equipment:swap exception", {
        code: error.code || "EQUIP_SWAP_ERR",
        message: error.message,
      });
      safeAck(ack, {
        ok: false,
        code: error.code || "EQUIP_SWAP_ERR",
        message: error.message,
      });
    }
  });
}

module.exports = { registerEquipmentHandler };
