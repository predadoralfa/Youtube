"use strict";

const db = require("../../models");

const LEGACY_HAND_ROLES = new Set(["HAND_L", "HAND_R"]);

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getDefWeight(def) {
  const raw = def?.weight ?? def?.unit_weight ?? def?.unitWeight ?? def?.peso ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function getInventoryMaxWeight(invRt) {
  return (invRt?.containers ?? [])
    .filter((container) => !LEGACY_HAND_ROLES.has(String(container?.slotRole ?? "")))
    .reduce((sum, container) => sum + Math.max(0, toNum(container?.def?.maxWeight, 0)), 0);
}

function addWeightedInstance(state, itemInstanceId, itemDefId, qty) {
  if (itemInstanceId == null) return;

  const id = String(itemInstanceId);
  if (state.seen.has(id)) return;
  state.seen.add(id);

  const def =
    state.invRt?.itemDefsById?.get?.(String(itemDefId)) ||
    state.eqRt?.itemDefsById?.get?.(String(itemDefId)) ||
    null;

  state.current += getDefWeight(def) * Math.max(1, toNum(qty, 1));
}

function computeCarryWeight(invRt, eqRt = null) {
  const state = {
    invRt,
    eqRt,
    seen: new Set(),
    current: 0,
  };

  for (const container of invRt?.containers ?? []) {
    for (const slot of container?.slots ?? []) {
      if (!slot?.itemInstanceId) continue;
      const itemInstance = invRt?.itemInstanceById?.get?.(String(slot.itemInstanceId)) || null;
      if (!itemInstance) continue;
      addWeightedInstance(state, slot.itemInstanceId, itemInstance.itemDefId, slot.qty);
    }
  }

  for (const equipped of Object.values(eqRt?.equipmentBySlotCode ?? {})) {
    if (!equipped?.itemInstanceId) continue;

    const itemInstanceId = String(equipped.itemInstanceId);
    if (state.seen.has(itemInstanceId)) continue;

    const itemInstance =
      eqRt?.itemInstancesById?.get?.(itemInstanceId) ||
      invRt?.itemInstanceById?.get?.(itemInstanceId) ||
      equipped.itemInstance ||
      null;

    const itemDefId = itemInstance?.itemDefId ?? equipped?.itemDef?.id ?? null;
    addWeightedInstance(state, itemInstanceId, itemDefId, equipped.qty ?? 1);
  }

  const heldState = invRt?.heldState ?? null;
  if (heldState?.itemInstanceId != null) {
    const heldId = String(heldState.itemInstanceId);
    if (!state.seen.has(heldId)) {
      addWeightedInstance(state, heldId, heldState.itemDefId, heldState.qty);
    }
  }

  const max = getInventoryMaxWeight(invRt);
  const ratio = max > 0 ? state.current / max : 0;
  const percent = max > 0 ? Math.min(100, Math.max(0, ratio * 100)) : 0;

  return {
    current: state.current,
    max,
    ratio,
    percent,
    isOverCapacity: max > 0 ? state.current > max : false,
  };
}

async function loadCarryWeightStats(userIdRaw) {
  const userId = Number(userIdRaw);
  if (!Number.isInteger(userId) || userId <= 0) return 20;

  const stats = await db.GaUserStats.findByPk(userId, {
    attributes: ["carry_weight"],
  });

  const value = Number(stats?.carry_weight);
  return Number.isFinite(value) && value >= 0 ? value : 20;
}

module.exports = {
  computeCarryWeight,
  loadCarryWeightStats,
};
