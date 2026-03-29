// server/socket/handlers/inventoryHandler.js
const db = require("../../models");
const { withInventoryLock, clearInventory } = require("../../state/inventory/store");
const { clearEquipment } = require("../../state/equipment/store");
const { getRuntime } = require("../../state/runtimeStore");
const { addActor } = require("../../state/actorsRuntimeStore");
const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { buildInventoryFull } = require("../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const { flush } = require("../../state/inventory/persist/flush");
const { dropInventoryItemToGround } = require("../../service/inventoryDropService");

const { move } = require("../../state/inventory/ops/move");
const { split } = require("../../state/inventory/ops/split");
const { merge } = require("../../state/inventory/ops/merge");

function safeAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function registerInventoryHandler(io, socket) {
  function requireUser() {
    const userId = socket.data.userId;
    if (!userId) throw new Error("Socket not authenticated");
    return userId;
  }

  socket.on("inv:request_full", (intent = {}, ack) => {
    withInventoryLock(requireUser(), async () => {
      try {
        const userId = requireUser();

        // ✅ força recarregar do DB (evita runtime velho após migrações/refactors)
        clearInventory(userId);
        clearEquipment(userId);

        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);
        const full = buildInventoryFull(invRt, eqRt);

        socket.emit("inv:full", full);
        safeAck(ack, { ok: true });

        console.log(
          "[INV] intent=inv:request_full user=",
          userId,
          "containers=",
          full?.containers?.length,
          "items=",
          full?.itemInstances?.length
        );
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
    withInventoryLock(requireUser(), async () => {
      const tx = await db.sequelize.transaction();
      try {
        const userId = requireUser();
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = move(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        const full = buildInventoryFull(invRt, eqRt);
        socket.emit("inv:full", full);
        safeAck(ack, { ok: true });
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:split", (intent, ack) => {
    withInventoryLock(requireUser(), async () => {
      const tx = await db.sequelize.transaction();
      try {
        const userId = requireUser();
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = split(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        const full = buildInventoryFull(invRt, eqRt);
        socket.emit("inv:full", full);
        safeAck(ack, { ok: true });
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:merge", (intent, ack) => {
    withInventoryLock(requireUser(), async () => {
      const tx = await db.sequelize.transaction();
      try {
        const userId = requireUser();
        const invRt = await ensureInventoryLoaded(userId);
        const eqRt = await ensureEquipmentLoaded(userId);

        const result = merge(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        const full = buildInventoryFull(invRt, eqRt);
        socket.emit("inv:full", full);
        safeAck(ack, { ok: true });
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });

  socket.on("inv:drop", (intent, ack) => {
    withInventoryLock(requireUser(), async () => {
      const tx = await db.sequelize.transaction();
      try {
        const userId = requireUser();
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
          console.warn("[DROP] inv:drop rejected", {
            userId,
            itemInstanceId: intent?.itemInstanceId ?? null,
            code: result?.code || "INV_ERR",
            message: result?.message || "Drop failed",
          });
          await tx.rollback().catch(() => {});
          safeAck(ack, { ok: false, code: result?.code || "INV_ERR", message: result?.message || "Drop failed" });
          return;
        }

        console.log("[DROP] inv:drop prepared", {
          userId,
          itemInstanceId: intent?.itemInstanceId ?? null,
          actorId: result?.actor?.id ?? null,
          actorType: result?.actor?.actorType ?? null,
          containerId: result?.actor?.containers?.[0]?.containerId ?? null,
          qty: result?.droppedItem?.qty ?? null,
          pos: result?.actor?.pos ?? null,
        });

        const full = buildInventoryFull(invRt, eqRt);
        await tx.commit();
        console.log("[DROP] inv:drop committed", {
          userId,
          itemInstanceId: intent?.itemInstanceId ?? null,
        });

        const actor = result.actor ?? null;
        if (actor) {
          console.log("[DROP] emitting world:object_spawn", {
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
