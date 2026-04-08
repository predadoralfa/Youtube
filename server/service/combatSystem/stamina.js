"use strict";

const db = require("../../models");
const { getRuntime, markStatsDirty } = require("../../state/runtimeStore");
const {
  MELEE_ATTACK_STAMINA_COST,
  RANGED_ATTACK_STAMINA_COST,
  RANGED_ATTACK_MIN_RANGE,
} = require("../../config/combatConstants");
const {
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  syncRuntimeStamina,
} = require("../../state/movement/stamina");

function resolveAttackStaminaCost(attackRange) {
  const range = Number(attackRange);
  if (Number.isFinite(range) && range > RANGED_ATTACK_MIN_RANGE) {
    return RANGED_ATTACK_STAMINA_COST;
  }
  return MELEE_ATTACK_STAMINA_COST;
}

async function consumeAttackerStamina(attackerId, attackerKind, attackRange) {
  if (attackerKind !== "PLAYER") {
    return {
      ok: true,
      staminaCost: 0,
      staminaBefore: null,
      staminaAfter: null,
      staminaMax: null,
    };
  }

  const staminaCost = resolveAttackStaminaCost(attackRange);
  const runtime = getRuntime(attackerId);

  if (runtime) {
    const staminaBefore = readRuntimeStaminaCurrent(runtime);
    const staminaMax = readRuntimeStaminaMax(runtime);

    if (staminaBefore < staminaCost) {
      return {
        ok: false,
        error: "INSUFFICIENT_STAMINA",
        staminaCost,
        staminaBefore,
        staminaAfter: staminaBefore,
        staminaMax,
      };
    }

    const staminaAfter = Math.max(0, staminaBefore - staminaCost);
    syncRuntimeStamina(runtime, staminaAfter, staminaMax);
    markStatsDirty(attackerId);

    return {
      ok: true,
      staminaCost,
      staminaBefore,
      staminaAfter,
      staminaMax,
    };
  }

  const stats = await db.GaUserStats.findByPk(attackerId);
  if (!stats) {
    return {
      ok: false,
      error: "ATTACKER_STATS_NOT_FOUND",
      staminaCost,
      staminaBefore: 0,
      staminaAfter: 0,
      staminaMax: 0,
    };
  }

  const staminaBefore = Number(stats.stamina_current ?? 0);
  const staminaMax = Number(stats.stamina_max ?? 0);

  if (staminaBefore < staminaCost) {
    return {
      ok: false,
      error: "INSUFFICIENT_STAMINA",
      staminaCost,
      staminaBefore,
      staminaAfter: staminaBefore,
      staminaMax,
    };
  }

  const staminaAfter = Math.max(0, staminaBefore - staminaCost);
  await stats.update({ stamina_current: staminaAfter });

  return {
    ok: true,
    staminaCost,
    staminaBefore,
    staminaAfter,
    staminaMax,
  };
}

module.exports = {
  consumeAttackerStamina,
  resolveAttackStaminaCost,
};
