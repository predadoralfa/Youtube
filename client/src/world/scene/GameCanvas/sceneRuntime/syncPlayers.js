import { createPlayerMesh } from "../../../entities/character/player";
import {
  applySelfColor,
  isEnemyEntity,
  readEntityVitals,
  readPosYawFromEntity,
} from "../helpers";
import { sampleGroundTilt } from "./terrain";

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
      const nextSelfHpBar = {
        hpCurrent: vitals.hpCurrent,
        hpMax: vitals.hpMax,
        staminaCurrent: vitals.staminaCurrent,
        staminaMax: vitals.staminaMax,
        hungerCurrent: vitals.hungerCurrent,
        hungerMax: vitals.hungerMax,
      };

      state.setSelfHpBar((prev) => {
        if (
          prev &&
          prev.hpCurrent === nextSelfHpBar.hpCurrent &&
          prev.hpMax === nextSelfHpBar.hpMax &&
          prev.staminaCurrent === nextSelfHpBar.staminaCurrent &&
          prev.staminaMax === nextSelfHpBar.staminaMax &&
          prev.hungerCurrent === nextSelfHpBar.hungerCurrent &&
          prev.hungerMax === nextSelfHpBar.hungerMax
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

    const entityId = String(entityIdRaw);
    nextIds.add(entityId);

    const groundY = Number(
      typeof sampleGroundHeight === "function" ? sampleGroundHeight(entity?.pos?.x ?? 0, entity?.pos?.z ?? 0) : 0
    );

    entityPositions.set(entityId, {
      x: entity.pos?.x ?? 0,
      y: groundY,
      z: entity.pos?.z ?? 0,
    });

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

    const { x, y, z, yaw } = readPosYawFromEntity(entity);
    const meshGroundY = Number(typeof sampleGroundHeight === "function" ? sampleGroundHeight(x, z) : 0);
    const groundTilt = sampleGroundTilt(sampleGroundHeight, x, z);
    const groundAnchor = Number(mesh.userData?.groundAnchor ?? mesh.geometry?.parameters?.height / 2 ?? 0.875);
    mesh.position.set(x, meshGroundY + groundAnchor, z);
    mesh.rotation.y = yaw;
    mesh.rotation.x = groundTilt.pitch;
    mesh.rotation.z = groundTilt.roll;
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
