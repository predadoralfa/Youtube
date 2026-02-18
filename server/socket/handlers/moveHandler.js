// socket/handlers/moveHandler.js
const { getRuntime, ensureRuntimeLoaded } = require("../../state/runtimeStore");

const SPEED = 4; // m/s
const DT_MAX = 0.05;
const MOVES_PER_SEC = 60;

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function normalize2D(x, z) {
  const len = Math.hypot(x, z);
  if (len <= 0.00001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function allowMove(runtime, nowMs) {
  // limiter por intervalo (mais suave que janela de 1s)
  const minInterval = 1000 / MOVES_PER_SEC;

  if (runtime.lastMoveAtMs && nowMs - runtime.lastMoveAtMs < minInterval) {
    return false;
  }

  runtime.lastMoveAtMs = nowMs;
  return true;
}
function registerMoveHandler(socket) {
  socket.on("move:intent", async (payload) => {
    try {
      const userId = socket.data.userId;
      const nowMs = Date.now();

      // garante runtime carregado
      await ensureRuntimeLoaded(userId);

      const runtime = getRuntime(userId);
      if (!runtime) return;

      if (!allowMove(runtime, nowMs)) return;

      const dir = payload?.dir;
      const dtRaw = payload?.dt;
      const yawDesired = payload?.yawDesired;

      if (!dir || !isFiniteNumber(dir.x) || !isFiniteNumber(dir.z)) return;
      if (!isFiniteNumber(dtRaw)) return;

      const dt = clamp(dtRaw, 0, DT_MAX);

      let yawChanged = false;
      
      if (isFiniteNumber(yawDesired)) {
        // normaliza para [-PI, PI] (evita crescer infinito)
        const y = Math.atan2(Math.sin(yawDesired), Math.cos(yawDesired));
        if (runtime.yaw !== y) {
            runtime.yaw = y;
            yawChanged = true;
        }
      }

        runtime.dirty = true;

      // normaliza direção (sem y)
      const d = normalize2D(dir.x, dir.z);
      if (d.x === 0 && d.z === 0) return;
      runtime.yaw = Math.atan2(d.x, d.z);
      let moved = false;

      if (!(d.x === 0 && d.z === 0)) {
        runtime.pos.x += d.x * SPEED * dt;
        runtime.pos.z += d.z * SPEED * dt;
        moved = true;
      }

    if (!moved && !yawChanged) return;


      // aplica movimento autoritativo
      runtime.pos.x += d.x * SPEED * dt;
      runtime.pos.z += d.z * SPEED * dt;
      runtime.dirty = true;

      socket.emit("move:state", {
        pos: runtime.pos,
        yaw: runtime.yaw,
      });
    } catch (e) {
      console.error("[MOVE] error:", e);
    }
  });
}

module.exports = { registerMoveHandler };
