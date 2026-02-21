// server/socket/handlers/move/applyWASD.js

const { DT_MAX } = require("./config");

const {
  normalize2D,
  clampPosToBounds,
  readRuntimeSpeedStrict,
  computeDtSeconds,
} = require("../../../state/movement/math");

const { isFiniteNumber } = require("./validate");

/**
 * Aplica um intent WASD no runtime.
 * - NÃO emite nada.
 * - NÃO toca DB.
 * - Retorna um resumo do que mudou.
 */
function applyWASDIntent({ runtime, nowMs, dir, yawDesired, isWASDActive }) {
  // dt autoritativo do servidor (não confia no client)
  const dt = computeDtSeconds(nowMs, runtime.wasdTickAtMs, DT_MAX);
  runtime.wasdTickAtMs = nowMs;

  // yaw vem da camera (se veio)
  let yawChanged = false;
  if (yawDesired != null && isFiniteNumber(yawDesired)) {
    const y = Math.atan2(Math.sin(yawDesired), Math.cos(yawDesired));
    if (runtime.yaw !== y) {
      runtime.yaw = y;
      yawChanged = true;
    }
  }

  // direção normalizada
  const d = normalize2D(dir.x, dir.z);

  // Sempre atualizar estado de input (para timeout server-side)
  runtime.inputDir = d;
  runtime.inputDirAtMs = nowMs;

  // Regras de prioridade: WASD cancela CLICK
  const wasdActiveNow = isWASDActive(runtime, nowMs);

  let modeOrActionChanged = false;

  if (wasdActiveNow) {
    if (runtime.moveMode === "CLICK") {
      runtime.moveTarget = null;
      runtime.moveMode = "WASD";
      modeOrActionChanged = true;
    } else if (runtime.moveMode !== "WASD") {
      runtime.moveMode = "WASD";
      modeOrActionChanged = true;
    }

    if (runtime.action !== "move") {
      runtime.action = "move";
      modeOrActionChanged = true;
    }
  } else {
    if (runtime.moveMode === "WASD") {
      runtime.moveMode = "STOP";
      modeOrActionChanged = true;
    }
    if (d.x === 0 && d.z === 0) {
      if (runtime.action !== "idle") {
        runtime.action = "idle";
        modeOrActionChanged = true;
      }
    }
  }

  const speed = readRuntimeSpeedStrict(runtime);
  if (speed == null) {
    return {
      ok: false,
      reason: "invalid_speed",
      yawChanged,
      moved: false,
      modeOrActionChanged,
      dir: d,
    };
  }

  let moved = false;

  // Só tenta mover se houver direção não-nula
  if (!(d.x === 0 && d.z === 0)) {
    if (!runtime.bounds) {
      return {
        ok: false,
        reason: "missing_bounds",
        yawChanged,
        moved: false,
        modeOrActionChanged,
        dir: d,
      };
    }

    const desired = {
      x: runtime.pos.x + d.x * speed * dt,
      y: runtime.pos.y,
      z: runtime.pos.z + d.z * speed * dt,
    };

    const clampedPos = clampPosToBounds(desired, runtime.bounds);
    if (!clampedPos) {
      return {
        ok: false,
        reason: "invalid_bounds",
        yawChanged,
        moved: false,
        modeOrActionChanged,
        dir: d,
      };
    }

    if (clampedPos.x !== runtime.pos.x || clampedPos.z !== runtime.pos.z) {
      runtime.pos = clampedPos;
      moved = true;
    }
  }

  return {
    ok: true,
    reason: null,
    yawChanged,
    moved,
    modeOrActionChanged,
    dir: d,
  };
}

module.exports = {
  applyWASDIntent,
};