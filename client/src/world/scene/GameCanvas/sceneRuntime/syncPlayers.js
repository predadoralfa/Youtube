import { createPlayerMesh } from "../../../entities/character/player";
import {
  applySelfColor,
  isEnemyEntity,
  readEntityStatus,
  readEntityVitals,
  readPosYawFromEntity,
} from "../helpers";
import { sampleGroundTilt } from "./terrain";

const MOVE_STAMINA_DRAIN_PER_SEC = 1;
const MOVE_STAMINA_DRAIN_WARN_RATIO = 0.75;
const MOVE_STAMINA_DRAIN_DANGER_RATIO = 0.95;
const MOVE_STAMINA_DRAIN_WARN_MULTIPLIER = 1.3;
const MOVE_STAMINA_DRAIN_DANGER_MULTIPLIER = 2;
const MOVE_SPEED_AT_ZERO_STAMINA_MULTIPLIER = 0.1;
function lerpAngle(current, target, alpha) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * alpha;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readCarryWeightRatio(state) {
  const carryWeight = state?.inventorySnapshotRef?.current?.carryWeight ?? null;
  const ratio = Number(
    carryWeight?.ratio ??
      state?.inventorySnapshotRef?.current?.carryWeightRatio ??
      state?.runtimeRef?.current?.carryWeightRatio ??
      0
  );
  return Number.isFinite(ratio) ? Math.max(0, ratio) : 0;
}

function resolveCarryWeightDrainMultiplier(ratio) {
  const safeRatio = clamp(Number(ratio ?? 0), 0, Number.POSITIVE_INFINITY);
  if (safeRatio >= MOVE_STAMINA_DRAIN_DANGER_RATIO) {
    return MOVE_STAMINA_DRAIN_DANGER_MULTIPLIER;
  }
  if (safeRatio >= MOVE_STAMINA_DRAIN_WARN_RATIO) {
    return MOVE_STAMINA_DRAIN_WARN_MULTIPLIER;
  }
  return MOVE_STAMINA_DRAIN_PER_SEC;
}

function readPredictedMovementState(entity, state, now, moving) {
  const movementVisual = state.movementVisualRef?.current ?? null;
  const vitals = readEntityVitals(entity);
  const staminaCurrent = Number(vitals.staminaCurrent ?? 0);
  const staminaMax = Math.max(0, Number(vitals.staminaMax ?? 0));
  const authorityKey = `${staminaCurrent}:${staminaMax}:${Number(entity?.rev ?? 0)}`;

  if (!movementVisual) {
    const effectiveMultiplier =
      staminaCurrent <= 0 ? MOVE_SPEED_AT_ZERO_STAMINA_MULTIPLIER : 1;
    return {
      staminaCurrent,
      staminaMax,
      effectiveMultiplier,
    };
  }

  if (movementVisual.predictedVitalsKey !== authorityKey) {
    movementVisual.predictedVitalsKey = authorityKey;
    movementVisual.predictedVitalsAt = now;
    movementVisual.predictedStaminaCurrent = staminaCurrent;
    movementVisual.predictedStaminaMax = staminaMax;
  }

  const lastPredictedAt = Number(movementVisual.predictedVitalsAt ?? now);
  const dt = clamp((now - lastPredictedAt) / 1000, 0, 0.05);
  const currentPredicted = Number(
    movementVisual.predictedStaminaCurrent ?? staminaCurrent
  );
  const nextMax = Math.max(
    0,
    Number(movementVisual.predictedStaminaMax ?? staminaMax)
  );

  if (dt > 0) {
    const drain = moving ? resolveCarryWeightDrainMultiplier(readCarryWeightRatio(state)) * dt : 0;
    movementVisual.predictedStaminaCurrent = clamp(currentPredicted - drain, 0, nextMax);
    movementVisual.predictedStaminaMax = nextMax;
    movementVisual.predictedVitalsAt = now;
  }

  const nextCurrent = Number(movementVisual.predictedStaminaCurrent ?? staminaCurrent);
  return {
    staminaCurrent: nextCurrent,
    staminaMax: nextMax,
    effectiveMultiplier:
      nextCurrent <= 0 ? MOVE_SPEED_AT_ZERO_STAMINA_MULTIPLIER : 1,
  };
}

function stepToward(origin, target, maxStep) {
  const dx = Number(target?.x ?? 0) - Number(origin?.x ?? 0);
  const dz = Number(target?.z ?? 0) - Number(origin?.z ?? 0);
  const dist = Math.hypot(dx, dz);
  if (dist <= 0.0001 || maxStep <= 0) {
    return {
      x: Number(origin?.x ?? 0),
      z: Number(origin?.z ?? 0),
      yaw: null,
      dist,
    };
  }

  const step = Math.min(dist, maxStep);
  return {
    x: Number(origin?.x ?? 0) + (dx / dist) * step,
    z: Number(origin?.z ?? 0) + (dz / dist) * step,
    yaw: Math.atan2(dx / dist, dz / dist),
    dist,
  };
}

function readFrameStepSeconds(movementVisual, now) {
  if (!movementVisual) {
    return 1 / 60;
  }

  const lastAt = Number(movementVisual.lastVisualStepAt ?? 0);
  const dt = lastAt > 0 ? clamp((now - lastAt) / 1000, 0, 0.05) : 1 / 60;
  movementVisual.lastVisualStepAt = now;
  return dt;
}

function readAuthorityClickTarget(movement) {
  const x = Number(movement?.target?.x ?? NaN);
  const z = Number(movement?.target?.z ?? NaN);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return null;
  }
  return { x, z };
}

function updateAuthorityAnchor(state, entity) {
  const movementVisual = state.movementVisualRef?.current ?? null;
  const pos = {
    x: Number(entity?.pos?.x ?? 0),
    z: Number(entity?.pos?.z ?? 0),
  };

  if (!movementVisual) {
    return pos;
  }

  const lastAuthorityPos = movementVisual.lastAuthorityPos ?? null;
  const changed =
    !lastAuthorityPos ||
    Math.abs(Number(lastAuthorityPos.x ?? 0) - pos.x) > 0.0001 ||
    Math.abs(Number(lastAuthorityPos.z ?? 0) - pos.z) > 0.0001;

  if (changed) {
    movementVisual.lastAuthorityPos = { x: pos.x, z: pos.z };
    movementVisual.lastAuthorityChangeAt = performance.now();
  }

  return movementVisual.lastAuthorityPos ?? pos;
}

function resolveSelfVisualTarget(mesh, entity, state, sampleGroundHeight, predictedMovement = null) {
  const movementVisual = state.movementVisualRef?.current ?? null;
  const movement = entity?.movement ?? null;
  const now = performance.now();
  const authorityPos = updateAuthorityAnchor(state, entity);
  const current = {
    x: Number(mesh.position.x ?? authorityPos.x ?? 0),
    z: Number(mesh.position.z ?? authorityPos.z ?? 0),
  };
  const localMode = String(movementVisual?.mode ?? "STOP").toUpperCase();
  const authorityMode = String(movement?.mode ?? "STOP").toUpperCase();
  const authorityClickTarget = readAuthorityClickTarget(movement);
  const shouldUseAuthorityClick =
    authorityMode === "CLICK" &&
    authorityClickTarget != null &&
    localMode !== "WASD";
  const mode = shouldUseAuthorityClick ? "CLICK" : localMode;
  const isAuthorityMoving = String(entity?.action ?? "idle") === "move";
  const isPredictingMove =
    (mode === "WASD" && isAuthorityMoving) ||
    mode === "CLICK" ||
    (mode === "STOP" && !Number.isFinite(Number(movement?.effectiveMoveSpeed ?? NaN)));
  const resolvedPrediction =
    predictedMovement ??
    readPredictedMovementState(
      entity,
      state,
      now,
      isPredictingMove && mode !== "STOP"
    );
  const effectiveSpeed = Number(
    movement?.effectiveMoveSpeed ??
      state.runtimeRef.current?.effectiveMoveSpeed ??
      NaN
  );
  const baseSpeed = Number(
    movement?.speed ??
      state.runtimeRef.current?.speed ??
      NaN
  );
  const speed = Number.isFinite(effectiveSpeed) && effectiveSpeed > 0
    ? effectiveSpeed
    : Number.isFinite(baseSpeed) && baseSpeed > 0
      ? baseSpeed * resolvedPrediction.effectiveMultiplier
      : 0;
  const elapsed = Math.max(0, (now - Number(movementVisual?.lastAuthorityChangeAt ?? now)) / 1000);
  const transitionStartedAt = Math.max(
    Number(movementVisual?.directionChangedAt ?? 0),
    Number(movementVisual?.clickRequestedAt ?? 0)
  );
  const transitionAgeMs =
    transitionStartedAt > 0 ? Math.max(0, now - transitionStartedAt) : Number.POSITIVE_INFINITY;
  const stopRequestedAt = Number(movementVisual?.stopRequestedAt ?? 0);
  const hasPendingLocalStop = stopRequestedAt > 0;
  const stopAcked =
    hasPendingLocalStop &&
    String(entity?.action ?? "idle") !== "move";
  const frameStepSeconds = readFrameStepSeconds(movementVisual, now);
  let target = { x: authorityPos.x, z: authorityPos.z };
  let yaw = Number(entity?.yaw ?? mesh.rotation.y ?? 0);
  let followAlpha = mode === "STOP" ? 0.35 : 1;
  if (transitionAgeMs < 90) {
    followAlpha = Math.min(followAlpha, 0.25);
  }

  if (!Number.isFinite(speed) || speed <= 0) {
    return { x: target.x, z: target.z, yaw, followAlpha };
  }

  if (mode === "WASD" && String(entity?.action ?? "idle") !== "move") {
    return {
      x: current.x,
      z: current.z,
      yaw,
      followAlpha: 1,
    };
  }

  if (mode === "WASD" && String(entity?.action ?? "idle") === "move") {
    const dir = movementVisual.dir ?? movement?.dir ?? { x: 0, z: 0 };
    target = {
      x: current.x + Number(dir.x ?? 0) * speed * frameStepSeconds,
      z: current.z + Number(dir.z ?? 0) * speed * frameStepSeconds,
    };
    if (dir.x !== 0 || dir.z !== 0) {
      yaw = Math.atan2(dir.x, dir.z);
    }
  } else if (mode === "STOP") {
    if (!hasPendingLocalStop) {
      target = { x: authorityPos.x, z: authorityPos.z };
    } else if (!stopAcked) {
      target = { x: current.x, z: current.z };
      followAlpha = 1;
    } else {
      target = { x: authorityPos.x, z: authorityPos.z };
    }
  } else if (mode === "CLICK" && (movementVisual?.clickTarget || authorityClickTarget)) {
    const targetPos = shouldUseAuthorityClick
      ? authorityClickTarget
      : movementVisual.clickTarget;
    const hasClickAck =
      String(entity?.action ?? "idle") === "move" &&
      String(movement?.mode ?? "STOP").toUpperCase() === "CLICK";
    const stopRadius = Number(movement?.stopRadius ?? movementVisual?.stopRadius ?? 0.75);
    if (!hasClickAck) {
      if (String(entity?.action ?? "idle") !== "move") {
        return {
          x: current.x,
          z: current.z,
          yaw,
        };
      }
      const nextStep = stepToward(
        current,
        targetPos,
        Math.max(0, speed * frameStepSeconds)
      );
      return {
        x: nextStep.x,
        z: nextStep.z,
        yaw: nextStep.yaw ?? yaw,
        followAlpha: 1,
      };
    }
    const dx = Number(targetPos.x ?? authorityPos.x) - authorityPos.x;
    const dz = Number(targetPos.z ?? authorityPos.z) - authorityPos.z;
    const dist = Math.hypot(dx, dz);
    if (String(entity?.action ?? "idle") === "idle" && dist <= Math.max(0.05, stopRadius)) {
      if (movementVisual) {
        movementVisual.mode = "STOP";
        movementVisual.clickTarget = null;
        movementVisual.clickRequestedAt = 0;
      }
      target = { x: authorityPos.x, z: authorityPos.z };
    } else if (dist > 0.0001) {
      const travelDist = Math.max(0, dist - Math.max(0, stopRadius));
      const step = Math.min(travelDist, speed * frameStepSeconds);
      target = {
        x: current.x + (dx / dist) * step,
        z: current.z + (dz / dist) * step,
      };
      yaw = Math.atan2(dx / dist, dz / dist);
    }
  }

  const nextX = current.x + (target.x - current.x) * followAlpha;
  const nextZ = current.z + (target.z - current.z) * followAlpha;
  const nextY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(nextX, nextZ) : 0);

  return {
    x: nextX,
    y: nextY,
    z: nextZ,
    yaw,
    followAlpha,
  };
}

export function syncPlayerMeshes({
  entities,
  selfKey,
  scene,
  state,
  clearSelection,
  entityPositions,
  sampleGroundHeight,
  update,
}) {
  const loggedSelfMeshRef = state.loggedSelfMeshRef ?? null;
  if (state.lastSelfIdRef.current !== selfKey) {
    for (const [id, mesh] of state.meshByEntityIdRef.current.entries()) {
      applySelfColor(mesh, selfKey != null && id === selfKey);
    }
    state.lastSelfIdRef.current = selfKey;
  }

  const selfEntityForVisual =
    selfKey != null
      ? entities.find((entity) => String(entity?.entityId ?? "") === selfKey) ?? null
      : null;
  const selfMovementVisual = state.movementVisualRef?.current ?? null;
  const selfMovementMode = String(selfMovementVisual?.mode ?? "STOP").toUpperCase();
  const selfMovementPrediction = selfEntityForVisual
    ? readPredictedMovementState(
        selfEntityForVisual,
        state,
        performance.now(),
        selfMovementMode === "WASD" || selfMovementMode === "CLICK"
      )
    : null;

  if (selfKey) {
    const selfEntity = selfEntityForVisual;
    if (selfEntity) {
      const vitals = readEntityVitals(selfEntity);
      const status = readEntityStatus(selfEntity);
      const nextSelfHpBar = {
        hpCurrent: vitals.hpCurrent,
        hpMax: vitals.hpMax,
        staminaCurrent:
          selfMovementMode === "WASD" || selfMovementMode === "CLICK"
            ? selfMovementPrediction?.staminaCurrent ?? vitals.staminaCurrent
            : vitals.staminaCurrent,
        staminaMax:
          selfMovementMode === "WASD" || selfMovementMode === "CLICK"
            ? selfMovementPrediction?.staminaMax ?? vitals.staminaMax
            : vitals.staminaMax,
        hungerCurrent: vitals.hungerCurrent,
        hungerMax: vitals.hungerMax,
        thirstCurrent: vitals.thirstCurrent,
        thirstMax: vitals.thirstMax,
        immunityCurrent: status.immunityCurrent,
        immunityMax: status.immunityMax,
        feverCurrent: status.feverCurrent,
        feverMax: status.feverMax,
        feverSeverity: status.feverSeverity,
        feverTier: status.feverTier,
        feverTempoMultiplier: status.feverTempoMultiplier,
        feverStaminaRegenMultiplier: status.feverStaminaRegenMultiplier,
        sleepCurrent: status.sleepCurrent,
        sleepMax: status.sleepMax,
      };

      state.setSelfHpBar((prev) => {
        if (
          prev &&
          prev.hpCurrent === nextSelfHpBar.hpCurrent &&
          prev.hpMax === nextSelfHpBar.hpMax &&
          prev.staminaCurrent === nextSelfHpBar.staminaCurrent &&
          prev.staminaMax === nextSelfHpBar.staminaMax &&
          prev.hungerCurrent === nextSelfHpBar.hungerCurrent &&
          prev.hungerMax === nextSelfHpBar.hungerMax &&
          prev.thirstCurrent === nextSelfHpBar.thirstCurrent &&
          prev.thirstMax === nextSelfHpBar.thirstMax &&
          prev.immunityCurrent === nextSelfHpBar.immunityCurrent &&
          prev.immunityMax === nextSelfHpBar.immunityMax &&
          prev.feverCurrent === nextSelfHpBar.feverCurrent &&
          prev.feverMax === nextSelfHpBar.feverMax &&
          prev.feverSeverity === nextSelfHpBar.feverSeverity &&
          prev.feverTier === nextSelfHpBar.feverTier &&
          prev.feverTempoMultiplier === nextSelfHpBar.feverTempoMultiplier &&
          prev.feverStaminaRegenMultiplier === nextSelfHpBar.feverStaminaRegenMultiplier &&
          prev.sleepCurrent === nextSelfHpBar.sleepCurrent &&
          prev.sleepMax === nextSelfHpBar.sleepMax
        ) {
          return prev;
        }
        return nextSelfHpBar;
      });

    }
  }

  const nextIds = new Set();
  for (const entity of entities) {
    const entityIdRaw = entity?.entityId;
    if (entityIdRaw == null || isEnemyEntity(entity)) continue;

    const kind = String(entity?.kind ?? "").trim().toUpperCase();
    const isSelfEntity = selfKey != null && String(entityIdRaw) === selfKey;
    if (kind !== "PLAYER" && !isSelfEntity) continue;

    const entityId = String(entityIdRaw);
    nextIds.add(entityId);

    const vitals = readEntityVitals(entity);
    const previous = state.entityVitalsRef.current.get(entityId) ?? {};
    state.entityVitalsRef.current.set(entityId, { ...previous, ...vitals });

    let mesh = state.meshByEntityIdRef.current.get(entityId);
    if (!mesh) {
      mesh = createPlayerMesh({ isSelf: selfKey != null && entityId === selfKey });
      mesh.userData.kind = "PLAYER";
      mesh.userData.entityId = entityId;
      const spawnX = Number(entity?.pos?.x ?? 0);
      const spawnZ = Number(entity?.pos?.z ?? 0);
      const spawnGroundY = Number(
        typeof sampleGroundHeight === "function" ? sampleGroundHeight(spawnX, spawnZ) : 0
      );
      const spawnAnchor = Number(
        mesh.userData?.groundAnchor ?? mesh.geometry?.parameters?.height / 2 ?? 0.875
      );
      mesh.position.set(spawnX, spawnGroundY + spawnAnchor, spawnZ);
      state.meshByEntityIdRef.current.set(entityId, mesh);
      scene.add(mesh);
    }

    const isSelfNow = selfKey != null && entityId === selfKey;
    if (mesh.userData?.isSelf !== isSelfNow) {
      applySelfColor(mesh, isSelfNow);
    }

    const visual = isSelfNow
      ? resolveSelfVisualTarget(mesh, entity, state, sampleGroundHeight, selfMovementPrediction)
      : (() => {
          const { x, z, yaw } = readPosYawFromEntity(entity);
          const y = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(x, z) : 0);
          return { x, y, z, yaw };
        })();

    const nextX = visual.x ?? 0;
    const nextY = visual.y ?? null;
    const nextZ = visual.z ?? 0;
    const meshGroundY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(nextX, nextZ) : 0);
    const groundTilt = sampleGroundTilt(sampleGroundHeight, nextX, nextZ);
    const groundAnchor = Number(mesh.userData?.groundAnchor ?? mesh.geometry?.parameters?.height / 2 ?? 0.875);
    mesh.position.set(nextX, nextY == null ? meshGroundY + groundAnchor : nextY + groundAnchor, nextZ);
    const selfRotationAlpha = Number.isFinite(visual.followAlpha) ? visual.followAlpha : 1;
    mesh.rotation.y = lerpAngle(
      mesh.rotation.y,
      visual.yaw ?? mesh.rotation.y,
      isSelfNow ? selfRotationAlpha : Math.min(1, 12 * (0.016))
    );
    mesh.rotation.x = groundTilt.pitch;
    mesh.rotation.z = groundTilt.roll;

    if (
      isSelfNow &&
      state.debugSelfMeshLoggedRef?.current !== true
    ) {
      state.debugSelfMeshLoggedRef.current = true;
      console.log(
        `[CLIENT_SELF_MESH] entity=(${Number(entity?.pos?.x ?? NaN)}, ${Number(
          entity?.pos?.z ?? NaN
        )}) visual=(${Number(nextX ?? NaN)}, ${Number(nextZ ?? NaN)}) ` +
          `mesh=(${Number(mesh.position.x ?? NaN)}, ${Number(mesh.position.z ?? NaN)})`
      );
    }

    entityPositions.set(entityId, {
      x: nextX,
      y: meshGroundY,
      z: nextZ,
    });
  }

  for (const [entityId, mesh] of state.meshByEntityIdRef.current.entries()) {
    if (nextIds.has(entityId)) continue;

    const selected = state.selectedTargetRef.current;
    if (selected?.kind === "PLAYER" && String(selected.id) === String(entityId)) {
      clearSelection();
    }

    scene.remove(mesh);
    try {
      mesh.geometry?.dispose?.();
      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) material?.dispose?.();
      } else {
        mesh.material?.dispose?.();
      }
    } catch {}

    state.meshByEntityIdRef.current.delete(entityId);
    state.entityVitalsRef.current.delete(entityId);
    entityPositions.delete(entityId);
  }

  const heroMesh = selfKey ? state.meshByEntityIdRef.current.get(selfKey) : null;
  update(heroMesh ?? null);
}
