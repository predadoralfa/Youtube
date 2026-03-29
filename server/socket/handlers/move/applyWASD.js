// server/socket/handlers/move/applyWASD.js

const { DT_MAX } = require("./config");

const {
  normalize2D,
  readRuntimeSpeedStrict,
  computeDtSeconds,
} = require("../../../state/movement/math");
const { moveEntityByDirection } = require("../../../state/movement/entityMotion");

const { isFiniteNumber } = require("./validate");
const { clearPlayerCombat } = require("./clearCombat");
const { applyStaminaTick } = require("../../../state/movement/stamina");

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
  let combatCancelled = false;

  if (wasdActiveNow) {
    if ((d.x !== 0 || d.z !== 0) && runtime.combat?.state === "ENGAGED") {
      combatCancelled = clearPlayerCombat(runtime);
    }

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
        combatCancelled,
        dir: d,
      };
  }

  let moved = false;
  let staminaChanged = false;

  // Só tenta mover se houver direção não-nula
  if (!(d.x === 0 && d.z === 0)) {
    if (!runtime.bounds) {
      return {
        ok: false,
        reason: "missing_bounds",
        yawChanged,
        moved: false,
        modeOrActionChanged,
        combatCancelled,
        dir: d,
      };
    }

    const movedResult = moveEntityByDirection({
      pos: runtime.pos,
      dir: d,
      speed,
      dt,
      bounds: runtime.bounds,
    });

    if (!movedResult.ok) {
      return {
        ok: false,
        reason: movedResult.reason ?? "invalid_bounds",
        yawChanged,
        moved: false,
        modeOrActionChanged,
        combatCancelled,
        dir: d,
      };
    }

    if (movedResult.moved) {
      runtime.pos = movedResult.pos;
      moved = true;
      const staminaResult = applyStaminaTick(runtime, nowMs, {
        movedReal: true,
      });
      staminaChanged = !!staminaResult.changed;
    }
  }

  return {
    ok: true,
    reason: null,
    yawChanged,
    moved,
    modeOrActionChanged,
    combatCancelled,
    staminaChanged,
    dir: d,
  };
}

module.exports = {
  applyWASDIntent,
};
