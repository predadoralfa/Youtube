"use strict";

const { getActiveSocket } = require("../../../../socket/sessionIndex");
const db = require("../../../../models");
const { loadPlayerCombatStats } = require("../../../runtime/combatLoader");
const { executeAttack, loadEnemyCombatStats } = require("../../../../service/combatSystem");
const { markEnemyDead } = require("../../../../service/enemyRespawnService");

async function executeServerSideAttack(io, attackerRt, targetEnemy) {
  const userId = attackerRt.userId;
  const nowMs = Date.now();

  const attackerPos = {
    x: Number(attackerRt.pos?.x ?? 0),
    z: Number(attackerRt.pos?.z ?? 0),
  };

  const targetPos = {
    x: Number(targetEnemy.pos?.x ?? 0),
    z: Number(targetEnemy.pos?.z ?? 0),
  };

  const stats = await loadPlayerCombatStats(userId);
  const enemyStats = await loadEnemyCombatStats(targetEnemy.id);
  const targetDefense = enemyStats?.defense || 0;
  const attackRange = Number(attackerRt.combat?.attackRange ?? stats?.attackRange ?? 1.2);
  const combatResult = await executeAttack({
    attackerId: userId,
    attackerKind: "PLAYER",
    targetId: targetEnemy.id,
    targetKind: "ENEMY",
    attackerPos,
    targetPos,
    attackerAttackPower: stats?.attackPower,
    attackerAttackSpeed: stats?.attackSpeed,
    targetDefense,
    attackRange,
    lastAttackAtMs: Number(attackerRt.combat?.lastAttackAtMs ?? 0),
    nowMs,
  });

  if (!combatResult.ok) {
    return false;
  }

  if (!targetEnemy.stats) targetEnemy.stats = {};
  targetEnemy.hpCurrent = combatResult.targetHPAfter;
  targetEnemy.hp_current = combatResult.targetHPAfter;
  targetEnemy.stats.hpCurrent = combatResult.targetHPAfter;
  targetEnemy.stats.hpMax = combatResult.targetHPMax;
  targetEnemy._hpChanged = true;

  try {
    const enemyStatsRow = await db.GaEnemyRuntimeStats.findByPk(targetEnemy.id);
    if (enemyStatsRow) {
      await enemyStatsRow.update({
        hp_current: combatResult.targetHPAfter,
        hp_max: combatResult.targetHPMax,
      });
    }
    if (combatResult.targetDied) {
      await markEnemyDead(targetEnemy.id, nowMs);
    }
  } catch (err) {
    console.error(`[COMBAT] Failed to persist enemy hp for enemy=${targetEnemy.id}:`, err);
  }

  if (!attackerRt.combat) attackerRt.combat = {};
  attackerRt.combat.lastAttackAtMs = nowMs;
  attackerRt._lastAttackAtMs = nowMs;

  if (!targetEnemy._combatActive) {
    targetEnemy._combatActive = true;
    targetEnemy._combatMode = true;
    targetEnemy._combatTargetId = userId;
    targetEnemy._lastAttackAtMs = 0;
  }
  targetEnemy._combatTargetId = userId;

  const instanceId = attackerRt.instanceId;
  const combatEventId = `PLAYER:${userId}:ENEMY:${targetEnemy.id}:${nowMs}`;
  io.to(`inst:${instanceId}`).emit("combat:damage_taken", {
    eventId: combatEventId,
    attackerId: userId,
    targetId: `enemy_${targetEnemy.id}`,
    targetKind: "ENEMY",
    damage: combatResult.damage,
    targetHPBefore: combatResult.targetHPBefore,
    targetHPAfter: combatResult.targetHPAfter,
    targetHPMax: combatResult.targetHPMax,
    targetDied: combatResult.targetDied,
    timestamp: nowMs,
  });

  const activeSocket = getActiveSocket(userId);
  if (activeSocket) {
    activeSocket.emit("combat:attack_result", {
      ok: true,
      source: "AUTO",
      damage: combatResult.damage,
      targetHPAfter: combatResult.targetHPAfter,
      targetHPMax: combatResult.targetHPMax,
      targetDied: combatResult.targetDied,
      attackPower: stats?.attackPower,
      cooldownMs: combatResult.cooldownMs,
      staminaCost: combatResult.staminaCost,
      staminaBefore: combatResult.staminaBefore,
      staminaAfter: combatResult.staminaAfter,
      staminaMax: combatResult.staminaMax,
    });
  }

  if (combatResult.targetDied) {
    targetEnemy.status = "DEAD";
  }

  return true;
}

module.exports = {
  executeServerSideAttack,
};
