"use strict";

const {
  THIRST_TICK_INTERVAL_MS,
  THIRST_WORLD_HOURS_TO_EMPTY,
  clamp,
  toFiniteNumber,
} = require("./shared");
const {
  readRuntimeThirstCurrent,
  readRuntimeThirstMax,
  syncRuntimeThirst,
} = require("./runtimeVitals");

function resolveThirstRegenMultiplier(thirstCurrent, thirstMax) {
  const max = Math.max(0, toFiniteNumber(thirstMax, 0));
  if (max <= 0) return 0;

  const ratio = clamp(toFiniteNumber(thirstCurrent, 0) / max, 0, 1);
  if (ratio <= 0) return 0;
  if (ratio <= 0.05) return 0.05;
  if (ratio < 0.15) return 0.5;
  if (ratio < 0.3) return 0.8;
  return 1;
}

function resolveThirstDrainPerSecond(
  thirstMax,
  timeFactor = 1,
  worldHoursToEmpty = THIRST_WORLD_HOURS_TO_EMPTY
) {
  const max = Math.max(0, toFiniteNumber(thirstMax, 0));
  const factor = Math.max(0, toFiniteNumber(timeFactor, 1));
  const worldHours = Math.max(1e-9, toFiniteNumber(worldHoursToEmpty, THIRST_WORLD_HOURS_TO_EMPTY));
  return max * (factor / (worldHours * 60 * 60));
}

function applyThirstTick(
  rt,
  nowMs,
  {
    timeFactor = 1,
    worldHoursToEmpty = THIRST_WORLD_HOURS_TO_EMPTY,
    intervalMs = THIRST_TICK_INTERVAL_MS,
  } = {}
) {
  if (!rt) {
    return {
      changed: false,
      thirstChanged: false,
      dt: 0,
      drain: 0,
      thirstCurrent: 0,
      thirstMax: 0,
    };
  }

  const now = Number(nowMs ?? 0);
  const lastTickAtMs = Number(rt.thirstTickAtMs ?? 0);
  if (lastTickAtMs <= 0) {
    rt.thirstTickAtMs = now;
    return {
      changed: false,
      thirstChanged: false,
      dt: 0,
      drain: 0,
      thirstCurrent: readRuntimeThirstCurrent(rt),
      thirstMax: readRuntimeThirstMax(rt),
    };
  }

  const elapsedMs = Math.max(0, now - lastTickAtMs);
  const tickInterval = Math.max(1000, toFiniteNumber(intervalMs, THIRST_TICK_INTERVAL_MS));
  if (elapsedMs < tickInterval) {
    return {
      changed: false,
      thirstChanged: false,
      dt: 0,
      drain: 0,
      thirstCurrent: readRuntimeThirstCurrent(rt),
      thirstMax: readRuntimeThirstMax(rt),
    };
  }

  const dt = elapsedMs / 1000;
  rt.thirstTickAtMs = now;

  const thirstCurrent = readRuntimeThirstCurrent(rt);
  const thirstMax = Math.max(0, readRuntimeThirstMax(rt));
  const drainPerSecond = resolveThirstDrainPerSecond(thirstMax, timeFactor, worldHoursToEmpty);
  const drain = drainPerSecond * dt;
  const nextThirstCurrent = clamp(thirstCurrent - drain, 0, thirstMax);
  const thirstChanged = Math.abs(nextThirstCurrent - thirstCurrent) > 1e-9;

  if (thirstChanged || readRuntimeThirstMax(rt) !== thirstMax) {
    syncRuntimeThirst(rt, nextThirstCurrent, thirstMax);
  }

  return {
    changed: thirstChanged,
    thirstChanged,
    dt,
    drain,
    thirstCurrent: nextThirstCurrent,
    thirstMax,
  };
}

module.exports = {
  resolveThirstRegenMultiplier,
  resolveThirstDrainPerSecond,
  applyThirstTick,
};
