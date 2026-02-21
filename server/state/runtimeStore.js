// server/state/runtimeStore.js

// store
const {
  getRuntime,
  setRuntime,
  hasRuntime,
  deleteRuntime,
  getAllRuntimes,
} = require("./runtime/store");

// loader + stats
const { ensureRuntimeLoaded, refreshRuntimeStats } = require("./runtime/loader");

// mutation helpers
const { markRuntimeDirty, markStatsDirty, setConnectionState } = require("./runtime/dirty");

// input/click helpers
const { isWASDActive } = require("./runtime/inputPolicy");

// constants
const {
  DEFAULT_SPEED,
  CONNECTION,
  INPUT_DIR_ACTIVE_MS,
  CHUNK_SIZE,
} = require("./runtime/constants");

// chunk helpers
const { computeChunk } = require("./runtime/chunk");

module.exports = {
  // store
  getRuntime,
  setRuntime,
  hasRuntime,
  deleteRuntime,
  getAllRuntimes,
  ensureRuntimeLoaded,

  // mutation helpers
  markRuntimeDirty,
  markStatsDirty,
  setConnectionState,

  // input/click helpers
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