// server/state/presence/read.js

const { CHUNK_RADIUS } = require("./config");
const { toUserKey } = require("./keys");
const { usersByChunk, userIndex } = require("./store");
const { computeInterestRooms } = require("./math");

/**
 * getUsersInRoom(roomKey)
 * - Retorna Set<userId> novo (cópia) dos usuários naquele room.
 */
function getUsersInRoom(room) {
  const s = usersByChunk.get(room);
  if (!s) return new Set();
  return new Set(s);
}

/**
 * getUsersInRooms(rooms)
 * - rooms pode ser Set<string> ou Array<string>
 * - Retorna Set<userId> novo agregando usuários.
 */
function getUsersInRooms(rooms) {
  const out = new Set();
  if (!rooms) return out;

  for (const r of rooms) {
    const s = usersByChunk.get(r);
    if (!s) continue;
    for (const uid of s) out.add(uid);
  }
  return out;
}

/**
 * getUsersInChunks(instanceId, cx, cz, radius?)
 * - Retorna Set<userId> agregando todos usuários nos chunks do interesse.
 * - Retorna um Set novo (não vaza referência interna).
 */
function getUsersInChunks(instanceId, cx, cz, radius = CHUNK_RADIUS) {
  const rooms = computeInterestRooms(String(instanceId), cx, cz, radius);
  return getUsersInRooms(rooms);
}

/**
 * getInterestRoomsForUser(userId)
 * - Retorna Array<string> (cópia) dos chunk rooms de interesse do user.
 */
function getInterestRoomsForUser(userId) {
  const st = userIndex.get(toUserKey(userId));
  if (!st?.interestRooms) return [];
  return Array.from(st.interestRooms);
}

/**
 * getUserPresenceState(userId)
 * - Retorna estado de presença indexado (cópia) ou null.
 */
function getUserPresenceState(userId) {
  const st = userIndex.get(toUserKey(userId));
  if (!st) return null;
  return {
    instanceId: st.instanceId,
    cx: st.cx,
    cz: st.cz,
    interestRooms: new Set(st.interestRooms),
  };
}

module.exports = {
  getUsersInRoom,
  getUsersInRooms,
  getUsersInChunks,
  getInterestRoomsForUser,
  getUserPresenceState,
};