// server/state/presence/store.js
//
// Estruturas internas (NÃO exportadas pelo facade diretamente):
// - presenceByInstance: instanceId -> Set<userId>
// - usersByChunk: "chunk:<instanceId>:<cx>:<cz>" -> Set<userId>
// - userIndex: userId -> { instanceId, cx, cz, interestRooms: Set<roomKey> }
//
// OBS: este módulo NÃO depende de socket.io e NÃO toca no banco.

const presenceByInstance = new Map(); // instanceId -> Set(userId)
const usersByChunk = new Map();       // chunkRoom -> Set(userId)
const userIndex = new Map();          // userId -> state

function ensureSet(map, key) {
  let s = map.get(key);
  if (!s) {
    s = new Set();
    map.set(key, s);
  }
  return s;
}

function deleteFromSetMap(map, key, value) {
  const s = map.get(key);
  if (!s) return;
  s.delete(value);
  if (s.size === 0) map.delete(key);
}

module.exports = {
  presenceByInstance,
  usersByChunk,
  userIndex,

  // utils
  ensureSet,
  deleteFromSetMap,
};