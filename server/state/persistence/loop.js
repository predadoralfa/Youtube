// server/state/persistence/loop.js

const { PERSIST_TICK_MS, MAX_FLUSH_PER_TICK } = require("./config");
const { nowMs } = require("./clock");
const { tickDisconnects } = require("./disconnects");
const { flushDirtyBatch } = require("./flushBatch");

let _timer = null;
let _running = false;

function startPersistenceLoop() {
  if (_timer) return;

  _timer = setInterval(async () => {
    if (_running) return; // evita overlap se o tick demorar
    _running = true;

    const t0 = nowMs();
    try {
      await tickDisconnects(t0);
      await flushDirtyBatch({ maxUsersPerTick: MAX_FLUSH_PER_TICK, now: t0 });
    } catch (err) {
      console.error("[PERSIST] loop error:", err);
    } finally {
      _running = false;
    }
  }, PERSIST_TICK_MS);

  console.log(
    `[PERSIST] loop started tick=${PERSIST_TICK_MS}ms maxFlushPerTick=${MAX_FLUSH_PER_TICK}`
  );
}

function stopPersistenceLoop() {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
  _running = false;
  console.log("[PERSIST] loop stopped");
}

module.exports = {
  startPersistenceLoop,
  stopPersistenceLoop,
};