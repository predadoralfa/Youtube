// server/state/runtime/loader.js
const db = require("../../models");

const { DEFAULT_SPEED, CONNECTION } = require("./constants");
const { computeChunk } = require("./chunk");
const { getRuntime, setRuntime, hasRuntime } = require("./store");
const { markStatsDirty } = require("./dirty");
const { loadPlayerCombatStats } = require("./combatLoader");

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
  const hpCurrent = toNum(combatStats?.hpCurrent, 100);
  const hpMax = toNum(combatStats?.hpMax, 100);
  const staminaCurrent = toNum(combatStats?.staminaCurrent, 100);
  const staminaMax = toNum(combatStats?.staminaMax, 100);
  const attackPower = toNum(combatStats?.attackPower, 10);
  const defense = toNum(combatStats?.defense, 0);
  const attackSpeed = toNum(combatStats?.attackSpeed, 1);
  const attackRange = toNum(combatStats?.attackRange, 1.2);

  runtime.combat = {
    hpCurrent,
    hpMax,
    staminaCurrent,
    staminaMax,
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
    attackPower,
    defense,
    attackSpeed,
    attackRange,
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
    hp: toNum(combatStats?.hpCurrent, 100), // compat temporária
    hpCurrent: toNum(combatStats?.hpCurrent, 100),
    hpMax: toNum(combatStats?.hpMax, 100),
    staminaCurrent: toNum(combatStats?.staminaCurrent, 100),
    staminaMax: toNum(combatStats?.staminaMax, 100),
    action: "idle",
    rev: 0,
    chunk: null, // { cx, cz } preenchido abaixo

    // stats cacheados no runtime
    speed: speedFromStats ?? DEFAULT_SPEED,
    _speedFallback: speedFromStats == null,

    // conexão / presença (persistíveis)
    connectionState: row.connection_state || CONNECTION.OFFLINE,
    disconnectedAtMs: row.disconnected_at == null ? null : Number(row.disconnected_at),
    offlineAllowedAtMs: row.offline_allowed_at == null ? null : Number(row.offline_allowed_at),

    // dirty model (hot + batch)
    dirtyRuntime: false,
    dirtyStats: false,
    lastRuntimeDirtyAtMs: 0,
    lastStatsDirtyAtMs: 0,

    // anti-flood
    lastMoveAtMs: 0,
    moveCountWindow: 0,
    moveWindowStartMs: 0,

    // cache de bounds para evitar ler local/geometry repetidamente
    bounds,

    // ==============================
    // Click-to-move + Input
    // ==============================

    // Click-to-move state
    moveMode: "STOP", // "STOP" | "WASD" | "CLICK"
    moveTarget: null, // { x, z } | null
    moveStopRadius: 0.45, // ajuste fino server-side
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
      hpCurrent: 100,
      hpMax: 100,
      staminaCurrent: 100,
      staminaMax: 100,
      attackPower: 10,
      defense: 0,
      attackSpeed: 1,
      lastAttackAtMs: 0,
      targetId: null,
      targetKind: null,
      state: "IDLE",
    },

    // espelho agregado para serializers tolerantes
    stats: {
      hpCurrent: toNum(combatStats?.hpCurrent, 100),
      hpMax: toNum(combatStats?.hpMax, 100),
      staminaCurrent: toNum(combatStats?.staminaCurrent, 100),
      staminaMax: toNum(combatStats?.staminaMax, 100),
      attackPower: toNum(combatStats?.attackPower, 10),
      defense: toNum(combatStats?.defense, 0),
      attackSpeed: toNum(combatStats?.attackSpeed, 1),
    },
  };

  applyCombatStatsToRuntime(runtime, combatStats);

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
