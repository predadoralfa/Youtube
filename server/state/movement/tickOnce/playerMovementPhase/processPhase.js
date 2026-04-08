"use strict";

const { markRuntimeDirty, markStatsDirty } = require("../../../runtimeStore");
const { moveUserChunk, computeChunkFromPos } = require("../../../presenceIndex");
const { getActiveSocket } = require("../../../../socket/sessionIndex");
const { DT_MAX } = require("../../config");
const { computeDtSeconds, readRuntimeSpeedStrict } = require("../../math");
const { moveEntityTowardTarget } = require("../../entityMotion");
const { bumpRev } = require("../../entity");
const {
  applyStaminaTick,
  resolveCarryWeightDrainMultiplier,
  resolveMoveSpeedMultiplierFromStamina,
  shouldQueueStaminaPersist,
} = require("../../stamina");
const { handleChunkTransition } = require("../../chunkTransition");
const { emitPlayerState } = require("./emitPlayerState");
const { handleReachedTarget } = require("./handleReachedTarget");

async function processPlayerMovementPhase(io, allRuntimes, t, resolveCarryWeightContext, processAutomaticCombat) {
  for (const rt of allRuntimes) {
    if (!rt) continue;
    if (rt.connectionState === "DISCONNECTED_PENDING" || rt.connectionState === "OFFLINE") continue;
    if (rt.moveMode !== "CLICK" || !rt.moveTarget) continue;

    const dt = computeDtSeconds(t, rt.moveTickAtMs, DT_MAX);
    rt.moveTickAtMs = t;
    if (dt <= 0) continue;

    const speed = readRuntimeSpeedStrict(rt);
    if (speed == null || !rt.bounds) continue;

    const currentStamina = rt?.staminaCurrent ?? rt?.stats?.staminaCurrent ?? rt?.combat?.staminaCurrent;
    const carryWeight = await resolveCarryWeightContext(rt.userId);
    const projectedDrain = resolveCarryWeightDrainMultiplier(carryWeight?.ratio ?? 0) * dt;
    const moveSpeedMultiplier = resolveMoveSpeedMultiplierFromStamina(
      currentStamina,
      Number(currentStamina ?? 0) - projectedDrain
    );

    const target = rt.moveTarget;
    if (!Number.isFinite(Number(target?.x)) || !Number.isFinite(Number(target?.z))) {
      rt.moveTarget = null;
      rt.moveMode = "STOP";
      rt.action = "idle";
      bumpRev(rt);
      markRuntimeDirty(rt.userId, t);
      continue;
    }

    const stopRadius = Number(rt.moveStopRadius ?? 0.75);
    const stopR = Number.isFinite(stopRadius) && stopRadius > 0 ? stopRadius : 0.75;

    const movement = moveEntityTowardTarget({
      pos: rt.pos,
      target,
      speed: speed * moveSpeedMultiplier,
      dt,
      bounds: rt.bounds,
      stopRadius: stopR,
    });

    if (!movement.ok) continue;

    if (movement.reached) {
      const inCombat = await handleReachedTarget(io, rt, t, processAutomaticCombat);
      if (!inCombat && (!rt.interact?.active || rt.interact?.kind !== "ACTOR")) {
        continue;
      }
      continue;
    }

    const moved = movement.moved;
    const newYaw = movement.yaw;
    const yawChanged = newYaw != null && rt.yaw !== newYaw;
    const carryWeightAfterMove = moved ? await resolveCarryWeightContext(rt.userId) : null;
    const staminaResult = applyStaminaTick(rt, t, {
      movedReal: moved,
      carryWeightRatio: carryWeightAfterMove?.ratio ?? 0,
    });

    const staminaState = shouldQueueStaminaPersist(
      rt,
      rt?.staminaCurrent ?? rt?.stats?.staminaCurrent ?? rt?.combat?.staminaCurrent,
      rt?.staminaMax ?? rt?.stats?.staminaMax ?? rt?.combat?.staminaMax
    );

    if (!moved && !yawChanged && !staminaResult.changed) continue;

    rt.pos = movement.pos;
    if (newYaw != null) rt.yaw = newYaw;
    rt.action = "move";

    if (staminaState.changed) {
      markStatsDirty(rt.userId, t);
    }

    bumpRev(rt);
    markRuntimeDirty(rt.userId, t);

    const { cx, cz } = computeChunkFromPos(rt.pos);
    const prevCx = Number(rt.chunk?.cx);
    const prevCz = Number(rt.chunk?.cz);
    const chunkChanged = prevCx !== cx || prevCz !== cz;
    const socket = getActiveSocket(rt.userId);

    if (chunkChanged) {
      const movedInfo = moveUserChunk(rt.userId, cx, cz);
      rt.chunk = { cx, cz };

      if (socket && movedInfo?.diff?.entered) {
        for (const r of movedInfo.diff.entered) socket.join(r);
      }
      if (socket && movedInfo?.diff?.left) {
        for (const r of movedInfo.diff.left) socket.leave(r);
      }

      if (movedInfo) {
        handleChunkTransition(io, socket, rt, movedInfo);
      }
    }

    await emitPlayerState(io, rt);

    if (rt.combat?.state === "ENGAGED" && rt.combat?.targetKind === "ENEMY") {
      await processAutomaticCombat(io, rt, t);
    }
  }
}

module.exports = {
  processPlayerMovementPhase,
};
