// server/state/runtimeStore.js
const db = require("../models");

const runtimeStore = new Map(); // key: String(userId) -> runtime state

const DEFAULT_SPEED = 4;

// (NOVO) Janela para considerar WASD "ativo" sem depender de keyup.
// Se o client parar de emitir intents (perde foco, lag, etc), isso expira.
const INPUT_DIR_ACTIVE_MS = 250;

// Chunking (interest management)
const CHUNK_SIZE = 256; // configurável (Etapa 1: fixo)

function computeChunk(pos) {
  const x = Number(pos?.x ?? 0);
  const z = Number(pos?.z ?? 0);
  return {
    cx: Math.floor(x / CHUNK_SIZE),
    cz: Math.floor(z / CHUNK_SIZE),
  };
}

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
 * (NOVO) Útil para debug e para o persistenceManager decidir eviction.
 */
function hasRuntime(userId) {
  return runtimeStore.has(String(userId));
}

/**
 * (NOVO) Eviction explícita do runtime em memória.
 * Retorna true se removeu, false se não existia.
 */
function deleteRuntime(userId) {
  return runtimeStore.delete(String(userId));
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

  // (NOVO) OFFLINE não deve ficar sujando por gameplay/ruído.
  // Persistir transição de conexão é feito por setConnectionState.
  if (rt.connectionState === CONNECTION.OFFLINE) return false;

  rt.dirtyRuntime = true;
  rt.lastRuntimeDirtyAtMs = nowMs;
  return true;
}

function markStatsDirty(userId, nowMs = Date.now()) {
  const rt = getRuntime(userId);
  if (!rt) return false;

  // (NOVO) mesmo racional: não manter OFFLINE sujo por stats.
  if (rt.connectionState === CONNECTION.OFFLINE) return false;

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

/**
 * (NOVO) Regra única de "WASD ativo" (para click não cancelar WASD, e WASD cancelar click).
 * Não depende do client mandar dir=0.
 */
function isWASDActive(rt, nowMs = Date.now()) {
  if (!rt) return false;
  const d = rt.inputDir;
  if (!d) return false;

  const hasDir = (Number(d.x) !== 0) || (Number(d.z) !== 0);
  if (!hasDir) return false;

  const at = Number(rt.inputDirAtMs ?? 0);
  if (!Number.isFinite(at) || at <= 0) return false;

  return (nowMs - at) <= INPUT_DIR_ACTIVE_MS;
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

  // dentro de ensureRuntimeLoaded, depois de ler `row`
  const inst = await db.GaInstance.findByPk(row.instance_id, {
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
      `Bounds inválido no DB (GaLocalGeometry) instance=${row.instance_id} local=${inst?.local?.id ?? "?"} sizeX=${sizeX} sizeZ=${sizeZ}`
    );
  }

  const bounds = {
    minX: -sizeX / 2,
    maxX:  sizeX / 2,
    minZ: -sizeZ / 2,
    maxZ:  sizeZ / 2,
    sizeX,
    sizeZ,
  };

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

    // cache de bounds para evitar ler local/geometry repetidamente
    bounds,

    // ==============================
    // (NOVO) Click-to-move + Input
    // ==============================

    // Click-to-move state
    moveMode: "STOP",          // "STOP" | "WASD" | "CLICK"
    moveTarget: null,          // { x, z } | null
    moveStopRadius: 0.45,      // ajuste fino server-side
    moveTickAtMs: 0,
    wasdTickAtMs: 0,           // last movement tick timestamp (server clock)

    // Input state (para regra de prioridade e cancelamento)
    inputDir: { x: 0, z: 0 },  // último dir normalizado recebido do client
    inputDirAtMs: 0,           // timestamp do inputDir (server clock)

    // Anti-spam simples de click
    lastClickAtMs: 0,
  };

  runtime.chunk = computeChunk(runtime.pos);

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
  hasRuntime,     // (NOVO)
  deleteRuntime,  // (NOVO)
  getAllRuntimes,
  ensureRuntimeLoaded,

  // mutation helpers
  markRuntimeDirty,
  markStatsDirty,
  setConnectionState,

  // (NOVO) input/click helpers
  INPUT_DIR_ACTIVE_MS,
  isWASDActive,

  // stats helper
  refreshRuntimeStats,

  // constants
  DEFAULT_SPEED,
  CONNECTION,

  // chunk helpers (Etapa 1)
  CHUNK_SIZE,
  computeChunk,
};