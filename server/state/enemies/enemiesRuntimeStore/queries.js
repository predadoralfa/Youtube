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

function getAliveEnemiesForSpawnPoint(spawnPointId) {
  const out = [];
  for (const enemy of enemiesById.values()) {
    if (
      (Number(enemy.spawnPointId) === Number(spawnPointId) ||
        Number(enemy.spawnInstanceId) === Number(spawnPointId)) &&
      enemy.status === "ALIVE"
    ) {
      out.push(enemy);
    }
  }
  return out;
}

function getAliveEnemiesForSpawnEntry(spawnPointId, spawnEntryId) {
  const out = [];
  for (const enemy of enemiesById.values()) {
    if (
      Number(enemy.spawnPointId) === Number(spawnPointId) &&
      Number(enemy.spawnEntryId) === Number(spawnEntryId) &&
      enemy.status === "ALIVE"
    ) {
      out.push(enemy);
    }
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

function getAliveEnemiesForSpawnDefComponent(spawnInstanceId, spawnDefComponentId) {
  const out = [];
  for (const enemy of enemiesById.values()) {
    if (
      Number(enemy.spawnInstanceId) === Number(spawnInstanceId) &&
      Number(enemy.spawnDefComponentId) === Number(spawnDefComponentId) &&
      enemy.status === "ALIVE"
    ) {
      out.push(enemy);
    }
  }
  return out;
}

module.exports = {
  getEnemy,
  getEnemiesForInstance,
  getAliveEnemiesForSpawnPoint,
  getAliveEnemiesForSpawnEntry,
  getAliveEnemiesForSpawnInstance,
  getAliveEnemiesForSpawnDefComponent,
};
