"use strict";

const db = require("../../models");
const {
  resolveResearchItemWeightDelta,
  resolveResearchContainerMaxWeightDelta,
} = require("../../service/researchService");
const { INV_ERR, invError } = require("./validate/errors");

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getDefWeight(def) {
  const raw = def?.weight ?? def?.unit_weight ?? def?.unitWeight ?? def?.peso ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function getContainerEffectiveMaxWeight(container, research = null) {
  const base = Math.max(0, toNum(container?.def?.maxWeight, 0));
  const code = String(container?.def?.code ?? "").trim().toUpperCase();
  const researchBonus = resolveResearchContainerMaxWeightDelta(research, code);
  const total = base + researchBonus;
  if (total > 0) return total;

  if (code === "BASKET") return 2.5 + researchBonus;
  if (code === "BASKET_T2") return 5 + researchBonus;
  if (code === "BASKET_T3") return 5 + researchBonus;

  return 0;
}

function getInventoryMaxWeight(invRt, research = null) {
  return (invRt?.containers ?? [])
    .filter((container) => {
      const state = String(container?.state ?? "ACTIVE");
      if (state !== "ACTIVE") return false;
      const role = String(container?.slotRole ?? "").trim().toUpperCase();
      return !role.startsWith("GRANTED:");
    })
    .reduce((sum, container) => sum + getContainerEffectiveMaxWeight(container, research), 0);
}

function resolveCarryWeightMax(invRt, research = null, fallback = 20) {
  const total = getInventoryMaxWeight(invRt, research);
  if (total > 0) return total;

  const legacy = Number(invRt?.carryWeight);
  if (Number.isFinite(legacy) && legacy >= 0) return legacy;

  return fallback;
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

  const baseWeight = getDefWeight(def);
  const researchWeightDelta = resolveResearchItemWeightDelta(state.research, def?.code ?? null);
  const effectiveWeight = Math.max(0, baseWeight + researchWeightDelta);
  state.current += effectiveWeight * Math.max(1, toNum(qty, 1));
}

function getEffectiveUnitWeight(research, def) {
  const baseWeight = getDefWeight(def);
  const researchWeightDelta = resolveResearchItemWeightDelta(research, def?.code ?? null);
  return Math.max(0, baseWeight + researchWeightDelta);
}

function computeAdditionalItemWeight(research, def, qty = 1) {
  return getEffectiveUnitWeight(research, def) * Math.max(1, toNum(qty, 1));
}

function getGrantedContainerFallbackWeight(itemDef, component, research = null) {
  const data = component?.dataJson ?? component?.data_json ?? null;
  const containerCode = String(
    data?.containerDefCode ?? data?.container_def_code ?? itemDef?.code ?? ""
  )
    .trim()
    .toUpperCase();

  const researchBonus = resolveResearchContainerMaxWeightDelta(research, containerCode);

  if (containerCode === "BASKET") return 2.5 + researchBonus;
  if (containerCode === "BASKET_T2") return 5 + researchBonus;
  if (containerCode === "BASKET_T3") return 5 + researchBonus;
  return researchBonus;
}

function getEquippedGrantedContainerBonus(itemDef, component, research = null) {
  const code = String(itemDef?.code ?? "").trim().toUpperCase();
  const researchBonus = resolveResearchContainerMaxWeightDelta(research, code);

  if (code === "BASKET") return 2.5 + researchBonus;
  if (code === "BASKET_T2") return 5 + researchBonus;
  if (code === "BASKET_T3") return 5 + researchBonus;
  return getGrantedContainerFallbackWeight(itemDef, component, research);
}

function getGrantedContainerBonusFromItemDef(itemDef, research = null) {
  if (!itemDef) return 0;

  const components = Array.isArray(itemDef?.components) ? itemDef.components : [];
  const component = components.find((entry) => {
    const type = String(entry?.componentType ?? entry?.component_type ?? "").toUpperCase();
    return type === "GRANTS_CONTAINER";
  });
  if (!component) return 0;

  return getEquippedGrantedContainerBonus(itemDef, component, research);
}

function computeGrantedContainerBonus(invRt, eqRt = null, research = null) {
  let bonus = 0;
  const seen = new Set();

  for (const container of invRt?.containers ?? []) {
    if (String(container?.state ?? "ACTIVE").toUpperCase() !== "ACTIVE") continue;
    for (const slot of container?.slots ?? []) {
      if (!slot?.itemInstanceId) continue;

      const itemInstanceId = String(slot.itemInstanceId);
      if (seen.has(itemInstanceId)) continue;
      seen.add(itemInstanceId);

      const itemInstance = invRt?.itemInstanceById?.get?.(itemInstanceId) ?? null;
      if (!itemInstance) continue;

      const itemDef =
        invRt?.itemDefsById?.get?.(String(itemInstance.itemDefId)) ||
        eqRt?.itemDefsById?.get?.(String(itemInstance.itemDefId)) ||
        null;
      bonus += getGrantedContainerBonusFromItemDef(itemDef, research);
    }
  }

  for (const equipped of Object.values(eqRt?.equipmentBySlotCode ?? {})) {
    const itemDef = equipped?.itemDef ?? null;
    if (!itemDef) continue;

    const components = Array.isArray(itemDef?.components) ? itemDef.components : [];
    const component = components.find((entry) => {
      const type = String(entry?.componentType ?? entry?.component_type ?? "").toUpperCase();
      return type === "GRANTS_CONTAINER";
    });

    const bonusWeight = getEquippedGrantedContainerBonus(itemDef, component, research);
    if (bonusWeight <= 0) continue;
    bonus += bonusWeight;
  }

  return bonus;
}

function computeCarryWeight(invRt, eqRt = null, research = null) {
  const state = {
    invRt,
    eqRt,
    research,
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

  const baseMax = resolveCarryWeightMax(invRt, research);
  const grantedBonus = computeGrantedContainerBonus(invRt, eqRt, research);
  const max = baseMax + grantedBonus;
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

function assertCanAddItemWeight(invRt, eqRt, research, def, qty = 1) {
  const carryWeight = computeCarryWeight(invRt, eqRt, research);
  const additionalWeight = computeAdditionalItemWeight(research, def, qty);
  const nextWeight = carryWeight.current + additionalWeight;

  if (carryWeight.max > 0 && nextWeight > carryWeight.max + 0.000001) {
    throw invError(
      INV_ERR.CARRY_WEIGHT_LIMIT,
      `Carry weight limit reached (${nextWeight.toFixed(1)}/${carryWeight.max.toFixed(1)} kg).`,
      {
        current: carryWeight.current,
        max: carryWeight.max,
        additional: additionalWeight,
        next: nextWeight,
        itemCode: def?.code ?? null,
        qty: Math.max(1, toNum(qty, 1)),
      }
    );
  }

  return {
    ...carryWeight,
    additional: additionalWeight,
    next: nextWeight,
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
  computeAdditionalItemWeight,
  assertCanAddItemWeight,
  getInventoryMaxWeight,
  resolveCarryWeightMax,
  loadCarryWeightStats,
};
