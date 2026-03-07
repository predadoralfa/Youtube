// server/state/enemies/enemyEmit.js

const { computeChunkFromPos, getUsersInChunks } = require("../presenceIndex");
const { toDelta } = require("./enemyEntity");

/**
 * Emite delta de inimigo para todos os players que podem vê-lo (interesse/chunk).
 * 
 * Estratégia:
 * - Calcula chunk do inimigo
 * - Pega todos os players visíveis naquele chunk
 * - Envia delta para cada um
 */
function emitEnemyDelta(io, enemy) {
  if (!enemy) return;

  const delta = toDelta(enemy);

  // Calcula chunk do inimigo
  const { cx, cz } = computeChunkFromPos(enemy.pos);

  // Pega todos os players interessados naquele chunk
  const interestedUserIds = getUsersInChunks(enemy.instanceId, cx, cz);
  if (!interestedUserIds || interestedUserIds.size === 0) return;

  // Envia delta para cada player do chunk
  for (const userId of interestedUserIds) {
    const roomId = `inst:${enemy.instanceId}_${cx}:${cz}`;
    io.to(roomId).emit("entity:delta", delta);
  }
}

/**
 * Emite spawn (baseline) de inimigo quando aparece para um player
 */
function emitEnemySpawn(io, enemy) {
  if (!enemy) return;

  const entity = {
    entityId: String(enemy.id),
    displayName: enemy.enemyDefCode ?? "Enemy",
    pos: enemy.pos ?? { x: 0, z: 0 },
    yaw: Number(enemy.yaw ?? 0),
    hp: Number(enemy.stats?.hpCurrent ?? 0),
    action: enemy.action ?? "idle",
    rev: Number(enemy.rev ?? 0),
  };

  // Calcula chunk
  const { cx, cz } = computeChunkFromPos(enemy.pos);
  const roomId = `inst:${enemy.instanceId}_${cx}:${cz}`;

  io.to(roomId).emit("entity:spawn", entity);
}

/**
 * Emite despawn (morte/desaparecimento) de inimigo
 */
function emitEnemyDespawn(io, enemy) {
  if (!enemy) return;

  const { cx, cz } = computeChunkFromPos(enemy.pos);
  const roomId = `inst:${enemy.instanceId}_${cx}:${cz}`;

  io.to(roomId).emit("entity:despawn", {
    entityId: String(enemy.id),
    rev: Number(enemy.rev ?? 0),
  });
}

module.exports = {
  emitEnemyDelta,
  emitEnemySpawn,
  emitEnemyDespawn,
};