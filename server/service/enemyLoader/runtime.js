"use strict";

const db = require("../../models");
const { requireNum, normalizeLoadedEnemy } = require("./shared");

async function loadEnemiesFromRuntime(instanceId) {
  const rows = await db.GaEnemyRuntime.findAll({
    where: {
      status: "ALIVE",
    },
    include: [
      {
        association: "spawnInstance",
        required: true,
        attributes: ["id", "instance_id", "pos_x", "pos_z", "yaw"],
        where: {
          instance_id: Number(instanceId),
        },
        include: [
          {
            association: "spawnDef",
            required: true,
            attributes: [
              "id",
              "code",
              "name",
              "shape_kind",
              "radius",
              "max_alive",
              "respawn_ms",
              "patrol_radius",
              "patrol_wait_ms",
              "patrol_stop_radius",
            ],
          },
        ],
      },
      {
        association: "spawnDefComponent",
        required: false,
        attributes: ["id", "spawn_def_id", "enemy_def_id", "quantity", "sort_order"],
      },
      {
        association: "enemyDef",
        required: true,
        attributes: ["id", "code", "name", "visual_kind", "collision_radius", "ai_profile_json"],
        include: [
          {
            association: "baseStats",
            required: true,
            attributes: ["hp_max", "move_speed", "attack_speed", "attack_power", "defense", "attack_range"],
          },
        ],
      },
      {
        association: "stats",
        required: true,
        attributes: ["enemy_runtime_id", "hp_current", "hp_max", "move_speed", "attack_speed"],
      },
    ],
    order: [["id", "ASC"]],
  });

  return rows.map((row) => {
    const spawnInstance = row.spawnInstance;
    const spawnDef = spawnInstance.spawnDef;
    const enemyDef = row.enemyDef;
    const baseStats = enemyDef.baseStats;

    return normalizeLoadedEnemy({
      row,
      instanceId: spawnInstance.instance_id,
      originPos: {
        x: Number(spawnInstance.pos_x),
        z: Number(spawnInstance.pos_z),
      },
      patrolRadius: requireNum(spawnDef.patrol_radius, "patrol_radius", spawnDef.id),
      patrolWaitMs: requireNum(spawnDef.patrol_wait_ms, "patrol_wait_ms", spawnDef.id),
      patrolStopRadius: requireNum(spawnDef.patrol_stop_radius, "patrol_stop_radius", spawnDef.id),
      stats: row.stats,
      enemyDef,
      attackPower: requireNum(baseStats.attack_power, "attack_power", enemyDef.id),
      defense: requireNum(baseStats.defense, "defense", enemyDef.id),
      attackRange: requireNum(baseStats.attack_range, "attack_range", enemyDef.id),
      spawnInstanceId: row.spawn_instance_id,
      spawnDefComponentId: row.spawn_def_component_id,
      spawnPointId: row.spawn_instance_id,
      spawnEntryId: row.spawn_def_component_id,
      debug: {
        spawnDefId: Number(spawnDef.id),
        spawnDefComponentEnemyDefId: Number(row.spawnDefComponent?.enemy_def_id),
        spawnDefComponentQuantity: Number(row.spawnDefComponent?.quantity ?? 0),
        spawnDefComponentSortOrder: Number(row.spawnDefComponent?.sort_order ?? 0),
        spawnInstanceId: Number(spawnInstance.id),
      },
    });
  });
}

async function loadEnemiesForInstance(instanceId) {
  if (instanceId == null) return [];
  return loadEnemiesFromRuntime(instanceId);
}

module.exports = {
  loadEnemiesForInstance,
};
