"use strict";

const {
  MOVE_STAMINA_DRAIN_PER_SEC,
  MOVE_STAMINA_DRAIN_WARN_RATIO,
  MOVE_STAMINA_DRAIN_DANGER_RATIO,
  MOVE_STAMINA_DRAIN_WARN_MULTIPLIER,
  MOVE_STAMINA_DRAIN_DANGER_MULTIPLIER,
  MOVE_SPEED_AT_ZERO_STAMINA_MULTIPLIER,
  clamp,
  toFiniteNumber,
} = require("./shared");

function resolveCarryWeightDrainMultiplier(carryWeightRatio) {
  const ratio = clamp(toFiniteNumber(carryWeightRatio, 0), 0, Number.POSITIVE_INFINITY);

  if (ratio >= MOVE_STAMINA_DRAIN_DANGER_RATIO) {
    return MOVE_STAMINA_DRAIN_DANGER_MULTIPLIER;
  }

  if (ratio >= MOVE_STAMINA_DRAIN_WARN_RATIO) {
    return MOVE_STAMINA_DRAIN_WARN_MULTIPLIER;
  }

  return MOVE_STAMINA_DRAIN_PER_SEC;
}

function resolveMoveSpeedMultiplierFromStamina(staminaCurrent, projectedStaminaAfterMove = null) {
  const current = toFiniteNumber(staminaCurrent, 0);
  const projected =
    projectedStaminaAfterMove == null
      ? null
      : toFiniteNumber(projectedStaminaAfterMove, current);

  if (projected != null && projected <= 0) {
    return MOVE_SPEED_AT_ZERO_STAMINA_MULTIPLIER;
  }

  return current <= 0 ? MOVE_SPEED_AT_ZERO_STAMINA_MULTIPLIER : 1;
}

module.exports = {
  resolveCarryWeightDrainMultiplier,
  resolveMoveSpeedMultiplierFromStamina,
};
