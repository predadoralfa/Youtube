// server/state/presenceIndex.js
//
// Presence + Interest Management (chunk-based) em memória.
// Regras:
// - Identidade é userId (não socket.id)
// - Cliente não decide chunk nem quem existe
// - Estrutura deve escalar: updates O(k) onde k = nº de chunks no interest (ex: 9)
//
// OBS: este módulo NÃO depende de socket.io e NÃO toca no banco.

const { CHUNK_SIZE, CHUNK_RADIUS } = require("./presence/config");

const { toUserKey, roomKey } = require("./presence/keys");
const { computeChunkFromPos, computeInterestRooms } = require("./presence/math");

const {
  addUserToInstance,
  removeUserFromInstance,
  moveUserChunk,
  getUsersInChunks,
} = require("./presence/mutate");

const {
  getUsersInRoom,
  getUsersInRooms,
  getInterestRoomsForUser,
  getUserPresenceState,
} = require("./presence/read");

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

  // (não exportado antes, mas útil internamente se você quiser)
  // toUserKey,
};