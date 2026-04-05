// server/state/runtime/loader.js
const db = require("../../models");

const { CONNECTION } = require("./constants");
const { computeChunk } = require("./chunk");
const { getRuntime, setRuntime, hasRuntime } = require("./store");
const { markStatsDirty } = require("./dirty");
const { loadPlayerCombatStats } = require("./combatLoader");
const { loadPersistedAutoFoodConfig } = require("../../service/autoFoodService");
const {
  resolveStaminaPersistBucket,
  syncStaminaPersistMarkers,
} = require("../movement/stamina");

function sanitizeSpeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function loadSpeedFromStats(userId) {
  // stats podem ainda não existir para um user em alguns cenários (seed incompleto)
  const stats = await db.GaUserStats.findOne({
    where: { user_id: userId },
    attributes: ["user_id", "move_speed"],
  });

  const speed = sanitizeSpeed(stats?.move_speed);
  return speed; // null se inválido/ausente
}

function applyCombatStatsToRuntime(runtime, combatStats) {
  const hpCurrent = combatStats?.hpCurrent;
  const hpMax = combatStats?.hpMax;
  const staminaCurrent = combatStats?.staminaCurrent;
  const staminaMax = combatStats?.staminaMax;
  const hungerCurrent = combatStats?.hungerCurrent;
  const hungerMax = combatStats?.hungerMax;
  const attackPower = combatStats?.attackPower;
  const defense = combatStats?.defense;
  const attackSpeed = combatStats?.attackSpeed;
  const attackRange = combatStats?.attackRange;

  runtime.combat = {
    hpCurrent,
    hpMax,
    staminaCurrent,
    staminaMax,
    hungerCurrent,
    hungerMax,
    attackPower,
    defense,
    attackSpeed,
    attackRange,

    // runtime-only
    lastAttackAtMs: Number(runtime?.combat?.lastAttackAtMs ?? 0),
    targetId: runtime?.combat?.targetId ?? null,
    targetKind: runtime?.combat?.targetKind ?? null,
    state: runtime?.combat?.state ?? "IDLE",
  };

  // compatibilidade + serializer simplificado
  runtime.hp = hpCurrent;
  runtime.hpCurrent = hpCurrent;
  runtime.hpMax = hpMax;
  runtime.staminaCurrent = staminaCurrent;
  runtime.staminaMax = staminaMax;
  runtime.hungerCurrent = hungerCurrent;
  runtime.hungerMax = hungerMax;
  runtime.attackPower = attackPower;
  runtime.defense = defense;
  runtime.attackSpeed = attackSpeed;
  runtime.attackRange = attackRange;

  // shape espelhado para leitores que esperem stats agregados
  runtime.stats = {
    ...(runtime.stats ?? {}),
    hpCurrent,
    hpMax,
    staminaCurrent,
    staminaMax,
    hungerCurrent,
    hungerMax,
    attackPower,
    defense,
    attackSpeed,
    attackRange,
  };

  runtime.vitals = {
    ...(runtime.vitals ?? {}),
    hp: {
      current: hpCurrent,
      max: hpMax,
    },
    stamina: {
      current: staminaCurrent,
      max: staminaMax,
    },
    hunger: {
      current: hungerCurrent,
      max: hungerMax,
    },
  };

  return runtime;
}

async function loadBoundsForInstance(instanceId) {
  const inst = await db.GaInstance.findByPk(instanceId, {
    attributes: ["id", "local_id"],
    include: [
      {
        model: db.GaLocal,
        as: "local",
        attributes: ["id"],
        include: [
          {
            model: db.GaLocalGeometry,
            as: "geometry",
            attributes: ["size_x", "size_z"],
          },
        ],
      },
    ],
  });

  const sizeX = Number(inst?.local?.geometry?.size_x);
  const sizeZ = Number(inst?.local?.geometry?.size_z);

  if (!Number.isFinite(sizeX) || sizeX <= 0 || !Number.isFinite(sizeZ) || sizeZ <= 0) {
    throw new Error(
      `Bounds inválido no DB (GaLocalGeometry) instance=${instanceId} local=${inst?.local?.id ?? "?"} sizeX=${sizeX} sizeZ=${sizeZ}`
    );
  }

  return {
    minX: -sizeX / 2,
    maxX: sizeX / 2,
    minZ: -sizeZ / 2,
    maxZ: sizeZ / 2,
    sizeX,
    sizeZ,
  };
}

async function ensureRuntimeLoaded(userId) {
  const key = String(userId);

  if (hasRuntime(key)) return getRuntime(key);

  const row = await db.GaUserRuntime.findOne({
    where: { user_id: userId },
    attributes: [
      "user_id",
      "instance_id",
      "pos_x",
      "pos_y",
      "pos_z",
      "yaw",
      "connection_state",
      "disconnected_at",
      "offline_allowed_at",
    ],
  });

  if (!row) {
    throw new Error("Runtime ausente no banco (ga_user_runtime)");
  }

  const bounds = await loadBoundsForInstance(row.instance_id);
  const speedFromStats = await loadSpeedFromStats(userId);
  const combatStats = await loadPlayerCombatStats(userId);
  const hungerMax = Math.max(0, Number(combatStats?.hungerMax ?? 100) || 100);
  const persistedAutoFood = await loadPersistedAutoFoodConfig(
    userId,
    hungerMax
  );

  if (speedFromStats == null) {
    throw new Error(
      `move_speed ausente ou inválido para userId=${userId}; runtime não pode ser carregado sem velocidade autoritativa`
    );
  }

  const runtime = {
    // identidade
    userId: row.user_id,
    instanceId: row.instance_id,

    // transform autoritativo
    pos: {
      x: Number(row.pos_x ?? 0),
      y: Number(row.pos_y ?? 0),
      z: Number(row.pos_z ?? 0),
    },
    yaw: Number(row.yaw ?? 0),

    // estado replicável mínimo
    hp: combatStats?.hpCurrent, // compat temporaria
    hpCurrent: combatStats?.hpCurrent,
    hpMax: combatStats?.hpMax,
    staminaCurrent: combatStats?.staminaCurrent,
    staminaMax: combatStats?.staminaMax,
    hungerCurrent: combatStats?.hungerCurrent,
    hungerMax: combatStats?.hungerMax,
    action: "idle",
    rev: 0,
    chunk: null, // { cx, cz } preenchido abaixo

    // stats cacheados no runtime
    speed: speedFromStats,
    _speedFallback: false,
    staminaTickAtMs: Date.now(),
    hungerTickAtMs: Date.now(),

    // conexão / presença (persistíveis)
    connectionState: row.connection_state || CONNECTION.OFFLINE,
    disconnectedAtMs: row.disconnected_at == null ? null : Number(row.disconnected_at),
    offlineAllowedAtMs: row.offline_allowed_at == null ? null : Number(row.offline_allowed_at),

    // dirty model (hot + batch)
    dirtyRuntime: false,
    dirtyStats: Boolean(combatStats?.hungerWasAdjusted),
    lastRuntimeDirtyAtMs: 0,
    lastStatsDirtyAtMs: 0,

    // anti-flood
    lastMoveAtMs: 0,
    moveCountWindow: 0,
    moveWindowStartMs: 0,

    // cache de bounds para evitar ler local/geometry repetidamente
    bounds,

    // automacoes locais do player controladas pelo servidor
    autoFood: persistedAutoFood,

    // ==============================
    // Click-to-move + Input
    // ==============================

    // Click-to-move state
    moveMode: "STOP", // "STOP" | "WASD" | "CLICK"
    moveTarget: null, // { x, z } | null
    moveStopRadius: 0.75, // ajuste fino server-side
    moveTickAtMs: 0,
    wasdTickAtMs: 0, // last movement tick timestamp (server clock)

    // Input state (para regra de prioridade e cancelamento)
    inputDir: { x: 0, z: 0 }, // último dir normalizado recebido do client
    inputDirAtMs: 0, // timestamp do inputDir (server clock)

    // Anti-spam simples de click
    lastClickAtMs: 0,

    // ==============================
    // Combate
    // ==============================
    combat: {
      hpCurrent: combatStats?.hpCurrent,
      hpMax: combatStats?.hpMax,
      staminaCurrent: combatStats?.staminaCurrent,
      staminaMax: combatStats?.staminaMax,
      hungerCurrent: combatStats?.hungerCurrent,
      hungerMax: combatStats?.hungerMax,
      attackPower: combatStats?.attackPower,
      defense: combatStats?.defense,
      attackSpeed: combatStats?.attackSpeed,
      attackRange: combatStats?.attackRange,
      lastAttackAtMs: 0,
      targetId: null,
      targetKind: null,
      state: "IDLE",
    },

    // espelho agregado para serializers tolerantes
    stats: {
      hpCurrent: combatStats?.hpCurrent,
      hpMax: combatStats?.hpMax,
      staminaCurrent: combatStats?.staminaCurrent,
      staminaMax: combatStats?.staminaMax,
      attackPower: combatStats?.attackPower,
      defense: combatStats?.defense,
      attackSpeed: combatStats?.attackSpeed,
      attackRange: combatStats?.attackRange,
    },
  };

  applyCombatStatsToRuntime(runtime, combatStats);
  syncStaminaPersistMarkers(
    runtime,
    resolveStaminaPersistBucket(combatStats?.staminaCurrent, combatStats?.staminaMax)
  );

  runtime.chunk = computeChunk(runtime.pos);

  setRuntime(key, runtime);
  return runtime;
}

/**
 * Atualiza stats NÃO-combate acoplados no runtime.
 * Chame isso depois de level up / equip / buff / debuff / mount etc.
 * (não é para ser chamado no moveHandler)
 */
async function refreshRuntimeStats(userId) {
  const runtime = getRuntime(userId);
  if (!runtime) return null;

  const speedFromStats = await loadSpeedFromStats(userId);
  if (speedFromStats == null) return runtime;

  runtime.speed = speedFromStats;
  runtime._speedFallback = false;

  markStatsDirty(userId);
  return runtime;
}

/**
 * Atualiza apenas o container de combate no runtime.
 * Não mexe em move_speed.
 */
async function refreshRuntimeCombatStats(userId) {
  const runtime = getRuntime(userId);
  if (!runtime) return null;

  const combatStats = await loadPlayerCombatStats(userId);
  applyCombatStatsToRuntime(runtime, combatStats);
  syncStaminaPersistMarkers(
    runtime,
    resolveStaminaPersistBucket(combatStats?.staminaCurrent, combatStats?.staminaMax)
  );

  if (combatStats?.hungerWasAdjusted) {
    runtime.dirtyStats = true;
  }
  markStatsDirty(userId);
  return runtime;
}

module.exports = {
  ensureRuntimeLoaded,
  refreshRuntimeStats,
  refreshRuntimeCombatStats,

  _internal: {
    sanitizeSpeed,
    toNum,
    loadSpeedFromStats,
    loadBoundsForInstance,
    applyCombatStatsToRuntime,
  },
};

