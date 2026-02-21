// server/socket/handlers/clickMoveHandler.js
const {
  ensureRuntimeLoaded,
  getRuntime,
  isWASDActive,
} = require("../../state/runtimeStore");

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function registerClickMoveHandler(socket) {
  socket.on("move:click", async (payload) => {
    try {
      const userId = socket.data.userId;
      const nowMs = Date.now();

      await ensureRuntimeLoaded(userId);
      const rt = getRuntime(userId);
      if (!rt) return;

      // ignora se caiu/pending/offline
      if (rt.connectionState === "DISCONNECTED_PENDING" || rt.connectionState === "OFFLINE") {
        // opcional debug
        // socket.emit("move:click:rejected", { reason: "OFFLINE", atMs: nowMs });
        return;
      }

      const x = payload?.x;
      const z = payload?.z;

      if (!isFiniteNumber(x) || !isFiniteNumber(z)) {
        // socket.emit("move:click:rejected", { reason: "INVALID", atMs: nowMs });
        return;
      }

      // anti-spam simples
      if (rt.lastClickAtMs && (nowMs - rt.lastClickAtMs) < 100) {
        // socket.emit("move:click:rejected", { reason: "SPAM", atMs: nowMs });
        return;
      }
      rt.lastClickAtMs = nowMs;

      // click NÃO cancela WASD: se WASD ativo, ignora
      if (isWASDActive(rt, nowMs)) {
        // socket.emit("move:click:rejected", { reason: "WASD_ACTIVE", atMs: nowMs });
        return;
      }

      // bounds obrigatório (MVP)
      const b = rt.bounds;
      if (!b) {
        // socket.emit("move:click:rejected", { reason: "NO_BOUNDS", atMs: nowMs });
        return;
      }

      const minX = Number(b.minX);
      const maxX = Number(b.maxX);
      const minZ = Number(b.minZ);
      const maxZ = Number(b.maxZ);

      if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) {
        // socket.emit("move:click:rejected", { reason: "NO_BOUNDS", atMs: nowMs });
        return;
      }

      // clamp do target dentro de bounds (recomendado)
      const tx = clamp(Number(x), minX, maxX);
      const tz = clamp(Number(z), minZ, maxZ);

      rt.moveMode = "CLICK";
      rt.moveTarget = { x: tx, z: tz };
      rt.moveTickAtMs = nowMs;

      // ação opcional (não bumpRev aqui, o tick faz quando houver delta real)
      rt.action = "move";
    } catch (e) {
      console.error("[CLICK_MOVE] error:", e);
    }
  });
}

module.exports = { registerClickMoveHandler };