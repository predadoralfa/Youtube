"use strict";

const db = require("../../models");
const { addEnemy } = require("../enemies/enemiesRuntimeStore");
const { emitEnemySpawn } = require("../enemies/enemyEmit");
const { DEFAULT_SPAWN_SHAPE_KIND, DEFAULT_SPAWN_RADIUS } = require("./spawnConfig");
const { resolveInstanceSpawnConfig } = require("../../service/enemyRespawnService");

const _lastSpawnerTickAtMs = new Map();

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
  const r =
    Number.isFinite(Number(radius)) && Number(radius) > 0
      ? Number(radius)
      : DEFAULT_SPAWN_RADIUS;
  const angle = Math.random() * 2 * Math.PI;
  const dist = Math.random() * r;
  return {
    x: Number(baseX) + dist * Math.cos(angle),
    z: Number(baseZ) + dist * Math.sin(angle),
  };
}

function buildEnemyRuntimeData({
  enemyRuntime,
  enemyDef,
  selectedComponent,
  spawnInstance,
  spawnDef,
  hpCurrent,
  hpMax,
  moveSpeed,
  attackSpeed,
  attackPower,
  defense,
  attackRange,
}) {
  const originPos = {
    x: Number(spawnInstance.pos_x),
    z: Number(spawnInstance.pos_z),
  };

  return {
    id: enemyRuntime.id,
    instanceId: String(spawnInstance.instance_id),
    spawnInstanceId: enemyRuntime.spawn_instance_id,
    spawnDefComponentId: selectedComponent.id,
    spawnPointId: enemyRuntime.spawn_instance_id,
    spawnEntryId: selectedComponent.id,
    enemyDefId: enemyDef.id,
    enemyDefCode: enemyDef.code,
    enemyDefName: enemyDef.name ?? enemyDef.code,
    displayName: enemyDef.name || enemyDef.code,
    pos: {
      x: Number(enemyRuntime.pos_x),
      z: Number(enemyRuntime.pos_z),
    },
    spawnOriginPos: originPos,
    yaw: Number(enemyRuntime.yaw ?? 0),
    homePos: originPos,
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
    patrolRadius: requireNum(spawnDef.patrol_radius, "patrol_radius", spawnDef.id),
    patrolWaitMs: requireNum(spawnDef.patrol_wait_ms, "patrol_wait_ms", spawnDef.id),
    patrolStopRadius: requireNum(spawnDef.patrol_stop_radius, "patrol_stop_radius", spawnDef.id),
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

async function findRespawnableDeadEnemies(spawnInstanceId, nowMs) {
  return db.GaEnemyRuntime.findAll({
    where: {
      spawn_instance_id: Number(spawnInstanceId),
      status: "DEAD",
      respawn_at: {
        [db.Sequelize.Op.lte]: new Date(nowMs),
      },
    },
    include: [
      {
        association: "spawnDefComponent",
        required: true,
        attributes: ["id", "enemy_def_id", "spawn_def_id", "alive_limit"],
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
        attributes: ["enemy_runtime_id", "hp_current", "hp_max", "move_speed", "attack_speed"],
      },
    ],
    order: [
      ["respawn_at", "ASC"],
      ["dead_at", "ASC"],
      ["id", "ASC"],
    ],
  });
}

async function respawnDeadEnemy(deadEnemy, spawnInstance, spawnDef, io = null) {
  const enemyDef = deadEnemy.enemyDef;
  const selectedComponent = deadEnemy.spawnDefComponent;
  if (!enemyDef?.baseStats || !selectedComponent) {
    return null;
  }

  const baseStats = enemyDef.baseStats;
  const hpMax = requireNum(baseStats.hp_max, "hp_max", enemyDef.id);
  const moveSpeed = requireNum(baseStats.move_speed, "move_speed", enemyDef.id);
  const attackSpeed = requireNum(baseStats.attack_speed, "attack_speed", enemyDef.id);
  const attackPower = requireNum(baseStats.attack_power, "attack_power", enemyDef.id);
  const defense = requireNum(baseStats.defense, "defense", enemyDef.id);
  const attackRange = requireNum(baseStats.attack_range, "attack_range", enemyDef.id);

  const shapeKind = String(spawnDef.shape_kind ?? DEFAULT_SPAWN_SHAPE_KIND);
  const spawnX = Number(spawnInstance.pos_x);
  const spawnZ = Number(spawnInstance.pos_z);
  const radiusRaw = Number(spawnDef.radius);
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
    home_x: spawnX,
    home_z: spawnZ,
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
    await db.GaEnemyRuntimeStats.create({
      enemy_runtime_id: deadEnemy.id,
      hp_current: hpMax,
      hp_max: hpMax,
      move_speed: moveSpeed,
      attack_speed: attackSpeed,
    });
  }

  const runtimeData = buildEnemyRuntimeData({
    enemyRuntime: deadEnemy,
    enemyDef,
    selectedComponent,
    spawnInstance,
    spawnDef,
    hpCurrent: hpMax,
    hpMax,
    moveSpeed,
    attackSpeed,
    attackPower,
    defense,
    attackRange,
  });

  addEnemy(runtimeData);
  if (io) emitEnemySpawn(io, runtimeData);
  return runtimeData;
}

async function createFreshEnemy(spawnInstance, spawnDef, selectedComponent, nowMs, io = null) {
  const enemyDef = await loadEnemyDefBundle(selectedComponent.enemy_def_id);
  if (!enemyDef?.baseStats) {
    console.warn(`[SPAWN] enemyDef=${selectedComponent.enemy_def_id} ou stats nao encontrados`);
    return null;
  }

  const baseStats = enemyDef.baseStats;
  const hpMax = requireNum(baseStats.hp_max, "hp_max", enemyDef.id);
  const moveSpeed = requireNum(baseStats.move_speed, "move_speed", enemyDef.id);
  const attackSpeed = requireNum(baseStats.attack_speed, "attack_speed", enemyDef.id);
  const attackPower = requireNum(baseStats.attack_power, "attack_power", enemyDef.id);
  const defense = requireNum(baseStats.defense, "defense", enemyDef.id);
  const attackRange = requireNum(baseStats.attack_range, "attack_range", enemyDef.id);

  const shapeKind = String(spawnDef.shape_kind ?? DEFAULT_SPAWN_SHAPE_KIND);
  const spawnX = Number(spawnInstance.pos_x);
  const spawnZ = Number(spawnInstance.pos_z);
  const radiusRaw = Number(spawnDef.radius);
  const radius = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : DEFAULT_SPAWN_RADIUS;
  const spawnPos =
    shapeKind === "CIRCLE"
      ? generateCirclePos(spawnX, spawnZ, radius)
      : generatePointPos(spawnX, spawnZ);

  const enemyRuntime = await db.GaEnemyRuntime.create(
    {
      spawn_instance_id: spawnInstance.id,
      spawn_def_component_id: selectedComponent.id,
      enemy_def_id: enemyDef.id,
      status: "ALIVE",
      pos_x: spawnPos.x,
      pos_z: spawnPos.z,
      yaw: 0,
      home_x: spawnX,
      home_z: spawnZ,
      spawned_at: new Date(nowMs),
    },
    { returning: true }
  );

  await db.GaEnemyRuntimeStats.create({
    enemy_runtime_id: enemyRuntime.id,
    hp_current: hpMax,
    hp_max: hpMax,
    move_speed: moveSpeed,
    attack_speed: attackSpeed,
  });

  const runtimeData = buildEnemyRuntimeData({
    enemyRuntime,
    enemyDef,
    selectedComponent,
    spawnInstance,
    spawnDef,
    hpCurrent: hpMax,
    hpMax,
    moveSpeed,
    attackSpeed,
    attackPower,
    defense,
    attackRange,
  });

  addEnemy(runtimeData);
  if (io) emitEnemySpawn(io, runtimeData);
  return runtimeData;
}

async function countEnemiesForComponent(spawnInstanceId, componentId) {
  return db.GaEnemyRuntime.count({
    where: {
      spawn_instance_id: Number(spawnInstanceId),
      spawn_def_component_id: Number(componentId),
      status: {
        [db.Sequelize.Op.ne]: "DESPAWNED",
      },
    },
  });
}

async function ensureComponentPopulation(spawnInstance, spawnDef, component, nowMs, io = null) {
  const desiredQty = Math.max(0, Number(component.quantity ?? 1));
  if (desiredQty <= 0) {
    return { created: 0, revived: 0 };
  }

  const existingCount = await countEnemiesForComponent(spawnInstance.id, component.id);
  let created = 0;

  for (let i = existingCount; i < desiredQty; i++) {
    const createdEnemy = await createFreshEnemy(spawnInstance, spawnDef, component, nowMs, io);
    if (!createdEnemy) break;
    created += 1;
  }

  const respawnableDeadEnemies = await findRespawnableDeadEnemies(spawnInstance.id, nowMs);
  const componentDeadEnemies = respawnableDeadEnemies.filter(
    (enemy) => Number(enemy.spawnDefComponent?.id) === Number(component.id)
  );

  let revived = 0;
  for (const deadEnemy of componentDeadEnemies) {
    const respawned = await respawnDeadEnemy(deadEnemy, spawnInstance, spawnDef, io);
    if (respawned) revived += 1;
  }

  return { created, revived };
}

async function processSpawnInstance(spawnInstance, nowMs, io = null) {
  const instanceId = spawnInstance.instance?.id ?? spawnInstance.instance_id;
  const spawnDef = spawnInstance.spawnDef;
  if (!instanceId || !spawnDef) {
    console.warn(`[SPAWN] ERROR: spawnInstance=${spawnInstance.id} sem instanceId/spawnDef`);
    return;
  }

  const instanceSpawnConfig = resolveInstanceSpawnConfig(spawnInstance.instance);
  if (!instanceSpawnConfig.enemySpawnEnabled) {
    console.log(
      `[SPAWN] spawnInstance=${spawnInstance.id} desabilitado pela config da instancia=${instanceId}`
    );
    return;
  }

  const spawnTickMs = Math.max(1000, Number(instanceSpawnConfig.spawnTickMs ?? 0) || 1000);
  const lastTickAtMs = Number(_lastSpawnerTickAtMs.get(Number(spawnInstance.id)) ?? 0);
  if (lastTickAtMs > 0 && nowMs - lastTickAtMs < spawnTickMs) {
    return;
  }
  _lastSpawnerTickAtMs.set(Number(spawnInstance.id), nowMs);

  const components = Array.isArray(spawnDef.components) ? [...spawnDef.components] : [];
  if (components.length === 0) {
    console.log(`[SPAWN] spawnInstance=${spawnInstance.id} sem components ativas`);
    return;
  }

  components.sort((a, b) => {
    const aOrder = Number(a.sort_order ?? a.id ?? 0);
    const bOrder = Number(b.sort_order ?? b.id ?? 0);
    return aOrder - bOrder;
  });

  for (const component of components) {
    if (String(component.status ?? "ACTIVE").toUpperCase() !== "ACTIVE") continue;

    const desiredQty = Math.max(0, Number(component.quantity ?? 1));
    const existingCount = await countEnemiesForComponent(spawnInstance.id, component.id);
    console.log(
      `[SPAWN] spawnInstance=${spawnInstance.id} component=${component.id} enemyDefId=${component.enemy_def_id} existing=${existingCount} desired=${desiredQty}`
    );

    const result = await ensureComponentPopulation(spawnInstance, spawnDef, component, nowMs, io);
    if (result.created > 0 || result.revived > 0) {
      console.log(
        `[SPAWN] spawnInstance=${spawnInstance.id} component=${component.id} created=${result.created} revived=${result.revived}`
      );
    }
  }
}

async function spawnTick(nowMs, io = null) {
  try {
    const spawnInstances = await db.GaSpawnInstance.findAll({
      where: {
        status: "ACTIVE",
      },
      include: [
        {
          association: "spawnDef",
          required: true,
          include: [
            {
              association: "components",
              where: { status: "ACTIVE" },
              required: false,
            },
          ],
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

    if (!spawnInstances || spawnInstances.length === 0) {
      return;
    }

    for (const spawnInstance of spawnInstances) {
      try {
        await processSpawnInstance(spawnInstance, nowMs, io);
      } catch (err) {
        console.error(`[SPAWN] Error processing spawnInstance=${spawnInstance.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[SPAWN] spawnTick error:", err);
  }
}

module.exports = {
  spawnTick,
};
