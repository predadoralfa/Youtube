// server/socket/handlers/move/throttle.js
const { MOVES_PER_SEC } = require("./config");

function allowMove(runtime, nowMs) {
  const minInterval = 1000 / MOVES_PER_SEC;
  if (runtime.lastMoveAtMs && nowMs - runtime.lastMoveAtMs < minInterval) return false;
  runtime.lastMoveAtMs = nowMs;
  return true;
}

module.exports = {
  allowMove,
};