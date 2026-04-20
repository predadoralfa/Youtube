"use strict";

const {
  HUNGER_TICK_INTERVAL_MS,
  HUNGER_WORLD_HOURS_TO_EMPTY,
  clamp,
  toFiniteNumber,
} = require("./shared");
const {
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  syncRuntimeHunger,
} = require("./runtimeVitals");

function resolveHungerRegenMultiplier(hungerCurrent, hungerMax) {
  const max = Math.max(0, toFiniteNumber(hungerMax, 0));
  if (max <= 0) return 0;

  const ratio = clamp(toFiniteNumber(hungerCurrent, 0) / max, 0, 1);
  if (ratio <= 0) return 0;
  if (ratio <= 0.05) return 0.05;
  if (ratio < 0.15) return 0.5;
  if (ratio < 0.3) return 0.8;
  return 1;
}

function resolveHungerDrainPerSecond(hungerMax, timeFactor = 1, worldHoursToEmpty = HUNGER_WORLD_HOURS_TO_EMPTY) {
  const max = Math.max(0, toFiniteNumber(hungerMax, 0));
  const factor = Math.max(0, toFiniteNumber(timeFactor, 1));
  const worldHours = Math.max(1e-9, toFiniteNumber(worldHoursToEmpty, HUNGER_WORLD_HOURS_TO_EMPTY));
  return max * (factor / (worldHours * 60 * 60));
}

function applyHungerTick(
  rt,
  nowMs,
  {
    timeFactor = 1,
    worldHoursToEmpty = HUNGER_WORLD_HOURS_TO_EMPTY,
    intervalMs = HUNGER_TICK_INTERVAL_MS,
  } = {}
) {
  if (!rt) {
    return {
      changed: false,
      hungerChanged: false,
      dt: 0,
      drain: 0,
      hungerCurrent: 0,
      hungerMax: 0,
    };
  }

  const now = Number(nowMs ?? 0);
  const lastTickAtMs = Number(rt.hungerTickAtMs ?? 0);
  if (lastTickAtMs <= 0) {
    rt.hungerTickAtMs = now;
    return {
      changed: false,
      hungerChanged: false,
      dt: 0,
      drain: 0,
      hungerCurrent: readRuntimeHungerCurrent(rt),
      hungerMax: readRuntimeHungerMax(rt),
    };
  }

  const elapsedMs = Math.max(0, now - lastTickAtMs);
  const tickInterval = Math.max(1000, toFiniteNumber(intervalMs, HUNGER_TICK_INTERVAL_MS));
  if (elapsedMs < tickInterval) {
    return {
      changed: false,
      hungerChanged: false,
      dt: 0,
      drain: 0,
      hungerCurrent: readRuntimeHungerCurrent(rt),
      hungerMax: readRuntimeHungerMax(rt),
    };
  }

  const dt = elapsedMs / 1000;
  rt.hungerTickAtMs = now;

  const hungerCurrent = readRuntimeHungerCurrent(rt);
  const hungerMax = Math.max(0, readRuntimeHungerMax(rt));
  const drainPerSecond = resolveHungerDrainPerSecond(hungerMax, timeFactor, worldHoursToEmpty);
  const drain = drainPerSecond * dt;
  const nextHungerCurrent = clamp(hungerCurrent - drain, 0, hungerMax);
  const hungerChanged = Math.abs(nextHungerCurrent - hungerCurrent) > 1e-9;

  if (hungerChanged || readRuntimeHungerMax(rt) !== hungerMax) {
    syncRuntimeHunger(rt, nextHungerCurrent, hungerMax);
  }

  return {
    changed: hungerChanged,
    hungerChanged,
    dt,
    drain,
    hungerCurrent: nextHungerCurrent,
    hungerMax,
  };
}

module.exports = {
  resolveHungerRegenMultiplier,
  resolveHungerDrainPerSecond,
  applyHungerTick,
};
