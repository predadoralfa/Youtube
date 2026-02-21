// server/state/movement/chunkTransition.js

const {
  getUsersInChunks,
  getUsersInRoom,
  computeChunkFromPos,
} = require("../presenceIndex");

const { getRuntime } = require("../runtimeStore");
const { toEntity } = require("./entity");

/**
 * Orquestra spawn/despawn em transição de chunk:
 * A) Outros veem você (broadcast por rooms)
 * B) Você vê outros (envio direto para o socket do mover)
 */
function handleChunkTransition(io, socket, runtime, movedInfo) {
  const selfEntity = toEntity(runtime);

  const enteredRooms = movedInfo?.diff?.entered ?? new Set();
  const leftRooms = movedInfo?.diff?.left ?? new Set();

  // A) Outros veem você
  for (const r of enteredRooms) {
    io.to(r).emit("entity:spawn", selfEntity);
  }
  for (const r of leftRooms) {
    io.to(r).emit("entity:despawn", {
      entityId: selfEntity.entityId,
      rev: selfEntity.rev,
    });
  }

  // B) Você vê outros
  if (!socket) return;

  if (enteredRooms.size > 0) {
    const seen = new Set();

    for (const r of enteredRooms) {
      const s = getUsersInRoom(r);
      if (!s || s.size === 0) continue;

      for (const uid of s) {
        const id = String(uid);
        if (id === String(runtime.userId)) continue;
        if (seen.has(id)) continue;
        seen.add(id);

        const otherRt = getRuntime(id);
        if (!otherRt) continue;
        if (otherRt.connectionState === "OFFLINE") continue;

        socket.emit("entity:spawn", toEntity(otherRt));
      }
    }
  }

  if (leftRooms.size > 0) {
    const seen = new Set();

    const { cx, cz } = computeChunkFromPos(runtime.pos);
    const visibleNow = getUsersInChunks(runtime.instanceId, cx, cz);

    for (const r of leftRooms) {
      const s = getUsersInRoom(r);
      if (!s || s.size === 0) continue;

      for (const uid of s) {
        const id = String(uid);
        if (id === String(runtime.userId)) continue;
        if (seen.has(id)) continue;
        seen.add(id);

        if (visibleNow.has(id)) continue;

        const otherRt = getRuntime(id);
        const otherRev = Number(otherRt?.rev ?? 0);

        socket.emit("entity:despawn", { entityId: id, rev: otherRev });
      }
    }
  }
}

module.exports = {
  handleChunkTransition,
};