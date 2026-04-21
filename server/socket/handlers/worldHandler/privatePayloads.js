"use strict";

const { ensureInventoryLoaded } = require("../../../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../../../state/equipment/loader");
const { buildInventoryFull } = require("../../../state/inventory/fullPayload");
const { loadCarryWeightStats } = require("../../../state/inventory/weight");
const { getRuntime } = require("../../../state/runtimeStore");
const { buildAutoFoodPayload } = require("../../../service/autoFoodService");
const { ensureResearchLoaded, buildResearchPayload } = require("../../../service/researchService");

async function emitInventoryFull(socket) {
  const userId = socket.data.userId;
  if (!userId) return;
  const invRt = await ensureInventoryLoaded(userId);
  const eqRt = await ensureEquipmentLoaded(userId);
  try {
    invRt.carryWeight = await loadCarryWeightStats(userId);
  } catch (loadErr) {
    console.warn("[WORLD] carry weight load failed", {
      userId,
      socketId: socket.id,
      error: String(loadErr?.message || loadErr),
    });
  }
  const inv = buildInventoryFull(invRt, eqRt);
  const rt = getRuntime(userId);
  if (rt) {
    inv.macro = {
      autoFood: buildAutoFoodPayload(rt),
    };
  }
  socket.emit("inv:full", inv);
}

async function emitResearchFull(socket) {
  const userId = socket.data.userId;
  if (!userId) return;
  const research = await ensureResearchLoaded(userId);
  socket.emit("research:full", buildResearchPayload({ research }));
}

module.exports = {
  emitInventoryFull,
  emitResearchFull,
};
