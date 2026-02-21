// server/socket/wiring/session.js

const {
  setActiveSocket,
  clearActiveSocket,
  getActiveSocket,
} = require("../sessionIndex");

/**
 * Aplica política de sessão única por userId:
 * - derruba sessão anterior (se existir)
 * - marca prev para não disparar DISCONNECTED_PENDING
 * - seta socket atual como ativo
 */
function enforceSingleSession(userId, socket) {
  const prev = getActiveSocket(userId);
  if (prev && prev.id !== socket.id) {
    prev.data._skipDisconnectPending = true;

    prev.emit("session:replaced", {
      by: socket.id,
      userId,
    });

    prev.disconnect(true);
  }

  setActiveSocket(userId, socket);
}

/**
 * Limpa sessão ativa com proteção de race:
 * só remove se o socket ainda é o atual.
 */
function clearIfCurrentSession(userId, socket) {
  const current = getActiveSocket(userId);
  if (!current || current.id !== socket.id) return false;

  clearActiveSocket(userId, socket.id);
  return true;
}

module.exports = {
  enforceSingleSession,
  clearIfCurrentSession,
};