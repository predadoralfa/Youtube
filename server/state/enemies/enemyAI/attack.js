"use strict";

const { getRuntime } = require("../../runtimeStore");
const { executeAttack } = require("../../../service/combatSystem");
const { isFiniteNumber, calculateDistance, resetEnemyToSpawn } = require("./helpers");

async function updateSingleEnemyAttack(enemy, nowMs) {
  if (!enemy) return null;
  if (!enemy._combatActive) return null;
  if (!enemy._combatTargetId) return null;
  if (String(enemy.status) !== "ALIVE") return null;

  const targetId = String(enemy._combatTargetId);
  const targetRt = getRuntime(targetId);
  if (!targetRt || !targetRt.pos) {
    resetEnemyToSpawn(enemy);
    return null;
  }

  if (!isFiniteNumber(enemy.pos?.x) || !isFiniteNumber(enemy.pos?.z)) return null;
  if (!isFiniteNumber(targetRt.pos.x) || !isFiniteNumber(targetRt.pos.z)) return null;

  const attackRange = Number(enemy.stats?.attackRange);
  if (!Number.isFinite(attackRange) || attackRange <= 0) {
    console.warn(`[ENEMY_AI] Enemy ${enemy.id} sem attackRange valido`);
    return null;
  }

  const dist = calculateDistance(enemy.pos, targetRt.pos);
  if (dist > attackRange) {
    return null;
  }

  const enemyAttackPower = Number(enemy.stats?.attackPower);
  const enemyAttackSpeed = Number(enemy.stats?.attackSpeed);
  if (!Number.isFinite(enemyAttackPower) || !Number.isFinite(enemyAttackSpeed)) {
    console.warn(`[ENEMY_AI] Enemy ${enemy.id} sem stats de combate validos`);
    return null;
  }

  const playerDefense = Number(targetRt._defense || 0);

  const combatResult = await executeAttack({
    attackerId: enemy.id,
    attackerKind: "ENEMY",
    targetId,
    targetKind: "PLAYER",
    attackerPos: enemy.pos,
    targetPos: targetRt.pos,
    attackerAttackPower: enemyAttackPower,
    attackerAttackSpeed: enemyAttackSpeed,
    targetDefense: playerDefense,
    attackRange,
    lastAttackAtMs: enemy._lastAttackAtMs ?? 0,
    nowMs,
  });

  if (!combatResult.ok) {
    return null;
  }

  enemy._lastAttackAtMs = nowMs;

  return {
    enemyId: enemy.id,
    targetId: String(targetId),
    attackPower: enemyAttackPower,
    damage: combatResult.damage,
    targetHPBefore: combatResult.targetHPBefore,
    targetHPAfter: combatResult.targetHPAfter,
    targetHPMax: combatResult.targetHPMax,
    targetDied: combatResult.targetDied,
  };
}

module.exports = {
  updateSingleEnemyAttack,
};
