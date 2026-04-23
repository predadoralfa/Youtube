// server/state/movement/config.js

const MOVEMENT_TICK_MS = 50; // 20Hz
// Allow some headroom above the nominal 50ms tick so small event-loop delays
// do not permanently shave movement time off every server step.
const DT_MAX = 0.1;

module.exports = {
  MOVEMENT_TICK_MS,
  DT_MAX,
};
