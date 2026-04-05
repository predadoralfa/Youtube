"use strict";

const db = require("../../models");
const { withInventoryLock } = require("../../state/inventory/store");
const { getRuntime } = require("../../state/runtimeStore");
const { addActor } = require("../../state/actorsRuntimeStore");
const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { buildInventoryFull } = require("../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const { flush } = require("../../state/inventory/persist/flush");
const { loadCarryWeightStats } = require("../../state/inventory/weight");
const { dropInventoryItemToGround } = require("../../service/inventoryDropService");
const { buildAutoFoodPayload, setAutoFoodConfig } = require("../../service/autoFoodService");
const {
  pickup: pickupInventoryItem,
  place: placeInventoryItem,
  split: splitInventoryItem,
  cancel: cancelInventoryHeldState,
} = require("../../state/inventory/authoritative");

const { move } = require("../../state/inventory/ops/move");
const { merge } = require("../../state/inventory/ops/merge");

function safeAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function summarizeHeldState(heldState) {
  if (!heldState) return null;
  return {
    mode: heldState.mode ?? null,
    sourceContainerId: heldState.sourceContainerId ?? null,
    sourceSlotIndex: heldState.sourceSlotIndex ?? null,
    itemInstanceId: heldState.itemInstanceId ?? null,
    itemDefId: heldState.itemDefId ?? null,
    qty: heldState.qty ?? null,
  };
}

function summarizeIntent(intent) {
  if (!intent || typeof intent !== "object") return null;
  return {
    containerId: intent.containerId ?? intent?.from?.containerId ?? intent?.to?.containerId ?? null,
    slotIndex: intent.slotIndex ?? intent?.from?.slotIndex ?? intent?.to?.slotIndex ?? null,
    qty: intent.qty ?? null,
    itemInstanceId: intent.itemInstanceId ?? null,
    fromSlotCode: intent.fromSlotCode ?? null,
    toSlotCode: intent.toSlotCode ?? null,
  };
}

function registerInventoryHandler(io, socket) {
  function requireUser() {
    const userId = socket.data.userId;
    if (!userId) throw new Error("Socket not authenticated");
    return userId;
  }

  function resolveUserOrAck(ack) {
    try {
      return requireUser();
    } catch (e) {
      safeAck(ack, {
        ok: false,
        code: "NOT_AUTHENTICATED",
        message: e.message,
      });
      return null;
    }
  }

  async function emitFullAndAck(invRt, eqRt, ack) {
    try {
      invRt.carryWeight = await loadCarryWeightStats(invRt.userId);
    } catch (loadErr) {
      console.warn("[INV][WEIGHT] load failed", {
        userId: invRt?.userId ?? null,
        error: String(loadErr?.message || loadErr),
      });
    }

    const full = buildInventoryFull(invRt, eqRt);
    const rt = getRuntime(invRt.userId);
    if (rt) {
      full.macro = {
        autoFood: buildAutoFoodPayload(rt),
      };
    }
    socket.emit("inv:full", full);
    safeAck(ack, { ok: true, inventory: full });
  }

  socket.on("inv:request_full", (intent = {}, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        await emitFullAndAck(invRt, eqRt, ack);
      } catch (e) {
        safeAck(ack, {
          ok: false,
          code: e.code || "INV_ERR",
          message: e.message,
          meta: e.meta,
        });
      }
    });
  });

  socket.on("inv:move", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = move(invRt, intent);
        await flush(invRt, result, tx, eqRt);

        await tx.commit();

        await emitFullAndAck(invRt, eqRt, ack);
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:split", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    console.log("[INV][SPLIT] received", {
      userId,
      socketId: socket.id,
      intent: summarizeIntent(intent),
    });

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = await splitInventoryItem(invRt, intent, tx);

        await tx.commit();

        await emitFullAndAck(invRt, eqRt, ack);
        console.log("[INV][SPLIT] ok", {
          userId,
          intent: summarizeIntent(intent),
          heldState: summarizeHeldState(result?.heldState),
          newItemInstanceId: result?.newItemInstanceId ?? null,
        });
      } catch (e) {
        await tx.rollback().catch(() => {});
        console.log("[INV][SPLIT] failed", {
          userId,
          intent: summarizeIntent(intent),
          code: e.code || "INV_ERR",
          message: e.message,
        });
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:merge", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = merge(invRt, intent);
        await flush(invRt, result, tx, eqRt);

        await tx.commit();

        await emitFullAndAck(invRt, eqRt, ack);
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:pickup", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = await pickupInventoryItem(invRt, intent, tx);

        await tx.commit();

        await emitFullAndAck(invRt, eqRt, ack);
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:place", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = await placeInventoryItem(invRt, intent, tx);

        await tx.commit();

        await emitFullAndAck(invRt, eqRt, ack);
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:cancel", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = await cancelInventoryHeldState(invRt, tx);

        await tx.commit();

        await emitFullAndAck(invRt, eqRt, ack);
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:drop", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);
        const runtime = getRuntime(userId);

        const result = await dropInventoryItemToGround(userId, intent?.itemInstanceId, {
          runtime,
          invRt,
          eqRt,
          transaction: tx,
        });

        if (!result?.ok) {
          await tx.rollback().catch(() => {});
          safeAck(ack, { ok: false, code: result?.code || "INV_ERR", message: result?.message || "Drop failed" });
          return;
        }

        const full = buildInventoryFull(invRt, eqRt);
        await tx.commit();

        const actor = result.actor ?? null;
        if (actor) {
          addActor(actor);
          socket.emit("world:object_spawn", {
            objectKind: "ACTOR",
            actor,
          });
        }

        socket.emit("inv:full", full);
        safeAck(ack, { ok: true, inventory: full, actor });
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:auto_food:set", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;
    console.log("[AUTO_FOOD][SOCKET] received", {
      userId,
      socketId: socket.id,
      intent: {
        itemInstanceId: intent?.itemInstanceId ?? null,
        hungerThreshold: intent?.hungerThreshold ?? null,
      },
    });

    withInventoryLock(userId, async () => {
      try {
        const rt = getRuntime(userId);
        if (!rt) {
          console.log("[AUTO_FOOD][SOCKET] runtime missing", {
            userId,
            socketId: socket.id,
          });
          safeAck(ack, {
            ok: false,
            code: "RUNTIME_NOT_LOADED",
            message: "Runtime not loaded",
          });
          return;
        }

        const result = await setAutoFoodConfig(userId, rt, intent ?? {});
        if (result?.ok !== true) {
          console.log("[AUTO_FOOD][SOCKET] rejected", {
            userId,
            code: result?.code ?? "AUTO_FOOD_ERR",
            message: result?.message ?? null,
          });
          safeAck(ack, result);
          return;
        }

        console.log("[AUTO_FOOD][SOCKET] applied", {
          userId,
          macro: result?.inventory?.macro?.autoFood ?? null,
        });
        socket.emit("inv:full", result.inventory);
        safeAck(ack, result);
      } catch (e) {
        console.log("[AUTO_FOOD][SOCKET] failed", {
          userId,
          code: e.code || "AUTO_FOOD_ERR",
          message: e.message || "AUTO_FOOD_ERR",
        });
        safeAck(ack, {
          ok: false,
          code: e.code || "AUTO_FOOD_ERR",
          message: e.message || "AUTO_FOOD_ERR",
        });
      }
    });
  });
}

module.exports = { registerInventoryHandler };
