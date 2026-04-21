"use strict";

const {
  readRuntimeSleepCurrent,
  readRuntimeSleepMax,
} = require("../state/movement/stamina/runtimeVitals");
const { stopMovement } = require("../state/movement/input");

function canStartPrimitiveShelterSleep(rt, maxStartPercent = 50) {
  if (!rt) return false;

  const sleepMax = Math.max(1, Number(readRuntimeSleepMax(rt) ?? 100) || 100);
  const sleepCurrent = Math.max(0, Number(readRuntimeSleepCurrent(rt) ?? 100) || 0);
  const sleepPercent = (sleepCurrent / sleepMax) * 100;
  return sleepPercent <= Number(maxStartPercent ?? 50);
}

function startPrimitiveShelterSleep(rt, actorId, nowMs = Date.now()) {
  if (!rt) return null;
  if (rt.sleepLock?.active !== true && !canStartPrimitiveShelterSleep(rt, 50)) return null;

  const lock = {
    active: true,
    actorId: String(actorId),
    startedAtMs: nowMs,
    kind: "PRIMITIVE_SHELTER",
  };

  rt.sleepLock = lock;
  rt.pendingSleep = null;
  rt.interact = null;
  stopMovement(rt, { nowMs });
  rt.action = "sleep";
  return lock;
}

function stopPrimitiveShelterSleep(rt) {
  if (!rt) return null;

  const prev = rt.sleepLock ?? null;
  rt.sleepLock = null;
  rt.pendingSleep = null;
  rt.interact = null;
  stopMovement(rt);
  rt.action = "idle";
  return prev;
}

module.exports = {
  canStartPrimitiveShelterSleep,
  startPrimitiveShelterSleep,
  stopPrimitiveShelterSleep,
};
