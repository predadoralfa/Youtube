"use strict";

const { enemiesById, enemiesByInstance, toKey } = require("./store");

function getEnemy(enemyId) {
  return enemiesById.get(toKey(enemyId)) || null;
}

function getEnemiesForInstance(instanceId) {
  const set = enemiesByInstance.get(toKey(instanceId));
  if (!set) return [];

  const out = [];
  for (const id of set) {
    const e = enemiesById.get(id);
    if (e) out.push(e);
  }
  return out;
}

function getAliveEnemiesForSpawnInstance(spawnInstanceId) {
  const out = [];
  for (const enemy of enemiesById.values()) {
    if (Number(enemy.spawnInstanceId) === Number(spawnInstanceId) && enemy.status === "ALIVE") {
      out.push(enemy);
    }
  }
  return out;
}

function getAliveEnemiesForSpawnDefEnemy(spawnInstanceId, spawnDefEnemyId) {
  const out = [];
  for (const enemy of enemiesById.values()) {
    if (
      Number(enemy.spawnInstanceId) === Number(spawnInstanceId) &&
      Number(enemy.spawnDefEnemyId) === Number(spawnDefEnemyId) &&
      enemy.status === "ALIVE"
    ) {
      out.push(enemy);
    }
  }
  return out;
}

function getEnemyBySpawnInstanceEnemyId(spawnInstanceEnemyId) {
  for (const enemy of enemiesById.values()) {
    if (Number(enemy.spawnInstanceEnemyId) === Number(spawnInstanceEnemyId)) {
      return enemy;
    }
  }
  return null;
}

function getAliveEnemiesForLegacySpawnPoint(spawnPointId) {
  const out = [];
  for (const enemy of enemiesById.values()) {
    if (Number(enemy.spawnInstanceId) === Number(spawnPointId) && enemy.status === "ALIVE") {
      out.push(enemy);
    }
  }
  return out;
}

module.exports = {
  getEnemy,
  getEnemiesForInstance,
  getAliveEnemiesForSpawnInstance,
  getAliveEnemiesForSpawnDefEnemy,
  getEnemyBySpawnInstanceEnemyId,
  getAliveEnemiesForSpawnPoint: getAliveEnemiesForLegacySpawnPoint,
  getAliveEnemiesForSpawnEntry: getAliveEnemiesForSpawnDefEnemy,
  getAliveEnemiesForSpawnDefComponent: getAliveEnemiesForSpawnDefEnemy,
};
