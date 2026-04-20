"use strict";

const { withInventoryLock } = require("../../../../state/inventory/store");
const { getRuntime } = require("../../../../state/runtimeStore");
const { toDelta } = require("../../../../state/movement/entity");
const { resolveUserOrAck } = require("../context");
const { safeAck, summarizeIntent } = require("../shared");
const { startMedicalTreatment } = require("../../../../service/medicalTreatmentService");

function registerMedicalEvent(socket) {
  socket.on("inv:medicate", (intent, ack) => {
    const userId = resolveUserOrAck(socket, ack);
    if (!userId) return;

    console.log("[INV][MED] received", {
      userId,
      socketId: socket.id,
      intent: summarizeIntent(intent),
    });

    withInventoryLock(userId, async () => {
      try {
        const rt = getRuntime(userId);
        if (!rt) {
          safeAck(ack, {
            ok: false,
            code: "RUNTIME_NOT_LOADED",
            message: "Runtime not loaded",
          });
          return;
        }

        const result = await startMedicalTreatment(rt, intent?.itemInstanceId, {
          skipLock: true,
        });

        if (result?.ok !== true) {
          safeAck(ack, result);
          return;
        }

        const delta = toDelta(rt);
        socket.emit("move:state", {
          entityId: String(rt.userId),
          pos: rt.pos,
          yaw: rt.yaw,
          rev: rt.rev ?? 0,
          chunk: rt.chunk ?? null,
          vitals: delta.vitals,
          status: delta.status,
        });
        socket.emit("inv:full", result.inventory);
        safeAck(ack, result);
      } catch (e) {
        safeAck(ack, {
          ok: false,
          code: e.code || "INV_MED_ERR",
          message: e.message || "INV_MED_ERR",
        });
      }
    });
  });
}

module.exports = {
  registerMedicalEvent,
};
