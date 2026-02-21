// server/state/presence/mutate.js

const { CHUNK_RADIUS } = require("./config");
const { toUserKey, roomKey } = require("./keys");
const {
  presenceByInstance,
  usersByChunk,
  userIndex,
  ensureSet,
  deleteFromSetMap,
} = require("./store");
const { computeChunkFromPos, computeInterestRooms } = require("./math");
const { getUsersInRooms } = require("./read");

/**
 * addUserToInstance(userId, instanceId, pos)
 * - Registra presença por instância
 * - Indexa o usuário no chunk atual
 * - Prepara interestRooms (3x3 por default)
 */
function addUserToInstance(userId, instanceId, pos) {
  const uid = toUserKey(userId);

  // Se já existe, remove primeiro para evitar vazamento/duplicação
  if (userIndex.has(uid)) {
    removeUserFromInstance(uid);
  }

  const { cx, cz } = computeChunkFromPos(pos);
  const chunkRoom = roomKey(instanceId, cx, cz);
  const interestRooms = computeInterestRooms(instanceId, cx, cz);

  // presenceByInstance
  ensureSet(presenceByInstance, String(instanceId)).add(uid);

  // usersByChunk (chunk atual)
  ensureSet(usersByChunk, chunkRoom).add(uid);

  userIndex.set(uid, {
    instanceId: String(instanceId),
    cx,
    cz,
    interestRooms,
  });

  return {
    instanceId: String(instanceId),
    cx,
    cz,
    chunkRoom,
    interestRooms,
  };
}

/**
 * removeUserFromInstance(userId)
 * - Remove de presenceByInstance
 * - Remove do chunk atual em usersByChunk
 * - Limpa userIndex
 */
function removeUserFromInstance(userId) {
  const uid = toUserKey(userId);
  const st = userIndex.get(uid);
  if (!st) return null;

  const instanceId = st.instanceId;
  const currentChunkRoom = roomKey(instanceId, st.cx, st.cz);

  // presenceByInstance
  deleteFromSetMap(presenceByInstance, instanceId, uid);

  // usersByChunk (chunk atual)
  deleteFromSetMap(usersByChunk, currentChunkRoom, uid);

  userIndex.delete(uid);

  return {
    instanceId,
    cx: st.cx,
    cz: st.cz,
    chunkRoom: currentChunkRoom,
    interestRooms: st.interestRooms,
  };
}

/**
 * moveUserChunk(userId, nextCx, nextCz, radius?)
 * - Atualiza chunk do usuário (se mudou)
 * - Atualiza index usersByChunk (remove do anterior, adiciona no novo)
 * - Recalcula interestRooms
 */
function moveUserChunk(userId, nextCx, nextCz, radius = CHUNK_RADIUS) {
  const uid = toUserKey(userId);
  const st = userIndex.get(uid);
  if (!st) return null;

  const instanceId = st.instanceId;

  const prevCx = st.cx;
  const prevCz = st.cz;

  // Sem mudança de chunk
  if (prevCx === nextCx && prevCz === nextCz) {
    const currentRoom = roomKey(instanceId, prevCx, prevCz);
    return {
      changed: false,
      instanceId,
      prev: {
        cx: prevCx,
        cz: prevCz,
        chunkRoom: currentRoom,
        interestRooms: st.interestRooms,
      },
      next: {
        cx: prevCx,
        cz: prevCz,
        chunkRoom: currentRoom,
        interestRooms: st.interestRooms,
      },
      diff: { entered: new Set(), left: new Set() },
    };
  }

  const prevChunkRoom = roomKey(instanceId, prevCx, prevCz);
  const nextChunkRoom = roomKey(instanceId, nextCx, nextCz);

  // Atualiza usersByChunk (remove anterior, adiciona novo)
  deleteFromSetMap(usersByChunk, prevChunkRoom, uid);
  ensureSet(usersByChunk, nextChunkRoom).add(uid);

  // Recalcula interest
  const prevInterest = st.interestRooms;
  const nextInterest = computeInterestRooms(instanceId, nextCx, nextCz, radius);

  const entered = new Set();
  const left = new Set();

  for (const r of nextInterest) {
    if (!prevInterest.has(r)) entered.add(r);
  }
  for (const r of prevInterest) {
    if (!nextInterest.has(r)) left.add(r);
  }

  // Commit
  st.cx = nextCx;
  st.cz = nextCz;
  st.interestRooms = nextInterest;

  return {
    changed: true,
    instanceId,
    prev: {
      cx: prevCx,
      cz: prevCz,
      chunkRoom: prevChunkRoom,
      interestRooms: prevInterest,
    },
    next: {
      cx: nextCx,
      cz: nextCz,
      chunkRoom: nextChunkRoom,
      interestRooms: nextInterest,
    },
    diff: { entered, left },
  };
}

/**
 * Helper útil: baseline de visibilidade a partir de (instance,cx,cz)
 * - Retorna Set<userId> agregando todos usuários nos chunks do interesse.
 */
function getUsersInChunks(instanceId, cx, cz, radius = CHUNK_RADIUS) {
  const rooms = computeInterestRooms(String(instanceId), cx, cz, radius);
  return getUsersInRooms(rooms);
}

module.exports = {
  addUserToInstance,
  removeUserFromInstance,
  moveUserChunk,
  getUsersInChunks,
};