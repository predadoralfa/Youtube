// server/socket/handlers/moveHandler.js
const {
  getRuntime,
  ensureRuntimeLoaded,
  markRuntimeDirty,
} = require("../../state/runtimeStore");

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
  const minInterval = 1000 / MOVES_PER_SEC;
  if (runtime.lastMoveAtMs && nowMs - runtime.lastMoveAtMs < minInterval) return false;
  runtime.lastMoveAtMs = nowMs;
  return true;
}

// ❌ sem default: se der ruim, não move
function readRuntimeSpeedStrict(runtime) {
  const n = Number(runtime?.speed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function registerMoveHandler(socket) {
  socket.on("move:intent", async (payload) => {
    try {
      const userId = socket.data.userId;
      const nowMs = Date.now();

      await ensureRuntimeLoaded(userId);

      const runtime = getRuntime(userId);
      if (!runtime) return;

      // ✅ blindagem: se caiu / está pendente / offline, ignora intent
      // (em tese não chega intent quando o client caiu, mas isso blinda replay/bug)
      if (
        runtime.connectionState === "DISCONNECTED_PENDING" ||
        runtime.connectionState === "OFFLINE"
      ) {
        return;
      }

      if (!allowMove(runtime, nowMs)) return;

      const dir = payload?.dir;
      const dtRaw = payload?.dt;
      const yawDesired = payload?.yawDesired;

      if (!dir || !isFiniteNumber(dir.x) || !isFiniteNumber(dir.z)) return;
      if (!isFiniteNumber(dtRaw)) return;

      const dt = clamp(dtRaw, 0, DT_MAX);

      // yaw vem da camera (se veio)
      let yawChanged = false;
      if (isFiniteNumber(yawDesired)) {
        const y = Math.atan2(Math.sin(yawDesired), Math.cos(yawDesired));
        if (runtime.yaw !== y) {
          runtime.yaw = y;
          yawChanged = true;
        }
      }

      // direção normalizada
      const d = normalize2D(dir.x, dir.z);

      const speed = readRuntimeSpeedStrict(runtime);
      if (speed == null) {
        console.error("[MOVE] runtime.speed inválido/ausente", {
          userId,
          runtimeSpeed: runtime?.speed,
        });
        return;
      }

      let moved = false;
      if (!(d.x === 0 && d.z === 0)) {
        runtime.pos.x += d.x * speed * dt;
        runtime.pos.z += d.z * speed * dt;
        moved = true;
      }

      if (!moved && !yawChanged) return;

      // ✅ hot path não toca DB: só marca dirty em memória
      markRuntimeDirty(userId, nowMs);

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