// server/socket/handlers/moveHandler.js

const {
  getRuntime,
  ensureRuntimeLoaded,
  // regra única para “WASD ativo”, com timeout
  isWASDActive,
} = require("../../state/runtimeStore");

const { allowMove } = require("./move/throttle");
const { parseMoveIntentPayload } = require("./move/validate");
const { applyWASDIntent } = require("./move/applyWASD");
const { broadcastWASDResult } = require("./move/broadcast");

function registerMoveHandler(socket) {
  socket.on("move:intent", async (payload) => {
    try {
      const userId = socket.data.userId;
      const nowMs = Date.now();

      await ensureRuntimeLoaded(userId);

      const runtime = getRuntime(userId);
      if (!runtime) return;

      // blindagem: se caiu / está pendente / offline, ignora intent
      if (
        runtime.connectionState === "DISCONNECTED_PENDING" ||
        runtime.connectionState === "OFFLINE"
      ) {
        return;
      }

      if (!allowMove(runtime, nowMs)) return;

      const parsed = parseMoveIntentPayload(payload);
      if (!parsed) return;

      const result = applyWASDIntent({
        runtime,
        nowMs,
        dir: parsed.dir,
        yawDesired: parsed.yawDesired,
        isWASDActive,
      });

      if (!result.ok) {
        // log só no que interessa (mantém o comportamento atual)
        if (result.reason === "invalid_speed") {
          console.error("[MOVE] runtime.speed inválido/ausente", {
            userId,
            runtimeSpeed: runtime?.speed,
          });
        } else if (result.reason === "missing_bounds") {
          console.error("[MOVE] runtime.bounds ausente (bloqueando movimento)", { userId });
        } else if (result.reason === "invalid_bounds") {
          console.error("[MOVE] runtime.bounds inválido (bloqueando movimento)", {
            userId,
            bounds: runtime.bounds,
          });
        }
        return;
      }

      // Se nada mudou, não replica
      if (!result.moved && !result.yawChanged && !result.modeOrActionChanged) return;

      broadcastWASDResult({ socket, userId, runtime, nowMs });
    } catch (e) {
      console.error("[MOVE] error:", e);
    }
  });
}

module.exports = { registerMoveHandler };