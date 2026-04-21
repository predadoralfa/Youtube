// server/socket/handlers/clickMoveHandler.js
const {
  ensureRuntimeLoaded,
  getRuntime,
  isWASDActive,
} = require("../../state/runtimeStore");

const { applyClickInput } = require("../../state/movement/input");
const { emitPlayerState } = require("../../state/movement/tickOnce/playerMovementPhase/emitPlayerState");
const { resolveCarryWeightContext } = require("../../state/movement/tickOnce/carryWeight");
const { processAutomaticCombat } = require("../../state/movement/tickOnce/playerCombat");
const { advanceRuntimeMovementPhase } = require("../../state/movement/tickOnce/playerMovementPhase/processPhase");
const { clearPlayerCombat } = require("./move/clearCombat");
const { CLICK_MOVE_SPAM_MS } = require("../../config/movementConstants");

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

      if (rt.connectionState === "DISCONNECTED_PENDING" || rt.connectionState === "OFFLINE") {
        return;
      }

      if (rt.buildLock?.active || rt.sleepLock?.active) return;

      const x = payload?.x;
      const z = payload?.z;

      if (!isFiniteNumber(x) || !isFiniteNumber(z)) {
        return;
      }

      if (rt.lastClickAtMs && (nowMs - rt.lastClickAtMs) < CLICK_MOVE_SPAM_MS) {
        return;
      }
      rt.lastClickAtMs = nowMs;

      if (isWASDActive(rt)) {
        return;
      }

      const b = rt.bounds;
      if (!b) {
        return;
      }

      const minX = Number(b.minX);
      const maxX = Number(b.maxX);
      const minZ = Number(b.minZ);
      const maxZ = Number(b.maxZ);

      if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) {
        return;
      }

      const tx = clamp(Number(x), minX, maxX);
      const tz = clamp(Number(z), minZ, maxZ);

      if (rt.combat?.state === "ENGAGED") {
        const wasCancelled = clearPlayerCombat(rt);
        if (wasCancelled) {
          socket.emit("combat:cancelled", {
            reason: "CLICK",
            atMs: nowMs,
          });
        }
      }

      applyClickInput(rt, {
        nowMs,
        target: { x: tx, z: tz },
      });
      rt.action = "move";

      await advanceRuntimeMovementPhase(
        socket.server,
        rt,
        nowMs,
        resolveCarryWeightContext,
        processAutomaticCombat
      );

      await emitPlayerState(socket.server, rt, {
        nowMs,
        force: true,
        includeInterest: false,
      });
    } catch (e) {
      console.error("[CLICK_MOVE] error:", e);
    }
  });
}

module.exports = { registerClickMoveHandler };
