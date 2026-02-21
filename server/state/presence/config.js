// server/state/presence/config.js

const CHUNK_SIZE = Number(process.env.CHUNK_SIZE ?? 256);
const CHUNK_RADIUS = Number(process.env.CHUNK_RADIUS ?? 1); // 3x3 default

module.exports = {
  CHUNK_SIZE,
  CHUNK_RADIUS,
};