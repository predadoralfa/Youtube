// server/state/spawn/spawnLoop.js

const { SPAWN_TICK_MS } = require("./spawnConfig");
const { spawnTick } = require("./spawnTick");

let _timer = null;
let _running = false;
let _io = null; // ✨ NOVO: referência para io

function startSpawnLoop(io = null) {
  if (_timer) return;

  _io = io; // ✨ NOVO: guardar io

  _timer = setInterval(async () => {
    if (_running) return; // evita overlap se o tick demorar
    _running = true;

    try {
      await spawnTick(Date.now(), _io); // ✨ NOVO: passar io
    } catch (err) {
      console.error("[SPAWN] loop error:", err);
    } finally {
      _running = false;
    }
  }, SPAWN_TICK_MS);

  // não segura processo aberto em shutdown
  if (typeof _timer.unref === "function") _timer.unref();

  console.log(`[SPAWN] loop started interval=${SPAWN_TICK_MS}ms (${(SPAWN_TICK_MS / 1000 / 60).toFixed(1)} min)`);
}

function stopSpawnLoop() {
  if (!_timer) return;
  clearInterval(_timer);
  _timer = null;
  _running = false;
  _io = null;
  console.log("[SPAWN] loop stopped");
}

module.exports = {
  startSpawnLoop,
  stopSpawnLoop,
};