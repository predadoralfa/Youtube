"use strict";

const { markStatsDirty } = require("../../../../../state/runtime/dirty");
const { readRuntimeSpeedStrict } = require("../../../../../state/movement/math");
const { moveEntityByDirection } = require("../../../../../state/movement/entityMotion");
const {
  applyStaminaTick,
  resolveCarryWeightDrainMultiplier,
  resolveMoveSpeedMultiplierFromStamina,
  shouldQueueStaminaPersist,
} = require("../../../../../state/movement/stamina");
const { resolveCarryWeightRatio } = require("../carryWeight");

async function applyMovement(runtime, nowMs, dt, dir) {
  const speed = readRuntimeSpeedStrict(runtime);
  if (speed == null) {
    return { ok: false, reason: "invalid_speed", moved: false, staminaChanged: false };
  }

  let moved = false;
  let staminaChanged = false;

  const currentStamina =
    runtime?.staminaCurrent ?? runtime?.stats?.staminaCurrent ?? runtime?.combat?.staminaCurrent;
  const carryWeightRatio = await resolveCarryWeightRatio(runtime.userId);
  const projectedDrain = resolveCarryWeightDrainMultiplier(carryWeightRatio) * dt;
  const moveSpeedMultiplier = resolveMoveSpeedMultiplierFromStamina(
    currentStamina,
    Number(currentStamina ?? 0) - projectedDrain
  );

  if (!(dir.x === 0 && dir.z === 0)) {
    if (!runtime.bounds) {
      return { ok: false, reason: "missing_bounds", moved: false, staminaChanged: false };
    }

    const movedResult = moveEntityByDirection({
      pos: runtime.pos,
      dir,
      speed: speed * moveSpeedMultiplier,
      dt,
      bounds: runtime.bounds,
    });

    if (!movedResult.ok) {
      return {
        ok: false,
        reason: movedResult.reason ?? "invalid_bounds",
        moved: false,
        staminaChanged: false,
      };
    }

    if (movedResult.moved) {
      runtime.pos = movedResult.pos;
      moved = true;

      const staminaResult = applyStaminaTick(runtime, nowMs, {
        movedReal: true,
        carryWeightRatio,
      });
      staminaChanged = !!staminaResult.staminaChanged;

      if (staminaChanged) {
        const staminaState = shouldQueueStaminaPersist(
          runtime,
          runtime?.staminaCurrent ?? runtime?.stats?.staminaCurrent ?? runtime?.combat?.staminaCurrent,
          runtime?.staminaMax ?? runtime?.stats?.staminaMax ?? runtime?.combat?.staminaMax
        );
        if (staminaState.changed) {
          markStatsDirty(runtime.userId, nowMs);
        }
      }
    }
  }

  return {
    ok: true,
    reason: null,
    moved,
    staminaChanged,
  };
}

module.exports = {
  applyMovement,
};
