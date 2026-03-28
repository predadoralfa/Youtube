// server/service/enemyLoader.js

const db = require("../models");
const { readEnemyAttackPower } = require("./enemyCombatProfile");

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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
        attributes: ["id", "instance_id"],
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
            attributes: ["hp_max", "move_speed", "attack_speed", "attack_power"],
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

    const attackPower = readEnemyAttackPower(
      enemyDef?.baseStats ?? enemyDef?.ai_profile_json,
      5
    );

    out.push({
      id: String(row.id),
      instanceId: String(spawnPoint.instance_id),
      spawnPointId: toNum(row.spawn_point_id),
      spawnEntryId: toNum(row.spawn_entry_id),
      enemyDefId: toNum(row.enemy_def_id),

      // útil para baseline/render sem nova ida ao banco
      enemyDefCode: enemyDef?.code ?? null,
      enemyDefName: enemyDef?.name ?? null,
      visualKind: enemyDef?.visual_kind ?? "DEFAULT",
      collisionRadius: toNum(enemyDef?.collision_radius, 0.5),

      pos: {
        x: toNum(row.pos_x, 0),
        z: toNum(row.pos_z, 0),
      },

      yaw: toNum(row.yaw, 0),

      homePos: {
        x: toNum(row.home_x ?? row.pos_x, 0),
        z: toNum(row.home_z ?? row.pos_z, 0),
      },

      status: row.status ?? "ALIVE",

      stats: {
        hpCurrent: toNum(stats?.hp_current, 0),
        hpMax: toNum(stats?.hp_max, 0),
        moveSpeed: toNum(stats?.move_speed, 0),
        attackSpeed: toNum(stats?.attack_speed, 0),
        attackPower,
      },
      _combatDebug: {
        attackPowerSource: enemyDef?.ai_profile_json ?? null,
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
        spawnEntryEnemyDefId: toNum(spawnEntry?.enemy_def_id, 0),
        spawnEntrySpawnPointId: toNum(spawnEntry?.spawn_point_id, 0),
      },
    });
  }

  return out;
}

module.exports = {
  loadEnemiesForInstance,
};
