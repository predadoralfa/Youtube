import { createPlayerMesh } from "../../../entities/character/player";
import {
  applySelfColor,
  isEnemyEntity,
  readEntityStatus,
  readEntityVitals,
  readPosYawFromEntity,
} from "../helpers";
import { sampleGroundTilt } from "./terrain";

function lerpAngle(current, target, alpha) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * alpha;
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

function resolveSelfVisualTarget(mesh, entity, state, sampleGroundHeight) {
  const movementVisual = state.movementVisualRef?.current ?? null;
  const movement = entity?.movement ?? null;
  const speed = Number(
    movement?.effectiveMoveSpeed ??
      movement?.speed ??
      state.runtimeRef.current?.effectiveMoveSpeed ??
      state.runtimeRef.current?.speed ??
      0
  );
  const authorityPos = updateAuthorityAnchor(state, entity);
  const current = {
    x: Number(mesh.position.x ?? authorityPos.x ?? 0),
    z: Number(mesh.position.z ?? authorityPos.z ?? 0),
  };
  const now = performance.now();
  const elapsed = Math.max(0, (now - Number(movementVisual?.lastAuthorityChangeAt ?? now)) / 1000);
  const stopRequestedAt = Number(movementVisual?.stopRequestedAt ?? 0);
  const stopAcked =
    stopRequestedAt > 0 &&
    Number(movementVisual?.lastAuthorityChangeAt ?? 0) >= stopRequestedAt;

  let target = { x: authorityPos.x, z: authorityPos.z };
  let yaw = Number(entity?.yaw ?? mesh.rotation.y ?? 0);

  if (!Number.isFinite(speed) || speed <= 0) {
    return { x: target.x, z: target.z, yaw };
  }

  if (movementVisual?.mode === "WASD" && String(entity?.action ?? "idle") === "move") {
    const dir = movementVisual.dir ?? movement?.dir ?? { x: 0, z: 0 };
    target = {
      x: authorityPos.x + Number(dir.x ?? 0) * speed * elapsed,
      z: authorityPos.z + Number(dir.z ?? 0) * speed * elapsed,
    };
    if (dir.x !== 0 || dir.z !== 0) {
      yaw = Math.atan2(dir.x, dir.z);
    }
  } else if (movementVisual?.mode === "STOP") {
    target = stopAcked ? { x: authorityPos.x, z: authorityPos.z } : { x: current.x, z: current.z };
  } else if (movementVisual?.mode === "CLICK" && movementVisual.clickTarget) {
    const targetPos = movementVisual.clickTarget;
    const hasClickAck =
      String(entity?.action ?? "idle") === "move" &&
      String(movement?.mode ?? "STOP").toUpperCase() === "CLICK";
    if (!hasClickAck) {
      return {
        x: current.x,
        z: current.z,
        yaw,
      };
    }
    const dx = Number(targetPos.x ?? authorityPos.x) - authorityPos.x;
    const dz = Number(targetPos.z ?? authorityPos.z) - authorityPos.z;
    const dist = Math.hypot(dx, dz);
    const stopRadius = Number(movementVisual.stopRadius ?? movement?.stopRadius ?? 0.75);
    if (String(entity?.action ?? "idle") === "idle" && dist <= Math.max(0.05, stopRadius)) {
      movementVisual.mode = "STOP";
      movementVisual.clickTarget = null;
      movementVisual.clickRequestedAt = 0;
      target = { x: authorityPos.x, z: authorityPos.z };
    } else if (dist > 0.0001) {
      const travelDist = Math.max(0, dist - Math.max(0, stopRadius));
      const step = Math.min(travelDist, speed * Math.max(elapsed, 0));
      target = {
        x: authorityPos.x + (dx / dist) * step,
        z: authorityPos.z + (dz / dist) * step,
      };
      yaw = Math.atan2(dx / dist, dz / dist);
    }
  }

  const followAlpha = movementVisual?.mode === "STOP" ? 0.35 : 1;
  const nextX = current.x + (target.x - current.x) * followAlpha;
  const nextZ = current.z + (target.z - current.z) * followAlpha;
  const nextY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(nextX, nextZ) : 0);

  return {
    x: nextX,
    y: nextY,
    z: nextZ,
    yaw,
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
  if (state.lastSelfIdRef.current !== selfKey) {
    for (const [id, mesh] of state.meshByEntityIdRef.current.entries()) {
      applySelfColor(mesh, selfKey != null && id === selfKey);
    }
    state.lastSelfIdRef.current = selfKey;
  }

  if (selfKey) {
    const selfEntity = entities.find((entity) => String(entity?.entityId ?? "") === selfKey) ?? null;
    if (selfEntity) {
      const vitals = readEntityVitals(selfEntity);
      const status = readEntityStatus(selfEntity);
      const nextSelfHpBar = {
        hpCurrent: vitals.hpCurrent,
        hpMax: vitals.hpMax,
        staminaCurrent: vitals.staminaCurrent,
        staminaMax: vitals.staminaMax,
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
      state.meshByEntityIdRef.current.set(entityId, mesh);
      scene.add(mesh);
    }

    const isSelfNow = selfKey != null && entityId === selfKey;
    if (mesh.userData?.isSelf !== isSelfNow) {
      applySelfColor(mesh, isSelfNow);
    }

    const visual = isSelfNow
      ? resolveSelfVisualTarget(mesh, entity, state, sampleGroundHeight)
      : (() => {
          const { x, y, z, yaw } = readPosYawFromEntity(entity);
          return { x, y, z, yaw };
        })();

    const nextX = visual.x ?? 0;
    const nextY = visual.y ?? null;
    const nextZ = visual.z ?? 0;
    const meshGroundY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(nextX, nextZ) : 0);
    const groundTilt = sampleGroundTilt(sampleGroundHeight, nextX, nextZ);
    const groundAnchor = Number(mesh.userData?.groundAnchor ?? mesh.geometry?.parameters?.height / 2 ?? 0.875);
    mesh.position.set(nextX, nextY == null ? meshGroundY + groundAnchor : nextY + groundAnchor, nextZ);
    mesh.rotation.y = lerpAngle(mesh.rotation.y, visual.yaw ?? mesh.rotation.y, isSelfNow ? 1 : Math.min(1, 12 * (0.016)));
    mesh.rotation.x = groundTilt.pitch;
    mesh.rotation.z = groundTilt.roll;

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
