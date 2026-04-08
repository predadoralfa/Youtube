"use strict";

const { withInventoryLock } = require("../../../../state/inventory/store");
const { getRuntime } = require("../../../../state/runtimeStore");
const { setAutoFoodConfig } = require("../../../../service/autoFoodService");
const { resolveUserOrAck } = require("../context");
const { safeAck } = require("../shared");

function registerAutoFoodEvent(socket) {
  socket.on("inv:auto_food:set", (intent, ack) => {
    const userId = resolveUserOrAck(socket, ack);
    if (!userId) return;

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

        const result = await setAutoFoodConfig(userId, rt, intent ?? {});
        if (result?.ok !== true) {
          safeAck(ack, result);
          return;
        }

        socket.emit("inv:full", result.inventory);
        safeAck(ack, result);
      } catch (e) {
        safeAck(ack, {
          ok: false,
          code: e.code || "AUTO_FOOD_ERR",
          message: e.message || "AUTO_FOOD_ERR",
        });
      }
    });
  });
}

module.exports = {
  registerAutoFoodEvent,
};
