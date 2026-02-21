// server/state/runtime/chunk.js
const { CHUNK_SIZE } = require("./constants");

function computeChunk(pos) {
  const x = Number(pos?.x ?? 0);
  const z = Number(pos?.z ?? 0);
  return {
    cx: Math.floor(x / CHUNK_SIZE),
    cz: Math.floor(z / CHUNK_SIZE),
  };
}

module.exports = {
  computeChunk,
};