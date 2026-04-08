"use strict";

const db = require("../../../../models");
const { withInventoryLock } = require("../../../../state/inventory/store");
const { split: splitInventoryItem } = require("../../../../state/inventory/authoritative");
const { loadInventoryContext, emitFullAndAck, resolveUserOrAck } = require("../context");
const { safeAck, summarizeHeldState, summarizeIntent } = require("../shared");

function registerSplitEvent(socket) {
  socket.on("inv:split", (intent, ack) => {
    const userId = resolveUserOrAck(socket, ack);
    if (!userId) return;

    console.log("[INV][SPLIT] received", {
      userId,
      socketId: socket.id,
      intent: summarizeIntent(intent),
    });

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const { invRt, eqRt } = await loadInventoryContext(userId);
        const result = await splitInventoryItem(invRt, intent, tx);
        await tx.commit();
        await emitFullAndAck(socket, invRt, eqRt, ack);
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
}

module.exports = {
  registerSplitEvent,
};
