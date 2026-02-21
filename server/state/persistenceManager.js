// server/state/persistenceManager.js

const { startPersistenceLoop, stopPersistenceLoop } = require("./persistence/loop");
const { tickDisconnects } = require("./persistence/disconnects");
const { flushDirtyBatch } = require("./persistence/flushBatch");
const { flushUserRuntime, flushUserStats } = require("./persistence/writers");
const { persistenceEvents, onEntityDespawn } = require("./persistence/events");
const { nowMs } = require("./persistence/clock");

/**
 * Checkpoint imediato para usar no disconnect.
 * Regra do plano: no disconnect, flush runtime na hora.
 */
async function flushUserRuntimeImmediate(userId) {
  return flushUserRuntime(userId, nowMs());
}

module.exports = {
  startPersistenceLoop,
  stopPersistenceLoop,

  tickDisconnects,
  flushDirtyBatch,

  flushUserRuntime,
  flushUserStats,
  flushUserRuntimeImmediate,

  // eventos (ETAPA 6)
  persistenceEvents,
  onEntityDespawn,
};