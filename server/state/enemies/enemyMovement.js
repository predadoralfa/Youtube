// server/state/enemies/enemyMovement.js

const { getRuntime } = require("../runtimeStore");
const { getEnemiesForInstance } = require("./enemiesRuntimeStore");
const { computeChunkFromPos, getUsersInChunks } = require("../presenceIndex");
const { bumpRev, toDelta } = require("./enemyEntity");
const { moveEntityTowardTarget } = require("../movement/entityMotion");
const {
  calculateDistance,
  calculateYawToTarget,
  getEffectiveAttackRange,
  resetEnemyToSpawn,
} = require("./enemyAI/helpers");

/**
 * Gera posição aleatória em raio
 */
function generateRandomPosInRadius(homeX, homeZ, radius) {
  const angle = Math.random() * 2 * Math.PI;
  const dist = Math.random() * radius;
  return {
    x: Number(homeX) + dist * Math.cos(angle),
    z: Number(homeZ) + dist * Math.sin(angle),
  };
}

/**
 * Processa movimento de um inimigo
 */
function updateEnemyMovement(enemy, nowMs, dt) {
  // Inimigos mortos não se movem
  if (enemy.status !== "ALIVE") return false;

  if (Number.isFinite(Number(enemy._attackUntilMs)) && nowMs < Number(enemy._attackUntilMs)) {
    enemy.action = "attack";
    return false;
  }

  // Em combate, a patrulha normal fica suspensa.
  // O chase/posicionamento passa a ser controlado pela AI de combate.
  if (enemy._combatMode) {
    if (!enemy._combatActive) {
      enemy.action = "idle";
      return false;
    }

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

    const speed = Number(enemy.stats?.moveSpeed);
    if (!Number.isFinite(speed) || speed <= 0) {
      console.warn(`[ENEMY_MOVE] Enemy ${enemy.id} sem moveSpeed válido`);
      return false;
    }

    const attackRange = getEffectiveAttackRange(enemy);
    if (!Number.isFinite(attackRange) || attackRange <= 0) {
      console.warn(`[ENEMY_MOVE] Enemy ${enemy.id} sem attackRange válido`);
      return false;
    }

    const dist = calculateDistance(enemy.pos, targetRt.pos);
    const desiredYaw = calculateYawToTarget(enemy.pos, targetRt.pos);
    if (desiredYaw != null && enemy.yaw !== desiredYaw) {
      enemy.yaw = desiredYaw;
    }

    if (dist <= attackRange) {
      enemy.action = "idle";
      return false;
    }

    const movement = moveEntityTowardTarget({
      pos: enemy.pos,
      target: targetRt.pos,
      speed,
      dt,
      bounds: null,
      stopRadius: attackRange,
    });

    if (!movement.ok) {
      console.warn(`[ENEMY_MOVE] Enemy ${enemy.id} target inválido durante combate`);
      return false;
    }

    const newYaw = movement.yaw;
    const posChanged = movement.moved;
    const yawChanged = newYaw != null && enemy.yaw !== newYaw;

    if (!posChanged && !yawChanged) {
      enemy.action = "move";
      return false;
    }

    enemy.pos = movement.pos;
    if (newYaw != null) enemy.yaw = newYaw;
    enemy.action = "move";
    bumpRev(enemy);
    return true;
  }

  const speed = Number(enemy.stats?.moveSpeed);
  if (!Number.isFinite(speed) || speed <= 0) {
    console.warn(`[ENEMY_MOVE] Enemy ${enemy.id} sem moveSpeed válido`);
    return false;
  }
  const homeX = Number(enemy.spawnOriginPos?.x ?? enemy.homePos?.x) || 0;
  const homeZ = Number(enemy.spawnOriginPos?.z ?? enemy.homePos?.z) || 0;
  const radius = Number(enemy.patrolRadius);
  if (!Number.isFinite(radius) || radius <= 0) {
    console.warn(`[ENEMY_MOVE] Enemy ${enemy.id} sem patrolRadius válido`);
    return false;
  }
  const patrolWaitMs = Number(enemy.patrolWaitMs);
  if (!Number.isFinite(patrolWaitMs) || patrolWaitMs < 0) {
    console.warn(`[ENEMY_MOVE] Enemy ${enemy.id} sem patrolWaitMs válido`);
    return false;
  }
  const patrolStopRadius = Number(enemy.patrolStopRadius);
  if (!Number.isFinite(patrolStopRadius) || patrolStopRadius <= 0) {
    console.warn(`[ENEMY_MOVE] Enemy ${enemy.id} sem patrolStopRadius válido`);
    return false;
  }

  // Se não tem target, sorteia novo
  if (!enemy._moveTarget || !enemy._moveTargetSetAt) {
    enemy._moveTarget = generateRandomPosInRadius(homeX, homeZ, radius);
    enemy._moveTargetSetAt = nowMs;
  }

  const movement = moveEntityTowardTarget({
    pos: enemy.pos,
    target: enemy._moveTarget,
    speed,
    dt,
    bounds: null,
    stopRadius: patrolStopRadius,
  });

  if (!movement.ok) {
    console.warn(`[ENEMY_MOVE] Enemy ${enemy.id} target inválido`);
    return false;
  }

  // Chegou no target (raio de parada configurado no spawn point)
  if (movement.reached) {
    if (!enemy._moveWaitUntilMs) {
      enemy._moveWaitUntilMs = nowMs + patrolWaitMs;
    }

    if (nowMs < enemy._moveWaitUntilMs) {
      enemy.action = "idle";
      return false;
    }

    // Sorteia novo target
    enemy._moveTarget = generateRandomPosInRadius(homeX, homeZ, radius);
    enemy._moveTargetSetAt = nowMs;
    enemy._moveWaitUntilMs = null;
    enemy.action = "idle";
    return false;
  }

  const newYaw = movement.yaw;
  const posChanged = movement.moved;
  const yawChanged = newYaw != null && enemy.yaw !== newYaw;

  if (!posChanged && !yawChanged) return false;

  // Aplica mudanças
  enemy.pos = movement.pos;
  if (newYaw != null) enemy.yaw = newYaw;
  enemy.action = "move";

  bumpRev(enemy);
  return true; // changed
}

/**
 * Processa todos os inimigos de uma instância
 * Retorna lista de inimigos que mudaram (para emitir delta)
 */
function tickEnemyMovement(instanceId, nowMs, dt) {
  const enemies = getEnemiesForInstance(instanceId);
  const changedEnemies = [];

  for (const enemy of enemies) {
    const changed = updateEnemyMovement(enemy, nowMs, dt);
    if (changed) {
      changedEnemies.push(enemy);
    }
  }

  return changedEnemies;
}

module.exports = {
  tickEnemyMovement,
  generateRandomPosInRadius,
};
