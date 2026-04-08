"use strict";

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function calculateDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function resetEnemyToSpawn(enemy) {
  if (!enemy) return;

  const hadCombat = Boolean(enemy._combatMode || enemy._combatActive);

  if (enemy.spawnOriginPos) {
    enemy.pos = { ...enemy.spawnOriginPos };
    enemy.homePos = { ...enemy.spawnOriginPos };
  } else if (enemy.homePos) {
    enemy.pos = { ...enemy.homePos };
  }

  enemy._combatMode = false;
  enemy._combatActive = false;
  enemy._combatTargetId = null;
  enemy._moveTarget = null;
  enemy._moveTargetSetAt = null;
  enemy._combatStartedAtMs = null;
  enemy._lastAttackAtMs = 0;
  enemy.moveMode = "IDLE";
  enemy.moveTarget = null;
  enemy.moveStopRadius = null;

  if (hadCombat) {
    console.log(`[ENEMY_AI] Enemy ${enemy.id} resetado ao spawn`);
  }
}

module.exports = {
  isFiniteNumber,
  calculateDistance,
  resetEnemyToSpawn,
};
