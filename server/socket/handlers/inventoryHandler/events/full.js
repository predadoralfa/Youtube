"use strict";

const { withInventoryLock } = require("../../../../state/inventory/store");
const { loadInventoryContext, emitFullAndAck, resolveUserOrAck } = require("../context");
const { safeAck } = require("../shared");

function registerRequestFull(socket) {
  socket.on("inv:request_full", (_intent = {}, ack) => {
    const userId = resolveUserOrAck(socket, ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      try {
        const { invRt, eqRt } = await loadInventoryContext(userId);
        await emitFullAndAck(socket, invRt, eqRt, ack);
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
}

module.exports = {
  registerRequestFull,
};
