// server/state/presenceIndex.js
//
// Presence + Interest Management (chunk-based) em memória.
// Regras:
// - Identidade é userId (não socket.id)
// - Cliente não decide chunk nem quem existe
// - Estrutura deve escalar: updates O(k) onde k = nº de chunks no interest (ex: 9)
//
// Estruturas internas (NÃO exportadas):
// - presenceByInstance: instanceId -> Set<userId>
// - usersByChunk: "chunk:<instanceId>:<cx>:<cz>" -> Set<userId>
// - userIndex: userId -> { instanceId, cx, cz, interestRooms: Set<roomKey> }
//
// OBS: este módulo NÃO depende de socket.io e NÃO toca no banco.

const CHUNK_SIZE = Number(process.env.CHUNK_SIZE ?? 256);
const CHUNK_RADIUS = Number(process.env.CHUNK_RADIUS ?? 1); // 3x3 default

// instanceId -> Set(userId)
const presenceByInstance = new Map();

// chunkRoom -> Set(userId)
const usersByChunk = new Map();

// userId -> { instanceId, cx, cz, interestRooms: Set<chunkRoom> }
const userIndex = new Map();

function toUserKey(userId) {
  return String(userId);
}

function roomKey(instanceId, cx, cz) {
  return `chunk:${instanceId}:${cx}:${cz}`;
}

function computeChunkFromPos(pos) {
  const x = Number(pos?.x ?? 0);
  const z = Number(pos?.z ?? 0);
  return {
    cx: Math.floor(x / CHUNK_SIZE),
    cz: Math.floor(z / CHUNK_SIZE),
  };
}

function computeInterestRooms(instanceId, cx, cz, radius = CHUNK_RADIUS) {
  const rooms = new Set();
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      rooms.add(roomKey(instanceId, cx + dx, cz + dz));
    }
  }
  return rooms;
}

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

/**
 * addUserToInstance(userId, instanceId, pos)
 * - Registra presença por instância
 * - Indexa o usuário no chunk atual
 * - Prepara interestRooms (3x3 por default)
 *
 * Retorna um snapshot do estado calculado:
 * { instanceId, cx, cz, chunkRoom, interestRooms:Set<string> }
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
 *
 * Retorna o último estado conhecido, ou null se não existia.
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
 *
 * Retorna:
 * {
 *   changed: boolean,
 *   instanceId,
 *   prev: { cx, cz, chunkRoom, interestRooms },
 *   next: { cx, cz, chunkRoom, interestRooms },
 *   diff: { entered:Set<room>, left:Set<room> }
 * }
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
 * getUsersInChunks(instanceId, cx, cz, radius?)
 * - Retorna Set<userId> agregando todos usuários nos chunks do interesse.
 * - Útil para baseline / cálculo de quem deve ser visível.
 *
 * Retorna um Set novo (não vaza referência interna).
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
 * - Útil para debug/controladores sem vazar referência.
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

module.exports = {
  // config
  CHUNK_SIZE,
  CHUNK_RADIUS,

  // API obrigatória
  addUserToInstance,
  removeUserFromInstance,
  moveUserChunk,
  getUsersInChunks,

  // helpers de interesse/chunk
  computeChunkFromPos,
  roomKey,
  computeInterestRooms,

  // leitura segura (5.5)
  getUsersInRoom,
  getUsersInRooms,
  getInterestRoomsForUser,
  getUserPresenceState,
};