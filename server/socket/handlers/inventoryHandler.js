// server/socket/handlers/inventoryHandler.js
const db = require("../../models");
const { withInventoryLock } = require("../../state/inventory/store");
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

  /**
   * READ-ONLY (MVP):
   * UI abre inventário -> pede snapshot autoritativo
   */
  socket.on("inv:request_full", (intent = {}, ack) => {
    withInventoryLock(requireUser(), async () => {
      const tx = await db.sequelize.transaction();
      try {
        const userId = requireUser();

        // garante runtime carregado (mesmo sem mutação)
        const invRt = await ensureInventoryLoaded(userId, tx);

        // ✅ buildInventoryFull recebe invRt (não userId)
        const full = buildInventoryFull(invRt);

        // leitura não precisa flush; apenas commit da tx de leitura
        await tx.commit();

        socket.emit("inv:full", full);
        safeAck(ack, { ok: true });

        console.log(
          "[INV] intent=inv:request_full user=",
          userId,
          "containers=",
          full?.containers?.length
        );
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, {
          ok: false,
          code: e.code || "INV_ERR",
          message: e.message,
          meta: e.meta,
        });
        console.log(
          "[INV] error intent=inv:request_full user=",
          socket.data.userId,
          "code=",
          e.code,
          "msg=",
          e.message
        );
      }
    });
  });

  socket.on("inv:move", (intent, ack) => {
    withInventoryLock(requireUser(), async () => {
      const tx = await db.sequelize.transaction();
      try {
        const userId = requireUser();
        const invRt = await ensureInventoryLoaded(userId, tx);

        const result = move(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        // ✅ buildInventoryFull(invRt)
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
        const invRt = await ensureInventoryLoaded(userId, tx);

        const result = split(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        // ✅ buildInventoryFull(invRt)
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
        const invRt = await ensureInventoryLoaded(userId, tx);

        const result = merge(invRt, intent);
        await flush(invRt, result, tx);

        await tx.commit();

        // ✅ buildInventoryFull(invRt)
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