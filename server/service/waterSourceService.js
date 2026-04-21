"use strict";

const {
  readRuntimeThirstCurrent,
  readRuntimeThirstMax,
  syncRuntimeThirst,
} = require("../state/movement/stamina");

const RIVER_DRINK_RATIO = 0.03;

function resolveRiverDrinkAmount(thirstMax) {
  const max = Math.max(0, Number(thirstMax ?? 0));
  return Math.max(1, Math.round(max * RIVER_DRINK_RATIO));
}

function drinkFromRiverSource(rt, actor = null, nowMs = Date.now()) {
  if (!rt) {
    return {
      ok: false,
      code: "RUNTIME_NOT_LOADED",
      message: "Runtime not loaded",
    };
  }

  if (!rt.status) rt.status = {};
  if (!rt.status.water) rt.status.water = {};

  const thirstCurrent = Math.max(0, readRuntimeThirstCurrent(rt));
  const thirstMax = Math.max(0, readRuntimeThirstMax(rt));
  if (thirstMax <= 0) {
    return {
      ok: false,
      code: "THIRST_NOT_AVAILABLE",
      message: "Thirst is not available",
    };
  }

  const lastDrinkAtMs = Number(rt.status.water.lastDrinkAtMs ?? 0);
  const drinkCooldownMs = Math.max(1000, Number(rt.collectCooldownMs ?? 0) || 0);
  if (lastDrinkAtMs > 0 && nowMs - lastDrinkAtMs < drinkCooldownMs) {
    return {
      ok: true,
      changed: false,
      thirstCurrent,
      thirstMax,
      cooldownActive: true,
      cooldownUntilMs: lastDrinkAtMs + drinkCooldownMs,
      actorId: actor?.id ?? null,
    };
  }

  const restoreAmount = resolveRiverDrinkAmount(thirstMax);
  const nextThirst = Math.min(thirstMax, thirstCurrent + restoreAmount);
  syncRuntimeThirst(rt, nextThirst, thirstMax);
  rt.status.water.lastDrinkAtMs = nowMs;
  rt.status.water.cooldownUntilMs = nowMs + drinkCooldownMs;

  return {
    ok: true,
    changed: nextThirst !== thirstCurrent,
    thirstCurrent: nextThirst,
    thirstMax,
    restored: nextThirst - thirstCurrent,
    restoredPct: RIVER_DRINK_RATIO,
    cooldownUntilMs: rt.status.water.cooldownUntilMs,
    actorId: actor?.id ?? null,
  };
}

module.exports = {
  drinkFromRiverSource,
};
