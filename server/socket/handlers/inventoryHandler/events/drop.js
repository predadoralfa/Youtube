"use strict";

const db = require("../../../../models");
const { withInventoryLock } = require("../../../../state/inventory/store");
const { clearInventory } = require("../../../../state/inventory/store");
const { clearEquipment } = require("../../../../state/equipment/store");
const { ensureInventoryLoaded } = require("../../../../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../../../../state/equipment/loader");
const { getRuntime } = require("../../../../state/runtimeStore");
const { addActor } = require("../../../../state/actorsRuntimeStore");
const { buildInventoryFull } = require("../../../../state/inventory/fullPayload");
const { dropInventoryItemToGround } = require("../../../../service/inventoryDropService");
const { loadInventoryContext, resolveUserOrAck } = require("../context");
const { safeAck } = require("../shared");

function registerDropEvent(socket) {
  socket.on("inv:drop", (intent, ack) => {
    const userId = resolveUserOrAck(socket, ack);
    if (!userId) return;

    withInventoryLock(userId, async () => {
      const tx = await db.sequelize.transaction();
      try {
        const { invRt, eqRt } = await loadInventoryContext(userId);
        const runtime = getRuntime(userId);

        const result = await dropInventoryItemToGround(userId, intent?.itemInstanceId, {
          runtime,
          invRt,
          eqRt,
          transaction: tx,
        });

        if (!result?.ok) {
          await tx.rollback().catch(() => {});
          safeAck(ack, {
            ok: false,
            code: result?.code || "INV_ERR",
            message: result?.message || "Drop failed",
          });
          return;
        }

        await tx.commit();

        const actor = result.actor ?? null;
        if (actor) {
          addActor(actor);
          socket.emit("world:object_spawn", {
            objectKind: "ACTOR",
            actor,
          });
        }

        clearInventory(userId);
        clearEquipment(userId);
        const invRtFresh = await ensureInventoryLoaded(userId);
        const eqRtFresh = await ensureEquipmentLoaded(userId);
        const full = buildInventoryFull(invRtFresh, eqRtFresh);

        socket.emit("inv:full", full);
        safeAck(ack, { ok: true, inventory: full, actor });
      } catch (e) {
        await tx.rollback().catch(() => {});
        safeAck(ack, { ok: false, code: e.code || "INV_ERR", message: e.message, meta: e.meta });
      }
    });
  });
}

module.exports = {
  registerDropEvent,
};
