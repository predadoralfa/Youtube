"use strict";

const { getRuntime } = require("../../../state/runtimeStore");
const { ensureInventoryLoaded } = require("../../../state/inventory/loader");
const { loadActiveCraftDefs, loadActiveCraftJobs } = require("../../../state/inventory/loader/queries");
const { buildInventoryFull } = require("../../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../../state/equipment/loader");
const { loadCarryWeightStats } = require("../../../state/inventory/weight");
const { buildAutoFoodPayload } = require("../../../service/autoFoodService");
const { ensureResearchLoaded } = require("../../../service/researchService");
const { loadUserSkillSummaries } = require("../../../service/skillProgressionService");
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

  const rt = getRuntime(invRt.userId);
  invRt.research = await ensureResearchLoaded(invRt.userId, rt ?? { userId: invRt.userId });
  invRt.craftDefs = await loadActiveCraftDefs();
  invRt.craftJobs = await loadActiveCraftJobs(invRt.userId);
  invRt.skills = await loadUserSkillSummaries(invRt.userId, [
    "SKILL_CRAFTING",
    "SKILL_BUILDING",
    "SKILL_COOKING",
    "SKILL_GATHERING",
  ]);

  const full = buildInventoryFull(invRt, eqRt);
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
