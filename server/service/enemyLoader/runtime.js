"use strict";

const db = require("../../models");
const { requireNum, normalizeLoadedEnemy } = require("./shared");
const {
  getEnemy,
  addEnemy,
  getAliveEnemiesForSpawnInstance,
} = require("../../state/enemies/enemiesRuntimeStore");

const DEFAULT_SPAWN_SHAPE_KIND = "POINT";
const DEFAULT_SPAWN_RADIUS = 6;

function generatePointPos(baseX, baseZ) {
  return { x: Number(baseX), z: Number(baseZ) };
}

function generateCirclePos(baseX, baseZ, radius) {
  const safeRadius =
    Number.isFinite(Number(radius)) && Number(radius) > 0
      ? Number(radius)
      : DEFAULT_SPAWN_RADIUS;
  const angle = Math.random() * 2 * Math.PI;
  const dist = Math.random() * safeRadius;
  return {
    x: Number(baseX) + dist * Math.cos(angle),
    z: Number(baseZ) + dist * Math.sin(angle),
  };
}

function materializeEnemyPosition(spawnInstanceEnemy, spawnInstance, spawnDef) {
  const existing = getEnemy(spawnInstanceEnemy.id);
  if (existing?.pos) {
    return {
      x: Number(existing.pos.x),
      z: Number(existing.pos.z),
    };
  }

  const baseX = Number(spawnInstance.pos_x);
  const baseZ = Number(spawnInstance.pos_z);
  const shapeKind = String(spawnDef.shape_kind ?? DEFAULT_SPAWN_SHAPE_KIND).toUpperCase();
  if (shapeKind === "CIRCLE") {
    return generateCirclePos(baseX, baseZ, spawnDef.radius);
  }
  return generatePointPos(baseX, baseZ);
}

function toRuntimeEnemy(spawnInstanceEnemy) {
  const spawnInstance = spawnInstanceEnemy.spawnInstance;
  const spawnDef = spawnInstance?.spawnDef;
  const spawnDefEnemy = spawnInstanceEnemy.spawnDefEnemy;
  const enemyDef = spawnDefEnemy?.enemyDef;
  const baseStats = enemyDef?.baseStats;
  if (!spawnInstance || !spawnDef || !spawnDefEnemy || !enemyDef || !baseStats) {
    return null;
  }

  const position = materializeEnemyPosition(spawnInstanceEnemy, spawnInstance, spawnDef);

  return normalizeLoadedEnemy({
    row: spawnInstanceEnemy,
    instanceId: spawnInstance.instance_id,
    originPos: {
      x: Number(spawnInstance.pos_x),
      z: Number(spawnInstance.pos_z),
    },
    position,
    patrolRadius: requireNum(spawnDef.patrol_radius, "patrol_radius", spawnDef.id),
    patrolWaitMs: requireNum(spawnDef.patrol_wait_ms, "patrol_wait_ms", spawnDef.id),
    patrolStopRadius: requireNum(
      spawnDef.patrol_stop_radius,
      "patrol_stop_radius",
      spawnDef.id
    ),
    enemyDef,
    enemyDefId: spawnDefEnemy.enemy_def_id,
    hpCurrent: Number(spawnInstanceEnemy.hp_current),
    hpMax: requireNum(baseStats.hp_max, "hp_max", enemyDef.id),
    moveSpeed: requireNum(baseStats.move_speed, "move_speed", enemyDef.id),
    attackSpeed: requireNum(baseStats.attack_speed, "attack_speed", enemyDef.id),
    attackPower: requireNum(baseStats.attack_power, "attack_power", enemyDef.id),
    defense: requireNum(baseStats.defense, "defense", enemyDef.id),
    attackRange: requireNum(baseStats.attack_range, "attack_range", enemyDef.id),
    spawnInstanceId: spawnInstanceEnemy.spawn_instance_id,
    spawnDefEnemyId: spawnInstanceEnemy.spawn_def_enemy_id,
    spawnInstanceEnemyId: spawnInstanceEnemy.id,
    debug: {
      spawnDefId: Number(spawnDef.id),
      spawnDefEnemyId: Number(spawnDefEnemy.id),
      spawnDefEnemyEnemyDefId: Number(spawnDefEnemy.enemy_def_id),
      spawnDefEnemyQuantity: Number(spawnDefEnemy.quantity ?? 0),
      spawnDefEnemySortOrder: Number(spawnDefEnemy.sort_order ?? 0),
      spawnInstanceId: Number(spawnInstance.id),
      slotIndex: Number(spawnInstanceEnemy.slot_index ?? 0),
    },
  });
}

async function loadEnemiesFromSlots(instanceId) {
  const rows = await db.GaSpawnInstanceEnemy.findAll({
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
        association: "spawnDefEnemy",
        required: true,
        attributes: ["id", "spawn_def_id", "enemy_def_id", "quantity", "sort_order"],
        include: [
          {
            association: "enemyDef",
            required: true,
            attributes: [
              "id",
              "code",
              "name",
              "visual_kind",
              "asset_key",
              "visual_scale",
              "collision_radius",
              "ai_profile_json",
            ],
            include: [
              {
                association: "baseStats",
                required: true,
                attributes: [
                  "hp_max",
                  "move_speed",
                  "attack_speed",
                  "attack_power",
                  "defense",
                  "attack_range",
                ],
              },
            ],
          },
        ],
      },
    ],
    order: [
      ["id", "ASC"],
      [{ model: db.GaSpawnDefEnemy, as: "spawnDefEnemy" }, "sort_order", "ASC"],
      ["slot_index", "ASC"],
    ],
  });

  const loaded = [];
  for (const row of rows) {
    const runtimeEnemy = toRuntimeEnemy(row);
    if (!runtimeEnemy) continue;

    if (
      String(runtimeEnemy.enemyDefCode ?? "").toUpperCase() === "WILD_RABBIT" ||
      String(runtimeEnemy.displayName ?? "").toUpperCase().includes("RABBIT")
    ) {
      console.log(
        `[ENEMY_LOADER] enemy=${runtimeEnemy.id} code=${runtimeEnemy.enemyDefCode} visualScale=${runtimeEnemy.visualScale}`
      );
    }

    const existing = getEnemy(runtimeEnemy.id);
    if (!existing) {
      addEnemy(runtimeEnemy);
      loaded.push(getEnemy(runtimeEnemy.id) ?? runtimeEnemy);
      continue;
    }

    existing.status = runtimeEnemy.status;
    existing.displayName = runtimeEnemy.displayName;
    existing.enemyDefId = runtimeEnemy.enemyDefId;
    existing.enemyDefCode = runtimeEnemy.enemyDefCode;
    existing.enemyDefName = runtimeEnemy.enemyDefName;
    existing.visualKind = runtimeEnemy.visualKind;
    existing.collisionRadius = runtimeEnemy.collisionRadius;
    existing.visualScale = runtimeEnemy.visualScale;
    existing.spawnInstanceId = runtimeEnemy.spawnInstanceId;
    existing.spawnDefEnemyId = runtimeEnemy.spawnDefEnemyId;
    existing.spawnInstanceEnemyId = runtimeEnemy.spawnInstanceEnemyId;
    existing.spawnOriginPos = runtimeEnemy.spawnOriginPos;
    existing.homePos = runtimeEnemy.homePos;
    existing.patrolRadius = runtimeEnemy.patrolRadius;
    existing.patrolWaitMs = runtimeEnemy.patrolWaitMs;
    existing.patrolStopRadius = runtimeEnemy.patrolStopRadius;
    existing.stats = {
      ...(existing.stats ?? {}),
      ...runtimeEnemy.stats,
    };
    loaded.push(existing);
  }

  return loaded;
}

async function loadEnemiesForInstance(instanceId) {
  if (instanceId == null) return [];

  const aliveInStore = getAliveEnemiesForSpawnInstance(Number(instanceId));
  if (aliveInStore.length > 0) {
    await loadEnemiesFromSlots(instanceId);
    return getAliveEnemiesForSpawnInstance(Number(instanceId));
  }

  return loadEnemiesFromSlots(instanceId);
}

module.exports = {
  loadEnemiesForInstance,
};
