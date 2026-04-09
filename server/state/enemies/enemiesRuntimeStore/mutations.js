"use strict";

const { enemiesById, enemiesByInstance, ensureInstanceSet, toKey, toNum } = require("./store");

function addEnemy(enemy) {
  if (!enemy || enemy.id == null) return;

  const id = toKey(enemy.id);
  const instanceId = toKey(enemy.instanceId);

  const record = {
    id,
    instanceId,
    spawnInstanceId: toNum(enemy.spawnInstanceId),
    spawnDefEnemyId: toNum(enemy.spawnDefEnemyId),
    spawnInstanceEnemyId: toNum(enemy.spawnInstanceEnemyId ?? enemy.id),
    enemyDefId: toNum(enemy.enemyDefId),
    enemyDefCode: enemy.enemyDefCode ?? null,
    enemyDefName: enemy.enemyDefName ?? null,
    displayName: enemy.displayName ?? enemy.enemyDefName ?? enemy.enemyDefCode ?? null,
    visualKind: enemy.visualKind ?? "DEFAULT",
    assetKey: enemy.assetKey ?? null,
    collisionRadius: toNum(enemy.collisionRadius, 0.5),
    spawnOriginPos: {
      x: toNum(enemy.spawnOriginPos?.x ?? enemy.homePos?.x ?? enemy.pos?.x, 0),
      z: toNum(enemy.spawnOriginPos?.z ?? enemy.homePos?.z ?? enemy.pos?.z, 0),
    },
    pos: {
      x: toNum(enemy.pos?.x, 0),
      z: toNum(enemy.pos?.z, 0),
    },
    yaw: toNum(enemy.yaw, 0),
    homePos: {
      x: toNum(enemy.homePos?.x ?? enemy.spawnOriginPos?.x ?? enemy.pos?.x, 0),
      z: toNum(enemy.homePos?.z ?? enemy.spawnOriginPos?.z ?? enemy.pos?.z, 0),
    },
    patrolRadius: Number(enemy.patrolRadius),
    patrolWaitMs: Number(enemy.patrolWaitMs),
    patrolStopRadius: Number(enemy.patrolStopRadius),
    status: enemy.status ?? "ALIVE",
    stats: {
      hpCurrent: Number(enemy.stats?.hpCurrent),
      hpMax: Number(enemy.stats?.hpMax),
      moveSpeed: Number(enemy.stats?.moveSpeed),
      attackSpeed: Number(enemy.stats?.attackSpeed),
      attackPower: Number(enemy.stats?.attackPower),
      defense: Number(enemy.stats?.defense),
      attackRange: Number(enemy.stats?.attackRange),
    },
    rev: toNum(enemy.rev, 0),
    dirty: !!enemy.dirty,
  };

  enemiesById.set(id, record);
  ensureInstanceSet(instanceId).add(id);
}

function updateEnemyPos(enemyId, pos) {
  const id = toKey(enemyId);
  const enemy = enemiesById.get(id);
  if (!enemy) return false;

  enemy.pos = {
    x: toNum(pos?.x, enemy.pos?.x ?? 0),
    z: toNum(pos?.z, enemy.pos?.z ?? 0),
  };
  return true;
}

function updateEnemyStatus(enemyId, status) {
  const id = toKey(enemyId);
  const enemy = enemiesById.get(id);
  if (!enemy) return false;

  enemy.status = String(status ?? "ALIVE");
  return true;
}

function markEnemyDirty(enemyId) {
  const id = toKey(enemyId);
  const enemy = enemiesById.get(id);
  if (!enemy) return false;

  enemy.dirty = true;
  return true;
}

function removeEnemy(enemyId) {
  const id = toKey(enemyId);
  const enemy = enemiesById.get(id);
  if (!enemy) return false;

  enemiesById.delete(id);

  const set = enemiesByInstance.get(enemy.instanceId);
  if (set) {
    set.delete(id);
    if (set.size === 0) enemiesByInstance.delete(enemy.instanceId);
  }

  return true;
}

function clearInstance(instanceId) {
  const key = toKey(instanceId);
  const set = enemiesByInstance.get(key);
  if (!set) return;

  for (const id of set) enemiesById.delete(id);
  enemiesByInstance.delete(key);
}

module.exports = {
  addEnemy,
  updateEnemyPos,
  updateEnemyStatus,
  markEnemyDirty,
  removeEnemy,
  clearInstance,
};
