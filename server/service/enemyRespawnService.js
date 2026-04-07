"use strict";

const db = require("../models");
const {
  DEFAULT_INSTANCE_ENEMY_SPAWN_ENABLED,
  DEFAULT_INSTANCE_RESPAWN_MULTIPLIER,
  DEFAULT_INSTANCE_SPAWN_QUANTITY_MULTIPLIER,
  DEFAULT_INSTANCE_MAX_ALIVE_MULTIPLIER,
} = require("../state/spawn/spawnConfig");

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampFloorInt(value, fallback = 1) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function normalizeInstanceSpawnConfig(config) {
  if (!config) {
    return {
      enemySpawnEnabled: DEFAULT_INSTANCE_ENEMY_SPAWN_ENABLED,
      respawnMultiplier: DEFAULT_INSTANCE_RESPAWN_MULTIPLIER,
      spawnQuantityMultiplier: DEFAULT_INSTANCE_SPAWN_QUANTITY_MULTIPLIER,
      maxAliveMultiplier: DEFAULT_INSTANCE_MAX_ALIVE_MULTIPLIER,
      spawnTickMs: null,
    };
  }

  return {
    enemySpawnEnabled:
      config.enemy_spawn_enabled == null
        ? DEFAULT_INSTANCE_ENEMY_SPAWN_ENABLED
        : Boolean(config.enemy_spawn_enabled),
    respawnMultiplier: Math.max(
      0,
      toNum(config.respawn_multiplier, DEFAULT_INSTANCE_RESPAWN_MULTIPLIER)
    ),
    spawnQuantityMultiplier: Math.max(
      0,
      toNum(config.spawn_quantity_multiplier, DEFAULT_INSTANCE_SPAWN_QUANTITY_MULTIPLIER)
    ),
    maxAliveMultiplier: Math.max(
      0,
      toNum(config.max_alive_multiplier, DEFAULT_INSTANCE_MAX_ALIVE_MULTIPLIER)
    ),
    spawnTickMs:
      config.spawn_tick_ms == null
        ? null
        : clampFloorInt(config.spawn_tick_ms, null),
  };
}

function resolveInstanceSpawnConfig(instance) {
  const rawConfig =
    instance?.spawnConfig?.get?.({ plain: true }) ??
    instance?.spawnConfig ??
    null;

  return normalizeInstanceSpawnConfig(rawConfig);
}

function computeEffectiveRespawnMs(spawnPoint, instanceSpawnConfig) {
  const baseRespawnMs = Math.max(0, clampFloorInt(spawnPoint?.respawn_ms, 30000));
  const multiplier = Math.max(
    0,
    toNum(instanceSpawnConfig?.respawnMultiplier, DEFAULT_INSTANCE_RESPAWN_MULTIPLIER)
  );

  return Math.max(0, Math.floor(baseRespawnMs * multiplier));
}

function computeEffectiveMaxAlive(spawnPoint, instanceSpawnConfig) {
  const baseMaxAlive = Math.max(0, clampFloorInt(spawnPoint?.max_alive, 1));
  const multiplier = Math.max(
    0,
    toNum(instanceSpawnConfig?.maxAliveMultiplier, DEFAULT_INSTANCE_MAX_ALIVE_MULTIPLIER)
  );

  return Math.max(0, Math.floor(baseMaxAlive * multiplier));
}

function computeEffectiveSpawnQuantity(desiredQuantity, instanceSpawnConfig, remainingCapacity) {
  const desired = Math.max(0, clampFloorInt(desiredQuantity, 0));
  const multiplier = Math.max(
    0,
    toNum(instanceSpawnConfig?.spawnQuantityMultiplier, DEFAULT_INSTANCE_SPAWN_QUANTITY_MULTIPLIER)
  );

  const effectiveDesired = Math.max(0, Math.floor(desired * multiplier));
  return Math.min(effectiveDesired, Math.max(0, clampFloorInt(remainingCapacity, 0)));
}

async function markEnemyDead(enemyInstanceId, nowMs = Date.now(), tx = null) {
  const run = async (transaction) => {
    const enemyInstance = await db.GaEnemyInstance.findByPk(enemyInstanceId, {
      include: [
        {
          association: "spawnPoint",
          required: true,
          include: [
            {
              association: "instance",
              required: false,
              include: [
                {
                  association: "spawnConfig",
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      transaction,
    });

    if (!enemyInstance?.spawnPoint) {
      return null;
    }

    const instanceSpawnConfig = resolveInstanceSpawnConfig(enemyInstance.spawnPoint.instance);
    const effectiveRespawnMs = computeEffectiveRespawnMs(
      enemyInstance.spawnPoint,
      instanceSpawnConfig
    );

    const deadAt = new Date(nowMs);
    const respawnAt =
      effectiveRespawnMs > 0 ? new Date(nowMs + effectiveRespawnMs) : deadAt;

    await enemyInstance.update(
      {
        status: "DEAD",
        dead_at: deadAt,
        respawn_at: respawnAt,
      },
      { transaction }
    );

    return {
      enemyInstanceId: Number(enemyInstance.id),
      spawnPointId: Number(enemyInstance.spawn_point_id),
      deadAt,
      respawnAt,
      effectiveRespawnMs,
    };
  };

  if (tx) {
    return run(tx);
  }

  return run(null);
}

module.exports = {
  normalizeInstanceSpawnConfig,
  resolveInstanceSpawnConfig,
  computeEffectiveRespawnMs,
  computeEffectiveMaxAlive,
  computeEffectiveSpawnQuantity,
  markEnemyDead,
};
