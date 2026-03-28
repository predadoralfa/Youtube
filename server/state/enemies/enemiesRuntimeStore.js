// server/state/enemies/enemiesRuntimeStore.js

/**
 * Runtime store autoritativo para ENEMIES (inimigos).
 *
 * Regras (mesmas do actorsRuntimeStore):
 * - NÃO acessa banco (exceto no load inicial).
 * - NÃO depende de socket.
 * - Apenas cache em memória para consulta rápida (ex: interact, spawn).
 *
 * Shape do enemy:
 * {
 *   id: string,
 *   instanceId: string,
 *   spawnPointId: number,
 *   spawnEntryId: number,
 *   enemyDefId: number,
 *   pos: { x, z },
 *   yaw: number,
 *   homePos: { x, z },
 *   status: "ALIVE" | "DEAD" | "DESPAWNED",
 *   stats: {
 *     hpCurrent: number,
 *     hpMax: number,
 *     moveSpeed: number,
 *     attackSpeed: number,
 *     attackPower: number,
 *   },
 *   rev: number,
 *   dirty: boolean,
 * }
 *
 * Fonte de carga:
 * - spawnTick.js: cria novos inimigos e chama addEnemy()
 */

const enemiesById = new Map(); // enemyId(string) -> { id, instanceId, pos:{x,z}, status, stats, rev, dirty }
const enemiesByInstance = new Map(); // instanceId(string) -> Set(enemyId)

function toKey(v) {
  return String(v);
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function addEnemy(enemy) {
  if (!enemy || enemy.id == null) return;

  const id = toKey(enemy.id);
  const instanceId = toKey(enemy.instanceId);

  const record = {
    id,
    instanceId,
    spawnPointId: toNum(enemy.spawnPointId),
    spawnEntryId: toNum(enemy.spawnEntryId),
    enemyDefId: toNum(enemy.enemyDefId),
    pos: {
      x: toNum(enemy.pos?.x, 0),
      z: toNum(enemy.pos?.z, 0),
    },
    yaw: toNum(enemy.yaw, 0),
    homePos: {
      x: toNum(enemy.homePos?.x ?? enemy.pos?.x, 0),
      z: toNum(enemy.homePos?.z ?? enemy.pos?.z, 0),
    },
    status: enemy.status ?? "ALIVE",
    stats: {
      hpCurrent: toNum(enemy.stats?.hpCurrent, 0),
      hpMax: toNum(enemy.stats?.hpMax, 0),
      moveSpeed: toNum(enemy.stats?.moveSpeed, 0),
      attackSpeed: toNum(enemy.stats?.attackSpeed, 0),
      attackPower: toNum(enemy.stats?.attackPower, 5),
    },
    rev: toNum(enemy.rev, 0),
    dirty: !!enemy.dirty,
  };

  enemiesById.set(id, record);

  let set = enemiesByInstance.get(instanceId);
  if (!set) {
    set = new Set();
    enemiesByInstance.set(instanceId, set);
  }
  set.add(id);
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
    if (Number(enemy.spawnPointId) === Number(spawnPointId) && enemy.status === "ALIVE") {
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
  getEnemy,
  getEnemiesForInstance,
  getAliveEnemiesForSpawnPoint,
  getAliveEnemiesForSpawnEntry,
  clearInstance,
};
