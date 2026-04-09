import * as THREE from "three";
import { projectWorldToScreenPx } from "../helpers";

export function updateOverlayState({
  camera,
  domElement,
  tmpWorld,
  entityPositions,
  state,
}) {
  const selectedObject = state.selectedObjectRef.current;
  if (!selectedObject) {
    state.setMarker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  } else {
    selectedObject.getWorldPosition(tmpWorld);
    tmpWorld.y += 0.9;
    const screen = projectWorldToScreenPx(tmpWorld, camera, domElement);
    if (!screen) {
      state.setMarker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    } else {
      state.setMarker({ visible: true, x: screen.x, y: screen.y });
    }
  }

  state.setFloatingDamages((prev) =>
    prev.map((damage) => {
      const pos = entityPositions.get(damage.targetId);
      if (!pos) return damage;

      const screenPos = projectWorldToScreenPx(
        new THREE.Vector3(pos.x, pos.y + 1.2, pos.z),
        camera,
        domElement
      );

      return {
        ...damage,
        screenX: screenPos?.x ?? damage.screenX,
        screenY: screenPos?.y ?? damage.screenY,
      };
    })
  );

  const selected = state.selectedTargetRef.current;
  if (selected?.kind === "ENEMY") {
    const pos = entityPositions.get(String(selected.id));
    const vitals = state.entityVitalsRef.current.get(String(selected.id));

    if (!pos || !vitals || Number(vitals.hpMax ?? 0) <= 0) {
      state.setTargetHpBar(null);
      return state.setTargetLootCard(null);
    }

    const screenPos = projectWorldToScreenPx(
      new THREE.Vector3(pos.x, pos.y + 0.95, pos.z),
      camera,
      domElement
    );

    if (!screenPos) {
      state.setTargetHpBar(null);
    } else {
      state.setTargetHpBar({
        id: String(selected.id),
        x: screenPos.x,
        y: screenPos.y,
        displayName:
          state.meshByEnemyIdRef.current.get(String(selected.id))?.userData?.displayName ??
          `Enemy ${String(selected.id)}`,
        hpCurrent: Math.max(0, vitals.hpCurrent ?? 0),
        hpMax: vitals.hpMax ?? 0,
      });
    }

    return state.setTargetLootCard(null);
  }

  if (selected?.kind === "ACTOR") {
    const mesh = state.meshByActorIdRef.current.get(String(selected.id));
    const lootSummary = mesh?.userData?.lootSummary ?? null;

    if (!mesh || !lootSummary || !Array.isArray(lootSummary.items) || lootSummary.items.length === 0) {
      state.setTargetLootCard(null);
      return state.setTargetHpBar(null);
    }

    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);
    worldPos.y += 1.15;

    const screenPos = projectWorldToScreenPx(worldPos, camera, domElement);
    if (!screenPos) {
      state.setTargetLootCard(null);
    } else {
      state.setTargetLootCard({
        id: String(selected.id),
        x: screenPos.x,
        y: screenPos.y,
        actorName:
          mesh?.userData?.displayName ??
          mesh?.userData?.actorType ??
          `Actor ${String(selected.id)}`,
        lootSummary,
      });
    }

    return state.setTargetHpBar(null);
  }

  state.setTargetHpBar(null);
  state.setTargetLootCard(null);
}
