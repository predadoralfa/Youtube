"use strict";

const { DT_MAX } = require("../../config");
const {
  normalize2D,
  computeDtSeconds,
} = require("../../../../../state/movement/math");
const { isFiniteNumber } = require("../../validate");
const {
  normalizeAngle,
  clampCameraPitch,
  clampCameraDistance,
} = require("../camera");
const { applyModeState } = require("./mode");
const { applyMovement } = require("./movement");

async function applyWASDIntent({
  runtime,
  nowMs,
  dir,
  yawDesired,
  cameraPitch,
  cameraDistance,
  isWASDActive,
}) {
  const dt = computeDtSeconds(nowMs, runtime.wasdTickAtMs, DT_MAX);
  runtime.wasdTickAtMs = nowMs;

  let yawChanged = false;
  if (yawDesired != null && isFiniteNumber(yawDesired)) {
    const y = normalizeAngle(yawDesired);
    if (runtime.yaw !== y) {
      runtime.yaw = y;
      yawChanged = true;
    }
  }

  let cameraChanged = false;
  if (cameraPitch != null && isFiniteNumber(cameraPitch)) {
    const nextPitch = clampCameraPitch(cameraPitch);
    if (runtime.cameraPitch !== nextPitch) {
      runtime.cameraPitch = nextPitch;
      cameraChanged = true;
    }
  }

  if (cameraDistance != null && isFiniteNumber(cameraDistance)) {
    const nextDistance = clampCameraDistance(cameraDistance);
    if (runtime.cameraDistance !== nextDistance) {
      runtime.cameraDistance = nextDistance;
      cameraChanged = true;
    }
  }

  const d = normalize2D(dir.x, dir.z);
  runtime.inputDir = d;
  runtime.inputDirAtMs = nowMs;

  const { modeOrActionChanged, combatCancelled } = applyModeState(
    runtime,
    nowMs,
    d,
    isWASDActive
  );

  const movementResult = await applyMovement(runtime, nowMs, dt, d);
  if (!movementResult.ok) {
    return {
      ok: false,
      reason: movementResult.reason,
      yawChanged,
      cameraChanged,
      moved: false,
      modeOrActionChanged,
      combatCancelled,
      dir: d,
    };
  }

  return {
    ok: true,
    reason: null,
    yawChanged,
    cameraChanged,
    moved: movementResult.moved,
    modeOrActionChanged,
    combatCancelled,
    staminaChanged: movementResult.staminaChanged,
    dir: d,
  };
}

module.exports = {
  applyWASDIntent,
};
