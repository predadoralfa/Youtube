"use strict";

const db = require("../../models");
const { withInventoryLock } = require("../../state/inventory/store");
const { getRuntime } = require("../../state/runtimeStore");
const { addActor } = require("../../state/actorsRuntimeStore");
const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { buildInventoryFull } = require("../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const { flush } = require("../../state/inventory/persist/flush");
const { dropInventoryItemToGround } = require("../../service/inventoryDropService");
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

function logInv(level, message, data) {
  const logger = level === "warn" ? console.warn : level === "error" ? console.error : console.log;
  logger(`[INV] ${message}`, data || {});
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

  function emitFullAndAck(invRt, eqRt, ack) {
    const full = buildInventoryFull(invRt, eqRt);
    socket.emit("inv:full", full);
    safeAck(ack, { ok: true, inventory: full });
  }

  socket.on("inv:request_full", (intent = {}, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    logInv("log", "event=inv:request_full received", {
      userId,
      socketId: socket.id,
      intent: summarizeIntent(intent),
    });

    withInventoryLock(userId, async () => {
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        emitFullAndAck(invRt, eqRt, ack);

        logInv("log", "event=inv:request_full ok", {
          userId,
          containers: invRt?.containers?.length ?? 0,
          items: invRt?.itemInstanceById?.size ?? 0,
          heldState: summarizeHeldState(invRt?.heldState),
        });
      } catch (e) {
        logInv("error", "event=inv:request_full failed", {
          userId,
          code: e.code || "INV_ERR",
          message: e.message,
        });
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

    logInv("log", "event=inv:move received", {
      userId,
      socketId: socket.id,
      intent: summarizeIntent(intent),
    });

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = move(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        emitFullAndAck(invRt, eqRt, ack);
        logInv("log", "event=inv:move ok", {
          userId,
          intent: summarizeIntent(intent),
          touchedContainers: result?.touchedContainers ?? [],
          touchedSlots: result?.touchedSlots?.length ?? 0,
        });
      } catch (e) {
        await tx.rollback().catch(() => {});
        logInv("warn", "event=inv:move failed", {
          userId,
          intent: summarizeIntent(intent),
          code: e.code || "INV_ERR",
          message: e.message,
        });
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:split", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    logInv("log", "event=inv:split received", {
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

        emitFullAndAck(invRt, eqRt, ack);
        logInv("log", "event=inv:split ok", {
          userId,
          intent: summarizeIntent(intent),
          heldState: summarizeHeldState(result?.heldState),
          newItemInstanceId: result?.newItemInstanceId ?? null,
        });
      } catch (e) {
        await tx.rollback().catch(() => {});
        logInv("warn", "event=inv:split failed", {
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

    logInv("log", "event=inv:merge received", {
      userId,
      socketId: socket.id,
      intent: summarizeIntent(intent),
    });

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = merge(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        emitFullAndAck(invRt, eqRt, ack);
        logInv("log", "event=inv:merge ok", {
          userId,
          intent: summarizeIntent(intent),
          touchedContainers: result?.touchedContainers ?? [],
          touchedSlots: result?.touchedSlots?.length ?? 0,
        });
      } catch (e) {
        await tx.rollback().catch(() => {});
        logInv("warn", "event=inv:merge failed", {
          userId,
          intent: summarizeIntent(intent),
          code: e.code || "INV_ERR",
          message: e.message,
        });
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:pickup", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    logInv("log", "event=inv:pickup received", {
      userId,
      socketId: socket.id,
      intent: summarizeIntent(intent),
    });

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = await pickupInventoryItem(invRt, intent, tx);

        await tx.commit();

        emitFullAndAck(invRt, eqRt, ack);
        logInv("log", "event=inv:pickup ok", {
          userId,
          intent: summarizeIntent(intent),
          heldState: summarizeHeldState(result?.heldState),
          touchedContainers: result?.touchedContainers ?? [],
        });
      } catch (e) {
        await tx.rollback().catch(() => {});
        logInv("warn", "event=inv:pickup failed", {
          userId,
          intent: summarizeIntent(intent),
          code: e.code || "INV_ERR",
          message: e.message,
        });
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:place", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    logInv("log", "event=inv:place received", {
      userId,
      socketId: socket.id,
      intent: summarizeIntent(intent),
    });

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = await placeInventoryItem(invRt, intent, tx);

        await tx.commit();

        emitFullAndAck(invRt, eqRt, ack);
        logInv("log", "event=inv:place ok", {
          userId,
          intent: summarizeIntent(intent),
          heldState: summarizeHeldState(result?.heldState),
          touchedContainers: result?.touchedContainers ?? [],
        });
      } catch (e) {
        await tx.rollback().catch(() => {});
        logInv("warn", "event=inv:place failed", {
          userId,
          intent: summarizeIntent(intent),
          code: e.code || "INV_ERR",
          message: e.message,
        });
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:cancel", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    logInv("log", "event=inv:cancel received", {
      userId,
      socketId: socket.id,
      intent: summarizeIntent(intent),
    });

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = await cancelInventoryHeldState(invRt, tx);

        await tx.commit();

        emitFullAndAck(invRt, eqRt, ack);
        logInv("log", "event=inv:cancel ok", {
          userId,
          heldState: summarizeHeldState(invRt?.heldState),
          touchedContainers: result?.touchedContainers ?? [],
        });
      } catch (e) {
        await tx.rollback().catch(() => {});
        logInv("warn", "event=inv:cancel failed", {
          userId,
          code: e.code || "INV_ERR",
          message: e.message,
        });
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:drop", (intent, ack) => {
    const userId = resolveUserOrAck(ack);
    if (!userId) return;

    logInv("log", "event=inv:drop received", {
      userId,
      socketId: socket.id,
      intent: summarizeIntent(intent),
    });

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);
        const runtime = getRuntime(userId);

        console.log("[DROP] inv:drop received", {
          userId,
          socketId: socket.id,
          itemInstanceId: intent?.itemInstanceId ?? null,
          hasRuntime: !!runtime,
          hasInventory: !!invRt,
          hasEquipment: !!eqRt,
        });

        const result = await dropInventoryItemToGround(userId, intent?.itemInstanceId, {
          runtime,
          invRt,
          eqRt,
          transaction: tx,
        });

        if (!result?.ok) {
          logInv("warn", "event=inv:drop rejected", {
            userId,
            intent: summarizeIntent(intent),
            code: result?.code || "INV_ERR",
            message: result?.message || "Drop failed",
          });
          await tx.rollback().catch(() => {});
          safeAck(ack, { ok: false, code: result?.code || "INV_ERR", message: result?.message || "Drop failed" });
          return;
        }

        logInv("log", "event=inv:drop prepared", {
          userId,
          intent: summarizeIntent(intent),
          actorId: result?.actor?.id ?? null,
          actorType: result?.actor?.actorType ?? null,
          containerId: result?.actor?.containers?.[0]?.containerId ?? null,
          qty: result?.droppedItem?.qty ?? null,
          pos: result?.actor?.pos ?? null,
        });

        const full = buildInventoryFull(invRt, eqRt);
        await tx.commit();
        logInv("log", "event=inv:drop committed", { userId, intent: summarizeIntent(intent) });

        const actor = result.actor ?? null;
        if (actor) {
          logInv("log", "event=inv:drop emitting world:object_spawn", {
            userId,
            actorId: actor.id,
            actorType: actor.actorType,
          });
          addActor(actor);
          socket.emit("world:object_spawn", {
            objectKind: "ACTOR",
            actor,
          });
        }

        socket.emit("inv:full", full);
        safeAck(ack, { ok: true, inventory: full, actor });
      } catch (e) {
        console.error("[DROP] inv:drop error", {
          userId: socket.data.userId ?? null,
          itemInstanceId: intent?.itemInstanceId ?? null,
          message: e?.message ?? String(e),
          code: e?.code ?? null,
        });
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });
}

module.exports = { registerInventoryHandler };
