"use strict";

const { getRuntime } = require("../../../../state/runtimeStore");
const { loadPlayerCombatStats } = require("../../../../service/combatSystem");
const { COMBAT_BASE_COOLDOWN_MS } = require("../../../../config/combatConstants");

async function loadAttackerOrThrow(userId) {
  const attackerRuntime = getRuntime(userId);
  if (!attackerRuntime) {
    throw Object.assign(new Error("ATTACKER_NOT_FOUND"), { code: "ATTACKER_NOT_FOUND" });
  }

  const attackerStats = await loadPlayerCombatStats(userId);
  if (!attackerStats) {
    throw Object.assign(new Error("ATTACKER_STATS_NOT_FOUND"), {
      code: "ATTACKER_STATS_NOT_FOUND",
    });
  }

  if (!attackerRuntime._lastAttackAtMs) {
    attackerRuntime._lastAttackAtMs = 0;
  }

  return {
    attackerRuntime,
    attackerStats,
    attackerInstanceId: String(attackerRuntime.instanceId ?? ""),
    attackerPos: {
      x: Number(attackerRuntime.pos?.x ?? 0),
      z: Number(attackerRuntime.pos?.z ?? 0),
    },
  };
}

function validateCooldown(attackerRuntime, attackerStats, nowMs) {
  const lastAttackMs = attackerRuntime._lastAttackAtMs ?? 0;
  const cooldownMs = COMBAT_BASE_COOLDOWN_MS / (attackerStats.attackSpeed || 1);
  const timeSinceLastAttack = nowMs - lastAttackMs;

  if (timeSinceLastAttack < cooldownMs) {
    return {
      ok: false,
      cooldownRemaining: cooldownMs - timeSinceLastAttack,
    };
  }

  return { ok: true, cooldownMs };
}

module.exports = {
  loadAttackerOrThrow,
  validateCooldown,
};
