"use strict";

const db = require("../../../../models");
const { withInventoryLock } = require("../../../../state/inventory/store");
const {
  pickup: pickupInventoryItem,
  place: placeInventoryItem,
  cancel: cancelInventoryHeldState,
} = require("../../../../state/inventory/authoritative");
const { move } = require("../../../../state/inventory/ops/move");
const { merge } = require("../../../../state/inventory/ops/merge");
const { flush } = require("../../../../state/inventory/persist/flush");
const { loadInventoryContext, emitFullAndAck, resolveUserOrAck } = require("../context");
const { safeAck } = require("../shared");

async function runWithTx(socket, ack, work) {
  const userId = resolveUserOrAck(socket, ack);
  if (!userId) return;

  withInventoryLock(userId, async () => {
    const tx = await db.sequelize.transaction();
    try {
      const { invRt, eqRt } = await loadInventoryContext(userId);
      await work({ userId, invRt, eqRt, tx });
      await tx.commit();
      await emitFullAndAck(socket, invRt, eqRt, ack);
    } catch (e) {
      await tx.rollback().catch(() => {});
      safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
    }
  });
}

function registerMutationEvents(socket) {
  socket.on("inv:move", (intent, ack) => {
    runWithTx(socket, ack, async ({ invRt, eqRt, tx }) => {
      const result = move(invRt, intent);
      await flush(invRt, result, tx, eqRt);
    });
  });

  socket.on("inv:merge", (intent, ack) => {
    runWithTx(socket, ack, async ({ invRt, eqRt, tx }) => {
      const result = merge(invRt, intent);
      await flush(invRt, result, tx, eqRt);
    });
  });

  socket.on("inv:pickup", (intent, ack) => {
    runWithTx(socket, ack, async ({ invRt, tx }) => {
      await pickupInventoryItem(invRt, intent, tx);
    });
  });

  socket.on("inv:place", (intent, ack) => {
    runWithTx(socket, ack, async ({ invRt, tx }) => {
      await placeInventoryItem(invRt, intent, tx);
    });
  });

  socket.on("inv:cancel", (_intent, ack) => {
    runWithTx(socket, ack, async ({ invRt, tx }) => {
      await cancelInventoryHeldState(invRt, tx);
    });
  });
}

module.exports = {
  registerMutationEvents,
};
