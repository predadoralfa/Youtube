// server/state/movement/loop.js

const { MOVEMENT_TICK_MS } = require("./config");
const { nowMs } = require("./clock");
const { tickOnce } = require("./tickOnce");

let _timer = null;

function startMovementTick(io) {
  if (_timer) return;

  _timer = setInterval(() => {
    try {
      tickOnce(io, nowMs());
    } catch (e) {
      console.error("[MOVE_TICK] error:", e);
    }
  }, MOVEMENT_TICK_MS);

  // não segura processo aberto em shutdown
  if (typeof _timer.unref === "function") _timer.unref();

  console.log(`[MOVE_TICK] started interval=${MOVEMENT_TICK_MS}ms`);
}

function stopMovementTick() {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
  console.log("[MOVE_TICK] stopped");
}

module.exports = {
  startMovementTick,
  stopMovementTick,
};