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
  position,
  patrolRadius,
  patrolWaitMs,
  patrolStopRadius,
  enemyDef,
  enemyDefId = null,
  hpCurrent,
  hpMax,
  moveSpeed,
  attackSpeed,
  attackPower,
  defense,
  attackRange,
  spawnInstanceId = null,
  spawnDefEnemyId = null,
  spawnInstanceEnemyId = null,
  debug = null,
}) {
  return {
    id: String(row.id),
    instanceId: String(instanceId),
    spawnInstanceId: spawnInstanceId == null ? null : Number(spawnInstanceId),
    spawnDefEnemyId: spawnDefEnemyId == null ? null : Number(spawnDefEnemyId),
    spawnInstanceEnemyId:
      spawnInstanceEnemyId == null ? null : Number(spawnInstanceEnemyId),
    enemyDefId: Number(enemyDefId ?? enemyDef?.id),
    enemyDefCode: enemyDef?.code ?? null,
    enemyDefName: enemyDef?.name ?? null,
    displayName: enemyDef?.name ?? enemyDef?.code ?? `Enemy ${row.id}`,
    visualKind: enemyDef?.visual_kind ?? "DEFAULT",
    collisionRadius: Number(enemyDef?.collision_radius),
    pos: {
      x: Number(position?.x ?? originPos.x),
      z: Number(position?.z ?? originPos.z),
    },
    spawnOriginPos: {
      x: Number(originPos.x),
      z: Number(originPos.z),
    },
    yaw: 0,
    homePos: {
      x: Number(originPos.x),
      z: Number(originPos.z),
    },
    patrolRadius,
    patrolWaitMs,
    patrolStopRadius,
    status: row.status ?? "ALIVE",
    stats: {
      hpCurrent: requireNum(hpCurrent, "hp_current", enemyDef.id),
      hpMax: requireNum(hpMax, "hp_max", enemyDef.id),
      moveSpeed: requireNum(moveSpeed, "move_speed", enemyDef.id),
      attackSpeed: requireNum(attackSpeed, "attack_speed", enemyDef.id),
      attackPower,
      defense,
      attackRange,
    },
    _combatDebug: {
      attackPowerSource: "ga_enemy_def_stats",
    },
    spawnedAt: null,
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
