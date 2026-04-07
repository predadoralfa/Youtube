"use strict";

const db = require("../../models");
const {
  getAliveEnemiesForSpawnPoint,
  getAliveEnemiesForSpawnEntry,
  addEnemy,
} = require("../enemies/enemiesRuntimeStore");
const { emitEnemySpawn } = require("../enemies/enemyEmit");
const {
  DEFAULT_SPAWN_SHAPE_KIND,
  DEFAULT_SPAWN_RADIUS,
  DEFAULT_SPAWN_MAX_ALIVE,
  DEFAULT_SPAWN_QUANTITY_MIN,
  DEFAULT_SPAWN_QUANTITY_MAX,
} = require("./spawnConfig");
const {
  resolveInstanceSpawnConfig,
  computeEffectiveRespawnMs,
  computeEffectiveMaxAlive,
  computeEffectiveSpawnQuantity,
} = require("../../service/enemyRespawnService");

function requireNum(value, label, entityId) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid numeric field ${label} for entity=${entityId}`);
  }
  return n;
}

function generatePointPos(baseX, baseZ) {
  return { x: Number(baseX), z: Number(baseZ) };
}

function generateCirclePos(baseX, baseZ, radius) {
  const r = Number.isFinite(Number(radius)) && Number(radius) > 0 ? Number(radius) : DEFAULT_SPAWN_RADIUS;
  const angle = Math.random() * 2 * Math.PI;
  const dist = Math.random() * r;
  return {
    x: Number(baseX) + dist * Math.cos(angle),
    z: Number(baseZ) + dist * Math.sin(angle),
  };
}

function selectWeightedEntry(candidateEntries) {
  if (!candidateEntries || candidateEntries.length === 0) return null;

  const totalWeight = candidateEntries.reduce(
    (sum, entry) => sum + requireNum(entry.weight, "weight", entry.id),
    0
  );
  if (totalWeight <= 0) return null;

  let random = Math.random() * totalWeight;
  for (const entry of candidateEntries) {
    const weight = requireNum(entry.weight, "weight", entry.id);
    if (random < weight) return entry;
    random -= weight;
  }

  return null;
}

function determineSpawnQuantity(entry, instanceSpawnConfig, remainingCapacity) {
  const qMinRaw = Number(entry.quantity_min);
  const qMaxRaw = Number(entry.quantity_max);
  const qMin = Number.isFinite(qMinRaw) ? qMinRaw : DEFAULT_SPAWN_QUANTITY_MIN;
  const qMax = Number.isFinite(qMaxRaw) ? qMaxRaw : DEFAULT_SPAWN_QUANTITY_MAX;
  const desired = Math.floor(Math.random() * (qMax - qMin + 1)) + qMin;

  return computeEffectiveSpawnQuantity(desired, instanceSpawnConfig, remainingCapacity);
}

function buildEnemyRuntimeData({
  enemyInstance,
  enemyDef,
  selectedEntry,
  instanceId,
  hpCurrent,
  hpMax,
  moveSpeed,
  attackSpeed,
  attackPower,
  defense,
  attackRange,
  patrolRadius,
  patrolWaitMs,
  patrolStopRadius,
}) {
  return {
    id: enemyInstance.id,
    instanceId: String(instanceId),
    spawnPointId: enemyInstance.spawn_point_id,
    spawnEntryId: selectedEntry.id,
    enemyDefId: enemyDef.id,
    enemyDefCode: enemyDef.code,
    displayName: enemyDef.name || enemyDef.code,
    pos: {
      x: Number(enemyInstance.pos_x),
      z: Number(enemyInstance.pos_z),
    },
    yaw: Number(enemyInstance.yaw ?? 0),
    homePos: {
      x: Number(enemyInstance.home_x),
      z: Number(enemyInstance.home_z),
    },
    status: "ALIVE",
    stats: {
      hpCurrent,
      hpMax,
      moveSpeed,
      attackSpeed,
      attackPower,
      defense,
      attackRange,
    },
    patrolRadius,
    patrolWaitMs,
    patrolStopRadius,
    rev: 0,
    dirty: false,
  };
}

async function loadEnemyDefBundle(enemyDefId) {
  return db.GaEnemyDef.findByPk(enemyDefId, {
    include: [
      {
        association: "baseStats",
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
  });
}

async function findRespawnableDeadEnemies(spawnPointId, nowMs) {
  return db.GaEnemyInstance.findAll({
    where: {
      spawn_point_id: Number(spawnPointId),
      status: "DEAD",
      respawn_at: {
        [db.Sequelize.Op.lte]: new Date(nowMs),
      },
    },
    include: [
      {
        association: "spawnEntry",
        required: true,
        attributes: ["id", "enemy_def_id", "spawn_point_id"],
      },
      {
        association: "enemyDef",
        required: true,
        attributes: ["id", "code", "name"],
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
      {
        association: "stats",
        required: false,
        attributes: ["enemy_instance_id", "hp_current", "hp_max", "move_speed", "attack_speed"],
      },
    ],
    order: [
      ["respawn_at", "ASC"],
      ["dead_at", "ASC"],
      ["id", "ASC"],
    ],
  });
}

async function respawnDeadEnemy(deadEnemy, spawner, instanceId, io = null) {
  const enemyDef = deadEnemy.enemyDef;
  const selectedEntry = deadEnemy.spawnEntry;
  if (!enemyDef?.baseStats || !selectedEntry) {
    return null;
  }

  const baseStats = enemyDef.baseStats;
  const hpMax = requireNum(baseStats.hp_max, "hp_max", enemyDef.id);
  const moveSpeed = requireNum(baseStats.move_speed, "move_speed", enemyDef.id);
  const attackSpeed = requireNum(baseStats.attack_speed, "attack_speed", enemyDef.id);
  const attackPower = requireNum(baseStats.attack_power, "attack_power", enemyDef.id);
  const defense = requireNum(baseStats.defense, "defense", enemyDef.id);
  const attackRange = requireNum(baseStats.attack_range, "attack_range", enemyDef.id);

  const patrolRadius = requireNum(spawner.patrol_radius, "patrol_radius", spawner.id);
  const patrolWaitMs = requireNum(spawner.patrol_wait_ms, "patrol_wait_ms", spawner.id);
  const patrolStopRadius = requireNum(spawner.patrol_stop_radius, "patrol_stop_radius", spawner.id);

  const shapeKind = String(spawner.shape_kind ?? DEFAULT_SPAWN_SHAPE_KIND);
  const spawnX = Number(spawner.pos_x);
  const spawnZ = Number(spawner.pos_z);
  const radiusRaw = Number(spawner.radius);
  const radius = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : DEFAULT_SPAWN_RADIUS;
  const spawnPos =
    shapeKind === "CIRCLE"
      ? generateCirclePos(spawnX, spawnZ, radius)
      : generatePointPos(spawnX, spawnZ);

  await deadEnemy.update({
    status: "ALIVE",
    pos_x: spawnPos.x,
    pos_z: spawnPos.z,
    yaw: 0,
    home_x: spawnPos.x,
    home_z: spawnPos.z,
    spawned_at: new Date(),
    dead_at: null,
    respawn_at: null,
  });

  if (deadEnemy.stats) {
    await deadEnemy.stats.update({
      hp_current: hpMax,
      hp_max: hpMax,
      move_speed: moveSpeed,
      attack_speed: attackSpeed,
    });
  } else {
    await db.GaEnemyInstanceStats.create({
      enemy_instance_id: deadEnemy.id,
      hp_current: hpMax,
      hp_max: hpMax,
      move_speed: moveSpeed,
      attack_speed: attackSpeed,
    });
  }

  const runtimeData = buildEnemyRuntimeData({
    enemyInstance: deadEnemy,
    enemyDef,
    selectedEntry,
    instanceId,
    hpCurrent: hpMax,
    hpMax,
    moveSpeed,
    attackSpeed,
    attackPower,
    defense,
    attackRange,
    patrolRadius,
    patrolWaitMs,
    patrolStopRadius,
  });

  addEnemy(runtimeData);
  if (io) emitEnemySpawn(io, runtimeData);
  return runtimeData;
}

async function createFreshEnemy(spawner, selectedEntry, instanceId, nowMs, io = null) {
  const enemyDef = await loadEnemyDefBundle(selectedEntry.enemy_def_id);
  if (!enemyDef?.baseStats) {
    console.warn(`[SPAWN] enemyDef=${selectedEntry.enemy_def_id} ou stats nao encontrados`);
    return null;
  }

  const baseStats = enemyDef.baseStats;
  const hpMax = requireNum(baseStats.hp_max, "hp_max", enemyDef.id);
  const moveSpeed = requireNum(baseStats.move_speed, "move_speed", enemyDef.id);
  const attackSpeed = requireNum(baseStats.attack_speed, "attack_speed", enemyDef.id);
  const attackPower = requireNum(baseStats.attack_power, "attack_power", enemyDef.id);
  const defense = requireNum(baseStats.defense, "defense", enemyDef.id);
  const attackRange = requireNum(baseStats.attack_range, "attack_range", enemyDef.id);

  const shapeKind = String(spawner.shape_kind ?? DEFAULT_SPAWN_SHAPE_KIND);
  const spawnX = Number(spawner.pos_x);
  const spawnZ = Number(spawner.pos_z);
  const radiusRaw = Number(spawner.radius);
  const radius = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : DEFAULT_SPAWN_RADIUS;
  const patrolRadius = requireNum(spawner.patrol_radius, "patrol_radius", spawner.id);
  const patrolWaitMs = requireNum(spawner.patrol_wait_ms, "patrol_wait_ms", spawner.id);
  const patrolStopRadius = requireNum(spawner.patrol_stop_radius, "patrol_stop_radius", spawner.id);

  const spawnPos =
    shapeKind === "CIRCLE"
      ? generateCirclePos(spawnX, spawnZ, radius)
      : generatePointPos(spawnX, spawnZ);

  const enemyInstance = await db.GaEnemyInstance.create(
    {
      spawn_point_id: spawner.id,
      spawn_entry_id: selectedEntry.id,
      enemy_def_id: enemyDef.id,
      status: "ALIVE",
      pos_x: spawnPos.x,
      pos_z: spawnPos.z,
      yaw: 0,
      home_x: spawnPos.x,
      home_z: spawnPos.z,
      spawned_at: new Date(nowMs),
    },
    { returning: true }
  );

  await db.GaEnemyInstanceStats.create({
    enemy_instance_id: enemyInstance.id,
    hp_current: hpMax,
    hp_max: hpMax,
    move_speed: moveSpeed,
    attack_speed: attackSpeed,
  });

  const runtimeData = buildEnemyRuntimeData({
    enemyInstance,
    enemyDef,
    selectedEntry,
    instanceId,
    hpCurrent: hpMax,
    hpMax,
    moveSpeed,
    attackSpeed,
    attackPower,
    defense,
    attackRange,
    patrolRadius,
    patrolWaitMs,
    patrolStopRadius,
  });

  addEnemy(runtimeData);
  if (io) emitEnemySpawn(io, runtimeData);
  return runtimeData;
}

async function processSpawner(spawner, nowMs, io = null) {
  const instanceId = spawner.instance?.id ?? spawner.instance_id;
  if (!instanceId) {
    console.warn(`[SPAWN] ERROR: spawner=${spawner.id} sem instanceId`);
    return;
  }

  const instanceSpawnConfig = resolveInstanceSpawnConfig(spawner.instance);
  if (!instanceSpawnConfig.enemySpawnEnabled) {
    console.log(`[SPAWN] spawner=${spawner.id} desabilitado pela config da instancia=${instanceId}`);
    return;
  }

  const effectiveMaxAlive = computeEffectiveMaxAlive(spawner, instanceSpawnConfig);
  const maxAlive =
    effectiveMaxAlive > 0
      ? effectiveMaxAlive
      : Math.max(0, Number(spawner.max_alive ?? DEFAULT_SPAWN_MAX_ALIVE));

  if (maxAlive <= 0) {
    console.log(`[SPAWN] spawner=${spawner.id} maxAlive efetivo=0`);
    return;
  }

  const aliveEnemies = getAliveEnemiesForSpawnPoint(spawner.id);
  let aliveCount = aliveEnemies.length;
  console.log(`[SPAWN] spawner=${spawner.id} instanceId=${instanceId} vivos=${aliveCount} max=${maxAlive}`);

  if (aliveCount >= maxAlive) return;

  const entries = spawner.entries || [];
  if (entries.length === 0) {
    console.log(`[SPAWN] spawner=${spawner.id} sem entries ativas`);
    return;
  }

  const respawnableDeadEnemies = await findRespawnableDeadEnemies(spawner.id, nowMs);
  if (respawnableDeadEnemies.length > 0) {
    for (const deadEnemy of respawnableDeadEnemies) {
      if (aliveCount >= maxAlive) break;

      const aliveLimit = deadEnemy.spawnEntry?.alive_limit;
      const aliveOfType = getAliveEnemiesForSpawnEntry(spawner.id, deadEnemy.spawnEntry.id);
      if (aliveLimit != null && aliveOfType.length >= Number(aliveLimit)) {
        continue;
      }

      const respawned = await respawnDeadEnemy(deadEnemy, spawner, instanceId, io);
      if (respawned) {
        aliveCount += 1;
      }
    }
  }

  if (aliveCount >= maxAlive) return;

  const candidateEntries = [];
  for (const entry of entries) {
    const aliveLimit = entry.alive_limit;
    if (aliveLimit == null) {
      candidateEntries.push(entry);
      continue;
    }

    const aliveOfType = getAliveEnemiesForSpawnEntry(spawner.id, entry.id);
    if (aliveOfType.length < Number(aliveLimit)) {
      candidateEntries.push(entry);
    }
  }

  if (candidateEntries.length === 0) return;

  const selectedEntry = selectWeightedEntry(candidateEntries);
  if (!selectedEntry) return;

  const remainingCapacity = maxAlive - aliveCount;
  const spawnCount = determineSpawnQuantity(selectedEntry, instanceSpawnConfig, remainingCapacity);
  if (spawnCount <= 0) return;

  console.log(
    `[SPAWN] spawner=${spawner.id} criando=${spawnCount} entry=${selectedEntry.id} enemyDefId=${selectedEntry.enemy_def_id}`
  );

  for (let i = 0; i < spawnCount; i++) {
    const created = await createFreshEnemy(spawner, selectedEntry, instanceId, nowMs, io);
    if (!created) break;
  }
}

async function spawnTick(nowMs, io = null) {
  try {
    const spawners = await db.GaSpawnPoint.findAll({
      where: {
        status: "ACTIVE",
      },
      include: [
        {
          association: "entries",
          where: { status: "ACTIVE" },
          required: false,
        },
        {
          association: "instance",
          attributes: ["id"],
          required: false,
          include: [
            {
              association: "spawnConfig",
              required: false,
            },
          ],
        },
      ],
    });

    if (!spawners || spawners.length === 0) {
      return;
    }

    for (const spawner of spawners) {
      try {
        await processSpawner(spawner, nowMs, io);
      } catch (err) {
        console.error(`[SPAWN] Error processing spawner=${spawner.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[SPAWN] spawnTick error:", err);
  }
}

module.exports = {
  spawnTick,
};
