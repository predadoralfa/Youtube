"use strict";

const db = require("../../models");
const {
  addEnemy,
  getEnemy,
  removeEnemy,
  getAliveEnemiesForSpawnInstance,
} = require("../enemies/enemiesRuntimeStore");
const { emitEnemySpawn, emitEnemyDespawn } = require("../enemies/enemyEmit");
const { DEFAULT_SPAWN_SHAPE_KIND, DEFAULT_SPAWN_RADIUS } = require("./spawnConfig");
const {
  resolveInstanceSpawnConfig,
  computeEffectiveRespawnMs,
  computeEffectiveMaxAlive,
  computeEffectiveSpawnQuantity,
} = require("../../service/enemyRespawnService");

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

function generateSpawnPos(spawnInstance, spawnDef) {
  const spawnX = Number(spawnInstance.pos_x);
  const spawnZ = Number(spawnInstance.pos_z);
  const shapeKind = String(spawnDef.shape_kind ?? DEFAULT_SPAWN_SHAPE_KIND).toUpperCase();
  if (shapeKind === "CIRCLE") {
    return generateCirclePos(spawnX, spawnZ, spawnDef.radius);
  }
  return generatePointPos(spawnX, spawnZ);
}

function buildEnemyStoreRecord({
  slot,
  spawnInstance,
  spawnDef,
  spawnDefEnemy,
  enemyDef,
  baseStats,
}) {
  const originPos = {
    x: Number(spawnInstance.pos_x),
    z: Number(spawnInstance.pos_z),
  };
  const spawnPos = generateSpawnPos(spawnInstance, spawnDef);

  return {
    id: slot.id,
    instanceId: String(spawnInstance.instance_id),
    spawnInstanceId: slot.spawn_instance_id,
    spawnDefEnemyId: slot.spawn_def_enemy_id,
    spawnInstanceEnemyId: slot.id,
    enemyDefId: enemyDef.id,
    enemyDefCode: enemyDef.code,
    enemyDefName: enemyDef.name ?? enemyDef.code,
    displayName: enemyDef.name || enemyDef.code,
    visualKind: enemyDef.visual_kind ?? "DEFAULT",
    visualScale: Number(enemyDef.visual_scale ?? 1),
    collisionRadius: Number(enemyDef.collision_radius ?? 0.5),
    pos: spawnPos,
    spawnOriginPos: originPos,
    yaw: 0,
    homePos: originPos,
    status: slot.status ?? "ALIVE",
    stats: {
      hpCurrent: Number(slot.hp_current),
      hpMax: requireNum(baseStats.hp_max, "hp_max", enemyDef.id),
      moveSpeed: requireNum(baseStats.move_speed, "move_speed", enemyDef.id),
      attackSpeed: requireNum(baseStats.attack_speed, "attack_speed", enemyDef.id),
      attackPower: requireNum(baseStats.attack_power, "attack_power", enemyDef.id),
      defense: requireNum(baseStats.defense, "defense", enemyDef.id),
      attackRange: requireNum(baseStats.attack_range, "attack_range", enemyDef.id),
    },
    patrolRadius: requireNum(spawnDef.patrol_radius, "patrol_radius", spawnDef.id),
    patrolWaitMs: requireNum(spawnDef.patrol_wait_ms, "patrol_wait_ms", spawnDef.id),
    patrolStopRadius: requireNum(
      spawnDef.patrol_stop_radius,
      "patrol_stop_radius",
      spawnDef.id
    ),
    deadAt: slot.dead_at ?? null,
    respawnAt: slot.respawn_at ?? null,
    action: "idle",
    rev: 0,
    dirty: false,
  };
}

async function loadSpawnInstanceSlots(spawnInstanceId) {
  return db.GaSpawnInstanceEnemy.findAll({
    where: {
      spawn_instance_id: Number(spawnInstanceId),
    },
    include: [
      {
        association: "spawnDefEnemy",
        required: true,
        include: [
          {
            association: "enemyDef",
            required: true,
            include: [
              {
                association: "baseStats",
                required: true,
              },
            ],
          },
        ],
      },
      {
        association: "spawnInstance",
        required: true,
        include: [
          {
            association: "spawnDef",
            required: true,
          },
        ],
      },
    ],
    order: [
      [{ model: db.GaSpawnDefEnemy, as: "spawnDefEnemy" }, "sort_order", "ASC"],
      ["slot_index", "ASC"],
      ["id", "ASC"],
    ],
  });
}

async function ensureSlotCount({
  spawnInstance,
  spawnDefEnemy,
  desiredQty,
  slots,
  hpMax,
  io,
}) {
  const ordered = [...slots].sort((a, b) => {
    const aIndex = Number(a.slot_index ?? 0);
    const bIndex = Number(b.slot_index ?? 0);
    return aIndex - bIndex || Number(a.id) - Number(b.id);
  });

  if (ordered.length > desiredQty) {
    const extras = ordered.slice(desiredQty);
    for (const extra of extras) {
      const existingEnemy = getEnemy(extra.id);
      if (existingEnemy) {
        removeEnemy(extra.id);
        if (io) emitEnemyDespawn(io, existingEnemy);
      }
    }

    await db.GaSpawnInstanceEnemy.destroy({
      where: {
        id: extras.map((slot) => Number(slot.id)),
      },
    });
  }

  const currentCount = Math.min(ordered.length, desiredQty);
  for (let slotIndex = currentCount; slotIndex < desiredQty; slotIndex += 1) {
    await db.GaSpawnInstanceEnemy.create({
      spawn_instance_id: spawnInstance.id,
      spawn_def_enemy_id: spawnDefEnemy.id,
      slot_index: slotIndex,
      status: "ALIVE",
      hp_current: hpMax,
    });
  }
}

async function reviveDeadSlot(slot, hpMax) {
  await slot.update({
    status: "ALIVE",
    hp_current: hpMax,
    dead_at: null,
    respawn_at: null,
  });
}

function ensureAliveSlotInStore(slot, io = null) {
  const existing = getEnemy(slot.id);
  if (existing) {
    existing.status = "ALIVE";
    existing.deadAt = null;
    existing.respawnAt = null;
    existing.stats = {
      ...(existing.stats ?? {}),
      hpCurrent: Number(slot.hp_current),
    };
    return existing;
  }

  const spawnDefEnemy = slot.spawnDefEnemy;
  const enemyDef = spawnDefEnemy?.enemyDef;
  const baseStats = enemyDef?.baseStats;
  const spawnInstance = slot.spawnInstance;
  const spawnDef = spawnInstance?.spawnDef;
  if (!spawnDefEnemy || !enemyDef || !baseStats || !spawnInstance || !spawnDef) {
    return null;
  }

  const runtimeEnemy = buildEnemyStoreRecord({
    slot,
    spawnInstance,
    spawnDef,
    spawnDefEnemy,
    enemyDef,
    baseStats,
  });

  addEnemy(runtimeEnemy);
  const stored = getEnemy(runtimeEnemy.id) ?? runtimeEnemy;
  if (io) emitEnemySpawn(io, stored);
  return stored;
}

function removeNonAliveSlotFromStore(slot, io = null) {
  const existing = getEnemy(slot.id);
  if (!existing) return;
  removeEnemy(slot.id);
  if (io) emitEnemyDespawn(io, existing);
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
    return;
  }

  const spawnTickMs = Math.max(1000, Number(instanceSpawnConfig.spawnTickMs ?? 0) || 1000);
  const lastTickAtMs = Number(_lastSpawnerTickAtMs.get(Number(spawnInstance.id)) ?? 0);
  if (lastTickAtMs > 0 && nowMs - lastTickAtMs < spawnTickMs) {
    return;
  }
  _lastSpawnerTickAtMs.set(Number(spawnInstance.id), nowMs);

  const spawnDefEnemies = Array.isArray(spawnDef.enemies) ? [...spawnDef.enemies] : [];
  if (spawnDefEnemies.length === 0) {
    return;
  }

  spawnDefEnemies.sort((a, b) => {
    const aOrder = Number(a.sort_order ?? a.id ?? 0);
    const bOrder = Number(b.sort_order ?? b.id ?? 0);
    return aOrder - bOrder;
  });

  const slotRows = await loadSpawnInstanceSlots(spawnInstance.id);
  const slotsByDefEnemyId = new Map();
  for (const slot of slotRows) {
    const defEnemyId = Number(slot.spawn_def_enemy_id);
    if (!slotsByDefEnemyId.has(defEnemyId)) {
      slotsByDefEnemyId.set(defEnemyId, []);
    }
    slotsByDefEnemyId.get(defEnemyId).push(slot);
  }

  let remainingCapacity = computeEffectiveMaxAlive(spawnDef, instanceSpawnConfig);

  for (const spawnDefEnemy of spawnDefEnemies) {
    if (String(spawnDefEnemy.status ?? "ACTIVE").toUpperCase() !== "ACTIVE") continue;

    const enemyDef = spawnDefEnemy.enemyDef;
    const baseStats = enemyDef?.baseStats;
    if (!enemyDef || !baseStats) continue;

    const desiredQty = computeEffectiveSpawnQuantity(
      spawnDefEnemy.quantity,
      instanceSpawnConfig,
      remainingCapacity
    );
    remainingCapacity = Math.max(0, remainingCapacity - desiredQty);

    const hpMax = requireNum(baseStats.hp_max, "hp_max", enemyDef.id);
    const currentSlots = slotsByDefEnemyId.get(Number(spawnDefEnemy.id)) ?? [];

    await ensureSlotCount({
      spawnInstance,
      spawnDefEnemy,
      desiredQty,
      slots: currentSlots,
      hpMax,
      io,
    });
  }

  const refreshedSlots = await loadSpawnInstanceSlots(spawnInstance.id);
  for (const slot of refreshedSlots) {
    const spawnDefEnemy = slot.spawnDefEnemy;
    const enemyDef = spawnDefEnemy?.enemyDef;
    const baseStats = enemyDef?.baseStats;
    if (!spawnDefEnemy || !enemyDef || !baseStats) continue;

    if (String(slot.status).toUpperCase() === "DEAD") {
      const shouldRespawn =
        slot.respawn_at != null && new Date(slot.respawn_at).getTime() <= Number(nowMs);
      if (shouldRespawn) {
        await reviveDeadSlot(slot, requireNum(baseStats.hp_max, "hp_max", enemyDef.id));
        slot.status = "ALIVE";
        slot.hp_current = requireNum(baseStats.hp_max, "hp_max", enemyDef.id);
      }
    }

    if (String(slot.status).toUpperCase() === "ALIVE") {
      ensureAliveSlotInStore(slot, io);
      continue;
    }

    removeNonAliveSlotFromStore(slot, io);
  }

  const aliveSlots = refreshedSlots.filter(
    (slot) => String(slot.status).toUpperCase() === "ALIVE"
  );
  const aliveInStore = getAliveEnemiesForSpawnInstance(spawnInstance.id);
  if (aliveInStore.length > aliveSlots.length) {
    for (const enemy of aliveInStore) {
      const stillExists = aliveSlots.some((slot) => Number(slot.id) === Number(enemy.id));
      if (!stillExists) {
        removeEnemy(enemy.id);
        if (io) emitEnemyDespawn(io, enemy);
      }
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
              association: "enemies",
              where: { status: "ACTIVE" },
              required: false,
              include: [
                {
                  association: "enemyDef",
                  required: true,
                  include: [
                    {
                      association: "baseStats",
                      required: true,
                    },
                  ],
                },
              ],
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
