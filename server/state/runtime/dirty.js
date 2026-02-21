// server/state/runtime/dirty.js
const { CONNECTION } = require("./constants");
const { getRuntime } = require("./store");

function markRuntimeDirty(userId, nowMs = Date.now()) {
  const rt = getRuntime(userId);
  if (!rt) return false;

  // OFFLINE não deve ficar sujando por gameplay/ruído.
  // Persistir transição de conexão é feito por setConnectionState.
  if (rt.connectionState === CONNECTION.OFFLINE) return false;

  rt.dirtyRuntime = true;
  rt.lastRuntimeDirtyAtMs = nowMs;
  return true;
}

function markStatsDirty(userId, nowMs = Date.now()) {
  const rt = getRuntime(userId);
  if (!rt) return false;

  // mesmo racional: não manter OFFLINE sujo por stats.
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

module.exports = {
  markRuntimeDirty,
  markStatsDirty,
  setConnectionState,
};