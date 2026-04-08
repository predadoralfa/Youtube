// server/state/enemies/enemyAI.js
// IA de inimigos usando o motor central de combate

const { getRuntime } = require("../runtimeStore");
const { executeAttack } = require("../../service/combatSystem");
const { COMBAT_RANGE_LIMIT } = require("../../config/enemyConstants");

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

function updateSingleEnemyAI(enemy, nowMs) {
  if (!enemy || !enemy.pos || String(enemy.status) !== "ALIVE") {
    return false;
  }

  const prevMoveMode = enemy.moveMode;
  let changed = false;

  if (enemy._combatMode === true && enemy._combatActive === false) {
    if (enemy.moveMode !== "IDLE") {
      enemy.moveMode = "IDLE";
      enemy.moveTarget = null;
      enemy.moveStopRadius = null;
      changed = true;
    }
    return changed;
  }

  if (enemy._combatMode === true && enemy._combatActive === true) {
    const targetId = enemy._combatTargetId;
    if (!targetId) {
      resetEnemyToSpawn(enemy);
      return true;
    }

    const targetRt = getRuntime(String(targetId));
    if (!targetRt || !targetRt.pos) {
      resetEnemyToSpawn(enemy);
      return true;
    }

    if (!isFiniteNumber(targetRt.pos.x) || !isFiniteNumber(targetRt.pos.z)) {
      resetEnemyToSpawn(enemy);
      return true;
    }

    const attackRange = Number(enemy.stats?.attackRange);
    if (!Number.isFinite(attackRange) || attackRange <= 0) {
      console.warn(`[ENEMY_AI] Enemy ${enemy.id} sem attackRange valido`);
      return null;
    }

    const dist = calculateDistance(enemy.pos, targetRt.pos);
    if (dist > COMBAT_RANGE_LIMIT) {
      resetEnemyToSpawn(enemy);
      return true;
    }

    if (dist <= attackRange) {
      enemy._moveTarget = null;
      if (enemy.moveMode !== "IDLE") {
        enemy.moveMode = "IDLE";
        enemy.moveTarget = null;
        enemy.moveStopRadius = null;
        changed = true;
      }
      return changed;
    }

    if (prevMoveMode !== "FOLLOW") {
      changed = true;
    }

    enemy.moveMode = "FOLLOW";
    enemy.moveTarget = { x: targetRt.pos.x, z: targetRt.pos.z };
    enemy.moveStopRadius = attackRange;
    enemy.moveTickAtMs = nowMs;
    enemy._moveTarget = { x: targetRt.pos.x, z: targetRt.pos.z };
    enemy._moveTargetSetAt = nowMs;

    return changed;
  }

  if (enemy.moveMode !== "IDLE") {
    enemy.moveMode = "IDLE";
    enemy.moveTarget = null;
    enemy.moveStopRadius = null;
    changed = true;
  }

  return changed;
}

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

async function tickEnemyAI(enemies, t, dt) {
  if (!enemies || !Array.isArray(enemies)) {
    return [];
  }

  const changedEnemies = [];
  const attacks = [];

  for (const enemy of enemies) {
    if (!enemy || String(enemy.status) !== "ALIVE") {
      continue;
    }

    const aiChanged = updateSingleEnemyAI(enemy, t);
    if (aiChanged) {
      changedEnemies.push(enemy);
    }

    const attackResult = await updateSingleEnemyAttack(enemy, t);
    if (attackResult) {
      attacks.push(attackResult);
      if (!changedEnemies.includes(enemy)) {
        changedEnemies.push(enemy);
      }
    }
  }

  enemies._lastTickAttacks = attacks.length > 0 ? attacks : [];
  return changedEnemies;
}

function getLastTickAttacks(enemies) {
  if (!enemies || !Array.isArray(enemies)) {
    return [];
  }

  const attacks = enemies._lastTickAttacks || [];
  enemies._lastTickAttacks = [];
  return attacks;
}

module.exports = {
  tickEnemyAI,
  getLastTickAttacks,
  updateSingleEnemyAI,
  updateSingleEnemyAttack,
  resetEnemyToSpawn,
};
