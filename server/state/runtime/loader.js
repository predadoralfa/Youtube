// server/state/runtime/loader.js
const db = require("../../models");

const { DEFAULT_SPEED, CONNECTION } = require("./constants");
const { computeChunk } = require("./chunk");
const { getRuntime, setRuntime, hasRuntime } = require("./store");
const { markStatsDirty } = require("./dirty");

function sanitizeSpeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
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

    // estado replicável mínimo (preparação multiplayer)
    hp: 100,
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
  };

  runtime.chunk = computeChunk(runtime.pos);

  setRuntime(key, runtime);
  return runtime;
}

/**
 * Atualiza stats acoplados no runtime.
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

  // stats mudou (cache em memória), marca dirtyStats
  markStatsDirty(userId);

  return runtime;
}

module.exports = {
  ensureRuntimeLoaded,
  refreshRuntimeStats,

  // exporta esses helpers só se você quiser testar isolado no futuro.
  // não reexporto no "pai" por enquanto, pra não expandir API pública sem motivo.
  _internal: {
    sanitizeSpeed,
    loadSpeedFromStats,
    loadBoundsForInstance,
  },
};