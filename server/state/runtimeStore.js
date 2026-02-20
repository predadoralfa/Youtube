// server/state/runtimeStore.js
const db = require("../models");

const runtimeStore = new Map(); // key: String(userId) -> runtime state

const DEFAULT_SPEED = 4;

// Connection states (string, não enum DB)
const CONNECTION = {
  CONNECTED: "CONNECTED",
  DISCONNECTED_PENDING: "DISCONNECTED_PENDING",
  OFFLINE: "OFFLINE",
};

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

function getRuntime(userId) {
  return runtimeStore.get(String(userId)) || null;
}

function setRuntime(userId, runtime) {
  runtimeStore.set(String(userId), runtime);
}

/**
 * Iterador seguro para o persistenceManager varrer.
 * Não expõe o Map diretamente.
 */
function getAllRuntimes() {
  return runtimeStore.values();
}

function markRuntimeDirty(userId, nowMs = Date.now()) {
  const rt = getRuntime(userId);
  if (!rt) return false;

  rt.dirtyRuntime = true;
  rt.lastRuntimeDirtyAtMs = nowMs;
  return true;
}

function markStatsDirty(userId, nowMs = Date.now()) {
  const rt = getRuntime(userId);
  if (!rt) return false;

  rt.dirtyStats = true;
  rt.lastStatsDirtyAtMs = nowMs;
  return true;
}

/**
 * Atualiza estado de conexão apenas em memória.
 * Persistência é responsabilidade do persistenceManager (flush).
 */
function setConnectionState(userId, patch, nowMs = Date.now()) {
  const rt = getRuntime(userId);
  if (!rt) return false;

  if (patch.connectionState != null) rt.connectionState = patch.connectionState;
  if (patch.disconnectedAtMs !== undefined) rt.disconnectedAtMs = patch.disconnectedAtMs;
  if (patch.offlineAllowedAtMs !== undefined) rt.offlineAllowedAtMs = patch.offlineAllowedAtMs;

  // mudar estado de conexão deve persistir
  rt.dirtyRuntime = true;
  rt.lastRuntimeDirtyAtMs = nowMs;
  return true;
}

async function ensureRuntimeLoaded(userId) {
  const key = String(userId);
  if (runtimeStore.has(key)) return runtimeStore.get(key);

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

    // stats cacheados no runtime
    speed: speedFromStats ?? DEFAULT_SPEED,
    _speedFallback: speedFromStats == null,

    // conexão / presença (persistíveis)
    connectionState: row.connection_state || CONNECTION.OFFLINE,
    disconnectedAtMs:
      row.disconnected_at == null ? null : Number(row.disconnected_at),
    offlineAllowedAtMs:
      row.offline_allowed_at == null ? null : Number(row.offline_allowed_at),

    // dirty model (hot + batch)
    dirtyRuntime: false,
    dirtyStats: false,
    lastRuntimeDirtyAtMs: 0,
    lastStatsDirtyAtMs: 0,

    // anti-flood
    lastMoveAtMs: 0,
    moveCountWindow: 0,
    moveWindowStartMs: 0,
  };

  runtimeStore.set(key, runtime);
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
  // store
  getRuntime,
  setRuntime,
  getAllRuntimes,
  ensureRuntimeLoaded,

  // mutation helpers
  markRuntimeDirty,
  markStatsDirty,
  setConnectionState,

  // stats helper
  refreshRuntimeStats,

  // constants
  DEFAULT_SPEED,
  CONNECTION,
};