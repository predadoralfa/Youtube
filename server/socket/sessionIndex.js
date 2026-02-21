// server/socket/sessionIndex.js

// userId(string) -> socket
const activeSocketByUserId = new Map();

function keyOf(userId) {
  return String(userId);
}

function setActiveSocket(userId, socket) {
  activeSocketByUserId.set(keyOf(userId), socket);
}

function getActiveSocket(userId) {
  return activeSocketByUserId.get(keyOf(userId)) || null;
}

// Só remove se o socketId bater, para evitar race quando reconecta rápido
function clearActiveSocket(userId, socketId) {
  const k = keyOf(userId);
  const cur = activeSocketByUserId.get(k);
  if (!cur) return false;
  if (socketId && cur.id !== socketId) return false;
  activeSocketByUserId.delete(k);
  return true;
}

module.exports = {
  setActiveSocket,
  getActiveSocket,
  clearActiveSocket,
};