// server/state/movement/emit.js

const { getInterestRoomsForUser } = require("../presenceIndex");

/**
 * Envia delta para todas as rooms de interesse do user.
 * Se houver socket do próprio, evita eco usando socket.to(room).
 */
function emitDeltaToInterest(io, socketOrNull, userId, payload) {
  const rooms = getInterestRoomsForUser(userId);
  for (const r of rooms) {
    if (socketOrNull) socketOrNull.to(r).emit("entity:delta", payload);
    else io.to(r).emit("entity:delta", payload);
  }
}

module.exports = {
  emitDeltaToInterest,
};