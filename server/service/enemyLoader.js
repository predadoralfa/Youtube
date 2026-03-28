// server/service/enemyLoader.js

const db = require("../models");

function requireNum(v, label, enemyId) {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid enemy stat ${label} for enemyDefId=${enemyId}`);
  }
  return n;
}

/**
 * Carrega inimigos vivos de uma instância a partir do banco
 * e devolve no shape compatível com enemiesRuntimeStore.addEnemy().
 *
 * Fonte da verdade da instância:
 *   ga_enemy_instance -> spawn_point_id -> ga_spawn_point.instance_id
 *
 * Não depende de socket.
 * Não escreve no runtime store.
 * Apenas lê e normaliza.
 */
async function loadEnemiesForInstance(instanceId) {
  if (instanceId == null) return [];

  const rows = await db.GaEnemyInstance.findAll({
    where: {
      status: "ALIVE",
    },
    include: [
      {
        association: "spawnPoint",
        required: true,
        attributes: ["id", "instance_id", "patrol_radius", "patrol_wait_ms", "patrol_stop_radius"],
        where: {
          instance_id: Number(instanceId),
        },
      },
      {
        association: "spawnEntry",
        required: false,
        attributes: ["id", "spawn_point_id", "enemy_def_id"],
      },
        {
          association: "enemyDef",
          required: false,
          attributes: ["id", "code", "name", "visual_kind", "collision_radius", "ai_profile_json"],
          include: [
            {
              association: "baseStats",
              required: false,
              attributes: ["hp_max", "move_speed", "attack_speed", "attack_power", "defense", "attack_range"],
            },
          ],
        },
      {
        association: "stats",
        required: false,
        attributes: ["enemy_instance_id", "hp_current", "hp_max", "move_speed", "attack_speed"],
      },
    ],
    order: [["id", "ASC"]],
  });

  const out = [];

  for (const row of rows) {
    const spawnPoint = row.spawnPoint;
    if (!spawnPoint) continue;

    const stats = row.stats;
    const enemyDef = row.enemyDef;
    const spawnEntry = row.spawnEntry;
    const patrolRadius = requireNum(spawnPoint.patrol_radius, "patrol_radius", spawnPoint.id);
    const patrolWaitMs = requireNum(spawnPoint.patrol_wait_ms, "patrol_wait_ms", spawnPoint.id);
    const patrolStopRadius = requireNum(spawnPoint.patrol_stop_radius, "patrol_stop_radius", spawnPoint.id);

    if (!enemyDef?.baseStats) {
      throw new Error(`Missing ga_enemy_def_stats for enemyDefId=${enemyDef?.id ?? "unknown"}`);
    }

    const baseStats = enemyDef.baseStats;
    const attackPower = requireNum(baseStats.attack_power, "attack_power", enemyDef.id);
    const defense = requireNum(baseStats.defense, "defense", enemyDef.id);
    const attackRange = requireNum(baseStats.attack_range, "attack_range", enemyDef.id);

    out.push({
      id: String(row.id),
      instanceId: String(spawnPoint.instance_id),
      spawnPointId: Number(row.spawn_point_id),
      spawnEntryId: Number(row.spawn_entry_id),
      enemyDefId: Number(row.enemy_def_id),

      // útil para baseline/render sem nova ida ao banco
      enemyDefCode: enemyDef?.code ?? null,
      enemyDefName: enemyDef?.name ?? null,
      visualKind: enemyDef?.visual_kind ?? "DEFAULT",
      collisionRadius: Number(enemyDef?.collision_radius),

      pos: {
        x: Number(row.pos_x),
        z: Number(row.pos_z),
      },

      yaw: Number(row.yaw),

      homePos: {
        x: Number(row.home_x ?? row.pos_x),
        z: Number(row.home_z ?? row.pos_z),
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

      // runtime metadata
      action: "idle",
      rev: 0,
      dirty: false,

      // opcionais para debug/uso futuro
      _db: {
        spawnEntryEnemyDefId: Number(spawnEntry?.enemy_def_id),
        spawnEntrySpawnPointId: Number(spawnEntry?.spawn_point_id),
      },
    });
  }

  return out;
}

module.exports = {
  loadEnemiesForInstance,
};
