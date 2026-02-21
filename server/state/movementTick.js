// server/state/movementTick.js

const { startMovementTick, stopMovementTick } = require("./movement/loop");
const { MOVEMENT_TICK_MS } = require("./movement/config");

module.exports = {
  startMovementTick,
  stopMovementTick,
  MOVEMENT_TICK_MS,
};