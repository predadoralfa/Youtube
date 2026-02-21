// server/state/persistence/clock.js

function nowMs() {
  return Date.now();
}

module.exports = {
  nowMs,
};