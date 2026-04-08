"use strict";

function requireNum(v, label, enemyId) {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid enemy stat ${label} for enemyDefId=${enemyId}`);
  }
  return n;
}

function normalizeLoadedEnemy({
  row,
  instanceId,
  originPos,
  patrolRadius,
  patrolWaitMs,
  patrolStopRadius,
  stats,
  enemyDef,
  attackPower,
  defense,
  attackRange,
  spawnInstanceId = null,
  spawnDefComponentId = null,
  spawnPointId = null,
  spawnEntryId = null,
  debug = null,
}) {
  return {
    id: String(row.id),
    instanceId: String(instanceId),
    spawnInstanceId: spawnInstanceId == null ? null : Number(spawnInstanceId),
    spawnDefComponentId: spawnDefComponentId == null ? null : Number(spawnDefComponentId),
    spawnPointId: spawnPointId == null ? null : Number(spawnPointId),
    spawnEntryId: spawnEntryId == null ? null : Number(spawnEntryId),
    enemyDefId: Number(row.enemy_def_id),
    enemyDefCode: enemyDef?.code ?? null,
    enemyDefName: enemyDef?.name ?? null,
    displayName: enemyDef?.name ?? enemyDef?.code ?? `Enemy ${row.id}`,
    visualKind: enemyDef?.visual_kind ?? "DEFAULT",
    collisionRadius: Number(enemyDef?.collision_radius),
    pos: {
      x: Number(row.pos_x),
      z: Number(row.pos_z),
    },
    spawnOriginPos: {
      x: Number(originPos.x),
      z: Number(originPos.z),
    },
    yaw: Number(row.yaw ?? 0),
    homePos: {
      x: Number(originPos.x),
      z: Number(originPos.z),
    },
    patrolRadius,
    patrolWaitMs,
    patrolStopRadius,
    status: row.status ?? "ALIVE",
    stats: {
      hpCurrent: requireNum(stats?.hp_current, "hp_current", enemyDef.id),
      hpMax: requireNum(stats?.hp_max, "hp_max", enemyDef.id),
      moveSpeed: requireNum(stats?.move_speed, "move_speed", enemyDef.id),
      attackSpeed: requireNum(stats?.attack_speed, "attack_speed", enemyDef.id),
      attackPower,
      defense,
      attackRange,
    },
    _combatDebug: {
      attackPowerSource: "ga_enemy_def_stats",
    },
    spawnedAt: row.spawned_at ?? null,
    deadAt: row.dead_at ?? null,
    respawnAt: row.respawn_at ?? null,
    action: "idle",
    rev: 0,
    dirty: false,
    _db: debug,
  };
}

module.exports = {
  requireNum,
  normalizeLoadedEnemy,
};
