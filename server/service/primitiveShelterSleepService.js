"use strict";

function startPrimitiveShelterSleep(rt, actorId, nowMs = Date.now()) {
  if (!rt) return null;

  const lock = {
    active: true,
    actorId: String(actorId),
    startedAtMs: nowMs,
    kind: "PRIMITIVE_SHELTER",
  };

  rt.sleepLock = lock;
  rt.pendingSleep = null;
  rt.interact = null;
  rt.moveTarget = null;
  rt.moveMode = "STOP";
  rt.action = "sleep";
  rt.inputDir = { x: 0, z: 0 };
  rt.inputDirAtMs = 0;
  return lock;
}

function stopPrimitiveShelterSleep(rt) {
  if (!rt) return null;

  const prev = rt.sleepLock ?? null;
  rt.sleepLock = null;
  rt.pendingSleep = null;
  rt.interact = null;
  rt.moveTarget = null;
  rt.moveMode = "STOP";
  rt.action = "idle";
  rt.inputDir = { x: 0, z: 0 };
  rt.inputDirAtMs = 0;
  return prev;
}

module.exports = {
  startPrimitiveShelterSleep,
  stopPrimitiveShelterSleep,
};
