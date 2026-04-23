"use strict";

const {
  getRuntime,
  ensureRuntimeLoaded,
  markRuntimeDirty,
} = require("../../state/runtimeStore");
const { bumpRev } = require("../../state/movement/entity");
const { emitPlayerState } = require("../../state/movement/tickOnce/playerMovementPhase/emitPlayerState");
const { applyWASDInput } = require("../../state/movement/input");
const { resolveCarryWeightContext } = require("../../state/movement/tickOnce/carryWeight");
const { processAutomaticCombat } = require("../../state/movement/tickOnce/playerCombat");
const { advanceRuntimeMovementPhase } = require("../../state/movement/tickOnce/playerMovementPhase/processPhase");
const { clearPlayerCombat } = require("./move/clearCombat");
const { parseMoveIntentPayload } = require("./move/validate");

function registerMoveHandler(socket) {
  socket.on("move:intent", async (payload) => {
    try {
      const userId = socket.data.userId;
      const receivedAtMs = Date.now();

      await ensureRuntimeLoaded(userId);

      const runtime = getRuntime(userId);
      if (!runtime) return;

      if (
        runtime.connectionState === "DISCONNECTED_PENDING" ||
        runtime.connectionState === "OFFLINE"
      ) {
        return;
      }

      if (runtime.buildLock?.active || runtime.sleepLock?.active) return;

      const parsed = parseMoveIntentPayload(payload);
      if (!parsed) return;

      const isStoppingIntent = parsed.dir.x === 0 && parsed.dir.z === 0;

      if (isStoppingIntent) {
        const advanceAtMs = Date.now();
        await advanceRuntimeMovementPhase(
          socket.server,
          runtime,
          advanceAtMs,
          resolveCarryWeightContext,
          processAutomaticCombat
        );
      }

      const result = applyWASDInput(runtime, {
        nowMs: Date.now(),
        seq: parsed.seq,
        dir: parsed.dir,
        yaw: parsed.yawDesired,
        cameraPitch: parsed.cameraPitch,
        cameraDistance: parsed.cameraDistance,
      });

      if (!result.changed) return;

      let changed = result.changed;
      let actionChanged = false;

      if (result.startedMoving && runtime.combat?.state === "ENGAGED") {
        const combatCancelled = clearPlayerCombat(runtime);
        if (combatCancelled) {
          changed = true;
          socket.emit("combat:cancelled", {
            reason: "WASD",
            atMs: Date.now(),
          });
        }
      }

      if (result.startedMoving && runtime.action !== "move") {
        runtime.action = "move";
        actionChanged = true;
      } else if (result.stoppedMoving && !runtime.interact?.active && runtime.action !== "idle") {
        runtime.action = "idle";
        actionChanged = true;
      }

      if (!isStoppingIntent) {
        const advanceAtMs = Date.now();
        await advanceRuntimeMovementPhase(
          socket.server,
          runtime,
          advanceAtMs,
          resolveCarryWeightContext,
          processAutomaticCombat
        );
      }

      if (!changed && !actionChanged) return;

      bumpRev(runtime);
      markRuntimeDirty(userId, receivedAtMs);

      if (result.dirChanged || result.modeChanged || result.lookChanged || actionChanged) {
        const emitAtMs = Date.now();
        await emitPlayerState(socket.server, runtime, {
          nowMs: emitAtMs,
          force: true,
          includeInterest: false,
        });
      }
    } catch (e) {
      console.error("[MOVE] error:", e);
    }
  });
}

module.exports = { registerMoveHandler };
