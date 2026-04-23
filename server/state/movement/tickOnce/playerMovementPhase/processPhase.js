"use strict";

const { markRuntimeDirty, markStatsDirty } = require("../../../runtimeStore");
const { moveUserChunk, computeChunkFromPos } = require("../../../presenceIndex");
const { getActiveSocket } = require("../../../../socket/sessionIndex");
const { DT_MAX } = require("../../config");
const { computeDtSeconds, readRuntimeSpeedStrict } = require("../../math");
const { moveEntityByDirection, moveEntityTowardTarget } = require("../../entityMotion");
const { bumpRev, toDelta } = require("../../entity");
const { ensureMovementInputState, stopMovement } = require("../../input");
const {
  applyStaminaTick,
  resolveCarryWeightDrainMultiplier,
  resolveMoveSpeedMultiplierFromStamina,
  shouldQueueStaminaPersist,
} = require("../../stamina");
const { handleChunkTransition } = require("../../chunkTransition");
const { emitPlayerState, emitSelfVitals } = require("./emitPlayerState");
const { handleReachedTarget } = require("./handleReachedTarget");

function hasDir(dir) {
  return Number(dir?.x ?? 0) !== 0 || Number(dir?.z ?? 0) !== 0;
}

async function applyChunkTransition(io, rt) {
  const { cx, cz } = computeChunkFromPos(rt.pos);
  const prevCx = Number(rt.chunk?.cx);
  const prevCz = Number(rt.chunk?.cz);
  const chunkChanged = prevCx !== cx || prevCz !== cz;
  const socket = getActiveSocket(rt.userId);

  if (!chunkChanged) {
    return { chunkChanged, socket };
  }

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

  return { chunkChanged, socket };
}

async function processWASDMovement(io, rt, t, dt, resolveCarryWeightContext, processAutomaticCombat) {
  const input = ensureMovementInputState(rt);
  if (input.mode !== "WASD" || !hasDir(input.dir)) return;

  const speed = readRuntimeSpeedStrict(rt);
  if (speed == null || !rt.bounds) return;

  const currentStamina =
    rt?.staminaCurrent ?? rt?.stats?.staminaCurrent ?? rt?.combat?.staminaCurrent;
  const carryWeight = await resolveCarryWeightContext(rt.userId);
  const projectedDrain = resolveCarryWeightDrainMultiplier(carryWeight?.ratio ?? 0) * dt;
  const moveSpeedMultiplier = resolveMoveSpeedMultiplierFromStamina(
    currentStamina,
    Number(currentStamina ?? 0) - projectedDrain
  );
  rt.effectiveMoveSpeed = speed * moveSpeedMultiplier;

  const movement = moveEntityByDirection({
    pos: rt.pos,
    dir: input.dir,
    speed: rt.effectiveMoveSpeed,
    dt,
    bounds: rt.bounds,
  });

  if (!movement.ok) return;

  const moved = movement.moved;
  const yawChanged = Number.isFinite(Number(input.yaw)) && Number(rt.yaw ?? 0) !== Number(input.yaw);
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

  if (!moved && !yawChanged && !staminaResult.changed) return;

  if (moved) {
    rt.pos = movement.pos;
  }
  if (yawChanged) {
    rt.yaw = Number(input.yaw);
  }
  rt.action = "move";

  if (staminaState.changed) {
    markStatsDirty(rt.userId, t);
  }

  bumpRev(rt);
  markRuntimeDirty(rt.userId, t);

  if (staminaState.changed) {
    emitSelfVitals(getActiveSocket(rt.userId), rt, toDelta(rt));
  }

  const { chunkChanged } = await applyChunkTransition(io, rt);
  if (chunkChanged) {
    await emitPlayerState(io, rt, {
      nowMs: t,
      includeSelf: false,
    });
  }

  if (rt.combat?.state === "ENGAGED" && rt.combat?.targetKind === "ENEMY") {
    await processAutomaticCombat(io, rt, t);
  }
}

async function processClickMovement(io, rt, t, dt, resolveCarryWeightContext, processAutomaticCombat) {
  const input = ensureMovementInputState(rt);
  if (input.mode !== "CLICK" || !input.target) return;

  const speed = readRuntimeSpeedStrict(rt);
  if (speed == null || !rt.bounds) return;

  const currentStamina =
    rt?.staminaCurrent ?? rt?.stats?.staminaCurrent ?? rt?.combat?.staminaCurrent;
  const carryWeight = await resolveCarryWeightContext(rt.userId);
  const projectedDrain = resolveCarryWeightDrainMultiplier(carryWeight?.ratio ?? 0) * dt;
  const moveSpeedMultiplier = resolveMoveSpeedMultiplierFromStamina(
    currentStamina,
    Number(currentStamina ?? 0) - projectedDrain
  );
  rt.effectiveMoveSpeed = speed * moveSpeedMultiplier;

  const target = input.target;
  if (!Number.isFinite(Number(target?.x)) || !Number.isFinite(Number(target?.z))) {
    stopMovement(rt, { nowMs: t });
    rt.action = "idle";
    bumpRev(rt);
    markRuntimeDirty(rt.userId, t);
    await emitPlayerState(io, rt, { nowMs: t, force: true });
    return;
  }

  const stopRadius = Number(input.stopRadius ?? 0.75);
  const stopR = Number.isFinite(stopRadius) && stopRadius > 0 ? stopRadius : 0.75;

  const movement = moveEntityTowardTarget({
    pos: rt.pos,
    target,
    speed: rt.effectiveMoveSpeed,
    dt,
    bounds: rt.bounds,
    stopRadius: stopR,
  });

  if (!movement.ok) return;

  if (movement.reached) {
    const inCombat = await handleReachedTarget(io, rt, t, processAutomaticCombat);
    if (!inCombat && (!rt.interact?.active || rt.interact?.kind !== "ACTOR")) {
      await emitPlayerState(io, rt, { nowMs: t, force: true });
    }
    return;
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

  if (!moved && !yawChanged && !staminaResult.changed) return;

  rt.pos = movement.pos;
  if (newYaw != null) rt.yaw = newYaw;
  rt.action = "move";

  if (staminaState.changed) {
    markStatsDirty(rt.userId, t);
  }

  bumpRev(rt);
  markRuntimeDirty(rt.userId, t);

  const { chunkChanged } = await applyChunkTransition(io, rt);
  if (chunkChanged) {
    await emitPlayerState(io, rt, {
      nowMs: t,
      includeSelf: false,
    });
  }

  if (rt.combat?.state === "ENGAGED" && rt.combat?.targetKind === "ENEMY") {
    await processAutomaticCombat(io, rt, t);
  }
}

async function processPlayerMovementPhase(io, allRuntimes, t, resolveCarryWeightContext, processAutomaticCombat) {
  for (const rt of allRuntimes) {
    if (!rt) continue;
    if (rt.connectionState === "DISCONNECTED_PENDING" || rt.connectionState === "OFFLINE") continue;

    await advanceRuntimeMovementPhase(io, rt, t, resolveCarryWeightContext, processAutomaticCombat);
  }
}

async function advanceRuntimeMovementPhase(io, rt, t, resolveCarryWeightContext, processAutomaticCombat) {
  if (!rt) return;

  ensureMovementInputState(rt);

  const dt = computeDtSeconds(t, rt.moveTickAtMs, DT_MAX);
  rt.moveTickAtMs = t;
  if (dt <= 0) return;

  await processWASDMovement(io, rt, t, dt, resolveCarryWeightContext, processAutomaticCombat);
  await processClickMovement(io, rt, t, dt, resolveCarryWeightContext, processAutomaticCombat);
}

module.exports = {
  advanceRuntimeMovementPhase,
  processPlayerMovementPhase,
};
