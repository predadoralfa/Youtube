// server/socket/handlers/move/broadcast.js

const {
  moveUserChunk,
  getInterestRoomsForUser,
  computeChunkFromPos,
} = require("../../../state/presenceIndex");

const { markRuntimeDirty } = require("../../../state/runtimeStore");
const { bumpRev, toDelta } = require("../../../state/movement/entity");
const { handleChunkTransition } = require("../../../state/movement/chunkTransition");

function emitDeltaToInterestFromSocket(socket, userId, payload) {
  const rooms = getInterestRoomsForUser(userId);
  for (const r of rooms) {
    socket.to(r).emit("entity:delta", payload);
  }
}

/**
 * Após aplicar WASD, decide replicação:
 * - bumpRev + markDirty
 * - chunk transition (presence + join/leave + spawn/despawn)
 * - entity:delta para interest
 * - move:state para o próprio
 */
function broadcastWASDResult({ socket, userId, runtime, nowMs }) {
  // rev monotônico sempre que algo muda (pos ou yaw ou action/mode)
  bumpRev(runtime);

  // hot path não toca DB: só marca dirty em memória
  markRuntimeDirty(userId, nowMs);

  // ---- Chunk detect + presença ----
  const { cx, cz } = computeChunkFromPos(runtime.pos);

  const prevCx = Number(runtime.chunk?.cx);
  const prevCz = Number(runtime.chunk?.cz);
  const chunkChanged = prevCx !== cx || prevCz !== cz;

  let movedInfo = null;
  if (chunkChanged) {
    movedInfo = moveUserChunk(userId, cx, cz);

    // atualiza runtime.chunk (fonte de verdade local do servidor)
    runtime.chunk = { cx, cz };

    // join/leave de rooms do socket (autoritativo por diffs)
    if (movedInfo?.diff?.entered) {
      for (const r of movedInfo.diff.entered) socket.join(r);
    }
    if (movedInfo?.diff?.left) {
      for (const r of movedInfo.diff.left) socket.leave(r);
    }

    // spawn/despawn (tanto para outros quanto para o mover)
    if (movedInfo) {
      handleChunkTransition(socket.server, socket, runtime, movedInfo);
    }
  }

  // ---- DELTA para outros (por interest) ----
  const delta = toDelta(runtime);
  emitDeltaToInterestFromSocket(socket, userId, delta);

  // feedback local
  socket.emit("move:state", {
    entityId: String(runtime.userId),
    pos: runtime.pos,
    yaw: runtime.yaw,
    rev: runtime.rev ?? 0,
    chunk: runtime.chunk ?? { cx, cz },
  });
}

module.exports = {
  emitDeltaToInterestFromSocket,
  broadcastWASDResult,
};