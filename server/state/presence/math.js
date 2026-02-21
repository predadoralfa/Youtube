// server/state/presence/math.js

const { CHUNK_SIZE, CHUNK_RADIUS } = require("./config");
const { roomKey } = require("./keys");

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

module.exports = {
  computeChunkFromPos,
  computeInterestRooms,
};