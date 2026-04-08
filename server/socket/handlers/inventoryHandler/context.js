"use strict";

const { getRuntime } = require("../../../state/runtimeStore");
const { ensureInventoryLoaded } = require("../../../state/inventory/loader");
const { buildInventoryFull } = require("../../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../../state/equipment/loader");
const { loadCarryWeightStats } = require("../../../state/inventory/weight");
const { buildAutoFoodPayload } = require("../../../service/autoFoodService");
const { safeAck } = require("./shared");

function requireUser(socket) {
  const userId = socket.data.userId;
  if (!userId) throw new Error("Socket not authenticated");
  return userId;
}

function resolveUserOrAck(socket, ack) {
  try {
    return requireUser(socket);
  } catch (e) {
    safeAck(ack, {
      ok: false,
      code: "NOT_AUTHENTICATED",
      message: e.message,
    });
    return null;
  }
}

async function emitFullAndAck(socket, invRt, eqRt, ack) {
  try {
    invRt.carryWeight = await loadCarryWeightStats(invRt.userId);
  } catch (loadErr) {
    console.warn("[INV][WEIGHT] load failed", {
      userId: invRt?.userId ?? null,
      error: String(loadErr?.message || loadErr),
    });
  }

  const full = buildInventoryFull(invRt, eqRt);
  const rt = getRuntime(invRt.userId);
  if (rt) {
    full.macro = {
      autoFood: buildAutoFoodPayload(rt),
    };
  }
  socket.emit("inv:full", full);
  safeAck(ack, { ok: true, inventory: full });
}

async function loadInventoryContext(userId) {
  const invRt = await ensureInventoryLoaded(userId);
  const eqRt = await ensureEquipmentLoaded(userId);
  return { invRt, eqRt };
}

module.exports = {
  requireUser,
  resolveUserOrAck,
  emitFullAndAck,
  loadInventoryContext,
};
