"use strict";

const { getEnemiesForInstance } = require("../../../../state/enemies/enemiesRuntimeStore");
const { loadEnemyCombatStats } = require("../../../../service/combatSystem");

async function resolveTarget({ attackerInstanceId, targetId, targetKind }) {
  if (targetKind !== "ENEMY") {
    throw Object.assign(new Error("UNKNOWN_TARGET_KIND"), { code: "UNKNOWN_TARGET_KIND" });
  }

  const enemies = getEnemiesForInstance(attackerInstanceId);
  const cleanTargetId = String(targetId).replace(/^enemy_/, "");
  const targetEnemy = enemies.find((enemy) => String(enemy.id) === cleanTargetId);

  if (!targetEnemy) {
    throw Object.assign(new Error("TARGET_NOT_FOUND"), { code: "TARGET_NOT_FOUND" });
  }
  if (String(targetEnemy.status) !== "ALIVE") {
    throw Object.assign(new Error("TARGET_NOT_ALIVE"), { code: "TARGET_NOT_ALIVE" });
  }

  const targetInstanceId = String(targetEnemy.instanceId ?? "");
  if (targetInstanceId !== attackerInstanceId) {
    throw Object.assign(new Error("DIFFERENT_INSTANCE"), { code: "DIFFERENT_INSTANCE" });
  }

  const targetStats = await loadEnemyCombatStats(targetEnemy.id);
  if (!targetStats) {
    throw Object.assign(new Error("TARGET_STATS_NOT_FOUND"), { code: "TARGET_STATS_NOT_FOUND" });
  }

  return {
    targetEnemy,
    targetStats,
    targetDefense: targetStats.defense || 0,
    targetPos: {
      x: Number(targetEnemy.pos?.x ?? 0),
      z: Number(targetEnemy.pos?.z ?? 0),
    },
  };
}

function validateRange(attackerPos, targetPos, attackRange, userId) {
  if (!Number.isFinite(attackRange) || attackRange <= 0) {
    throw Object.assign(new Error(`INVALID_ATTACK_RANGE for userId=${userId}`), {
      code: "INVALID_ATTACK_RANGE",
    });
  }

  const dx = targetPos.x - attackerPos.x;
  const dz = targetPos.z - attackerPos.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance > attackRange) {
    return {
      ok: false,
      distance,
      range: attackRange,
    };
  }

  return { ok: true, distance, range: attackRange };
}

module.exports = {
  resolveTarget,
  validateRange,
};
