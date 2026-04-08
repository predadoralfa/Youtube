"use strict";

const {
  DT_MAX,
  STAMINA_BASE_REGEN_PER_SEC,
  HP_BASE_REGEN_PER_SEC,
  DEFAULT_TERRAIN_DRAIN_MULTIPLIER,
  DEFAULT_STAMINA_REGEN_MULTIPLIER,
  DEFAULT_HP_REGEN_MULTIPLIER,
  DEFAULT_HUNGER_ITEM_RECOVERY,
  clamp,
  toFiniteNumber,
} = require("./shared");
const { resolveCarryWeightDrainMultiplier } = require("./carryWeight");
const {
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  syncRuntimeHp,
  syncRuntimeStamina,
  syncRuntimeHunger,
} = require("./runtimeVitals");
const { resolveHungerRegenMultiplier } = require("./hunger");

function applyVitalsTick(
  rt,
  nowMs,
  {
    movedReal = false,
    carryWeightRatio = 0,
    terrainDrainMultiplier = DEFAULT_TERRAIN_DRAIN_MULTIPLIER,
    regenMultiplier = DEFAULT_STAMINA_REGEN_MULTIPLIER,
    hpRegenMultiplier = DEFAULT_HP_REGEN_MULTIPLIER,
    hungerItemRecovery = DEFAULT_HUNGER_ITEM_RECOVERY,
    dtMax = DT_MAX,
  } = {}
) {
  if (!rt) {
    return {
      changed: false,
      hpChanged: false,
      staminaChanged: false,
      dt: 0,
      hpRegen: 0,
      drain: 0,
      regen: 0,
      hpCurrent: 0,
      hpMax: 0,
      hungerCurrent: 0,
      hungerMax: 0,
      hungerRegenMultiplier: 0,
      current: 0,
      max: 0,
    };
  }

  const lastTickAtMs = Number(rt.staminaTickAtMs ?? 0);
  const dtRaw = lastTickAtMs > 0 ? (Number(nowMs ?? 0) - lastTickAtMs) / 1000 : 0;
  const dt = clamp(dtRaw, 0, dtMax);

  rt.staminaTickAtMs = Number(nowMs ?? 0);

  const hpCurrent = readRuntimeHpCurrent(rt);
  const hpMax = Math.max(0, readRuntimeHpMax(rt));
  const current = readRuntimeStaminaCurrent(rt);
  const max = Math.max(0, readRuntimeStaminaMax(rt));
  const hungerCurrent = readRuntimeHungerCurrent(rt);
  const hungerMax = Math.max(0, readRuntimeHungerMax(rt));
  const hungerRegenMultiplier = resolveHungerRegenMultiplier(hungerCurrent, hungerMax);
  const effectiveStaminaRegenMultiplier =
    toFiniteNumber(regenMultiplier, 1.0) * hungerRegenMultiplier;
  const effectiveHpRegenMultiplier =
    toFiniteNumber(hpRegenMultiplier, 1.0) * hungerRegenMultiplier;

  const hpRegen = HP_BASE_REGEN_PER_SEC * dt * effectiveHpRegenMultiplier;
  const drain = movedReal
    ? resolveCarryWeightDrainMultiplier(carryWeightRatio) *
      dt *
      toFiniteNumber(terrainDrainMultiplier, 1.0)
    : 0;
  const regen = STAMINA_BASE_REGEN_PER_SEC * dt * effectiveStaminaRegenMultiplier;
  const nextHungerCurrent = clamp(
    hungerCurrent + toFiniteNumber(hungerItemRecovery, 0),
    0,
    hungerMax
  );
  const nextHpCurrent = clamp(hpCurrent + hpRegen, 0, hpMax);
  const nextCurrent = clamp(current + regen - drain, 0, max);
  const hpChanged = Math.abs(nextHpCurrent - hpCurrent) > 1e-9;
  const staminaChanged = Math.abs(nextCurrent - current) > 1e-9;
  const hungerChanged = Math.abs(nextHungerCurrent - hungerCurrent) > 1e-9;
  const changed = hpChanged || staminaChanged || hungerChanged;

  if (hpChanged || hpMax !== readRuntimeHpMax(rt)) {
    syncRuntimeHp(rt, nextHpCurrent, hpMax);
  }

  if (staminaChanged || max !== readRuntimeStaminaMax(rt)) {
    syncRuntimeStamina(rt, nextCurrent, max);
  }

  if (hungerChanged || hungerMax !== readRuntimeHungerMax(rt)) {
    syncRuntimeHunger(rt, nextHungerCurrent, hungerMax);
  } else if (readRuntimeHungerMax(rt) !== hungerMax) {
    syncRuntimeHunger(rt, hungerCurrent, hungerMax);
  }

  return {
    changed,
    hpChanged,
    staminaChanged,
    hungerChanged,
    dt,
    hpRegen,
    drain,
    regen,
    hpCurrent: nextHpCurrent,
    hpMax,
    hungerCurrent: nextHungerCurrent,
    hungerMax,
    hungerRegenMultiplier,
    current: nextCurrent,
    max,
  };
}

module.exports = {
  applyVitalsTick,
  applyStaminaTick: applyVitalsTick,
};
