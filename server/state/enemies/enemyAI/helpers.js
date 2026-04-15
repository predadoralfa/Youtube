"use strict";

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function calculateDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function calculateYawToTarget(fromPos, toPos) {
  if (!fromPos || !toPos) return null;

  const dx = Number(toPos.x) - Number(fromPos.x);
  const dz = Number(toPos.z) - Number(fromPos.z);
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return null;
  if (dx === 0 && dz === 0) return null;

  return Math.atan2(dx, dz);
}

function getEffectiveAttackRange(enemy) {
  const base = Number(enemy?.stats?.attackRange);
  if (!Number.isFinite(base) || base <= 0) return 0;

  // Teste curto para evitar oscilação na borda do combate.
  // Mantém a fonte da verdade no banco, mas dá uma folga pequena no runtime.
  return base + 0.75;
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
  enemy._attackUntilMs = null;
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
  calculateYawToTarget,
  getEffectiveAttackRange,
  resetEnemyToSpawn,
};
