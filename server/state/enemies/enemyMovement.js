// server/state/enemies/enemyMovement.js

const { getEnemiesForInstance } = require("./enemiesRuntimeStore");
const { computeChunkFromPos, getUsersInChunks } = require("../presenceIndex");
const { bumpRev, toDelta } = require("./enemyEntity");

/**
 * Gera posição aleatória em raio
 */
function generateRandomPosInRadius(homeX, homeZ, radius = 5) {
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

  // Não mover quando combat acabou ou está congelado
  if (enemy._combatMode && !enemy._combatActive) {
    return false;
  }

  const speed = Number(enemy.stats?.moveSpeed) || 3.5;
  const homeX = Number(enemy.homePos?.x) || 0;
  const homeZ = Number(enemy.homePos?.z) || 0;
  const radius = 5; // raio de patrulha

  // Se não tem target, sorteia novo
  if (!enemy._moveTarget || !enemy._moveTargetSetAt) {
    enemy._moveTarget = generateRandomPosInRadius(homeX, homeZ, radius);
    enemy._moveTargetSetAt = nowMs;
  }

  const tx = Number(enemy._moveTarget.x);
  const tz = Number(enemy._moveTarget.z);

  const dx = tx - enemy.pos.x;
  const dz = tz - enemy.pos.z;
  const dist = Math.hypot(dx, dz);

  // Chegou no target (raio de parada: 0.5)
  const stopRadius = 0.5;
  if (dist <= stopRadius) {
    // Sorteia novo target
    enemy._moveTarget = generateRandomPosInRadius(homeX, homeZ, radius);
    enemy._moveTargetSetAt = nowMs;
    enemy.action = "idle";
    return false;
  }

  // Move em direção ao target
  const dirLen = Math.hypot(dx, dz);
  if (dirLen <= 0.00001) return false;

  const dirX = dx / dirLen;
  const dirZ = dz / dirLen;

  // Atualiza posição
  const newPosX = enemy.pos.x + dirX * speed * dt;
  const newPosZ = enemy.pos.z + dirZ * speed * dt;

  // Atualiza yaw (apontando para direção do movimento)
  const newYaw = Math.atan2(dirX, dirZ);

  // Verificar se mudou
  const posChanged = (newPosX !== enemy.pos.x) || (newPosZ !== enemy.pos.z);
  const yawChanged = enemy.yaw !== newYaw;

  if (!posChanged && !yawChanged) return false;

  // Aplica mudanças
  enemy.pos = { x: newPosX, z: newPosZ };
  enemy.yaw = newYaw;
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
