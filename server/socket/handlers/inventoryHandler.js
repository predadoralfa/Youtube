// server/socket/handlers/inventoryHandler.js
const db = require("../../models");
const { withInventoryLock, clearInventory } = require("../../state/inventory/store");
const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { buildInventoryFull } = require("../../state/inventory/fullPayload");
const { flush } = require("../../state/inventory/persist/flush");

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

        const invRt = await ensureInventoryLoaded(userId);
        const full = buildInventoryFull(invRt);

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

        const result = move(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        const full = buildInventoryFull(invRt);
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

        const result = split(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        const full = buildInventoryFull(invRt);
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

        const result = merge(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        const full = buildInventoryFull(invRt);
        socket.emit("inv:full", full);
        safeAck(ack, { ok: true });
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });
}

module.exports = { registerInventoryHandler };