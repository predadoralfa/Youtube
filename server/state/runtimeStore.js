// server/state/runtimeStore.js

// store
const {
  getRuntime,
  setRuntime,
  hasRuntime,
  deleteRuntime,
  getAllRuntimes,
} = require("./runtime/store");
 
// mutation helpers
const { markRuntimeDirty, markStatsDirty, setConnectionState } = require("./runtime/dirty");

// input/click helpers
const { isWASDActive } = require("./runtime/inputPolicy");

// constants
const { CONNECTION } = require("./runtime/constants");
const { INPUT_DIR_ACTIVE_MS, CHUNK_SIZE } = require("../config/worldConstants");

// chunk helpers
const { computeChunk } = require("./runtime/chunk");

function ensureRuntimeLoaded(...args) {
  return require("./runtime/loader/ensureRuntimeLoaded").ensureRuntimeLoaded(...args);
}

function refreshRuntimeStats(...args) {
  return require("./runtime/loader/refreshers").refreshRuntimeStats(...args);
}

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
  CONNECTION,

  // chunk helpers (Etapa 1)
  CHUNK_SIZE,
  computeChunk,
};
