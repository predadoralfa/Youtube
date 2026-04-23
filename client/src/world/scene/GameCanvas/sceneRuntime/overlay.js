import * as THREE from "three";
import { projectWorldToScreenPx } from "../helpers";
import { resolvePrimitiveShelterBuildRequirements } from "@/world/build/requirements";

export function updateOverlayState({
  camera,
  domElement,
  tmpWorld,
  entityPositions,
  state,
}) {
  const buildPlacement = state.buildPlacementRef?.current ?? null;
  if (!buildPlacement?.visible) {
    state.setBuildPlacementMarker((prev) => (prev?.visible ? null : prev));
  } else {
    const worldPos = buildPlacement.worldPos ?? null;
    const x = Number(worldPos?.x ?? NaN);
    const z = Number(worldPos?.z ?? NaN);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      state.setBuildPlacementMarker((prev) => (prev?.visible ? null : prev));
    } else {
      const screenPos = projectWorldToScreenPx(new THREE.Vector3(x, 0.06, z), camera, domElement);
      if (!screenPos) {
        state.setBuildPlacementMarker((prev) => (prev?.visible ? null : prev));
      } else {
        state.setBuildPlacementMarker({
          visible: true,
          x: screenPos.x,
          y: screenPos.y,
          width: 128,
          height: 64,
          label: buildPlacement.label ?? "Primitive Shelter",
        });
      }
    }
  }

  if (buildPlacement?.visible) {
    state.setTargetPlayerCard(null);
    state.setTargetLootCard(null);
    state.setTargetHpBar(null);
    state.setTargetBuildCard(null);
  }

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
    const selectedId = String(selected.id);
    const predicted = state.predictedEnemyVitalsRef.current.get(selectedId) ?? null;
    const vitals = predicted ?? state.entityVitalsRef.current.get(selectedId);

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

  if (selected?.kind === "PLAYER") {
    const pos = entityPositions.get(String(selected.id));
    const vitals = state.entityVitalsRef.current.get(String(selected.id));

    if (!pos || !vitals || Number(vitals.hpMax ?? 0) <= 0) {
      state.setTargetPlayerCard(null);
      state.setTargetHpBar(null);
      return state.setTargetLootCard(null);
    }

    const mesh = state.meshByEntityIdRef.current.get(String(selected.id));
    state.setTargetPlayerCard({
      id: String(selected.id),
      displayName:
        mesh?.userData?.displayName ??
        mesh?.userData?.entityName ??
        `Player ${String(selected.id)}`,
      hpCurrent: Math.max(0, vitals.hpCurrent ?? 0),
      hpMax: vitals.hpMax ?? 0,
    });

    state.setTargetHpBar(null);
    return state.setTargetLootCard(null);
  }

  if (selected?.kind === "ACTOR") {
    const actorId = String(selected.id);
    const mesh = state.meshByActorIdRef.current.get(actorId);
    const snapshotActor = Array.isArray(state.actorsRef.current)
      ? state.actorsRef.current.find((actor) => String(actor?.id) === actorId) ?? null
      : null;
    const lootSummary = mesh?.userData?.lootSummary ?? snapshotActor?.lootSummary ?? null;
    const actorType = String(
      snapshotActor?.actorType ??
      snapshotActor?.actorDefCode ??
      mesh?.userData?.actorType ??
      ""
    ).trim().toUpperCase();
    const actorState = snapshotActor?.state ?? mesh?.userData?.state ?? null;
    const isBuildActor =
      actorType === "PRIMITIVE_SHELTER" ||
      String(actorState?.buildKind ?? "").trim().toUpperCase() === "PRIMITIVE_SHELTER" ||
      String(actorState?.constructionKind ?? "").trim().toUpperCase() === "PRIMITIVE_SHELTER";

    if (isBuildActor) {
      const buildState = resolvePrimitiveShelterBuildRequirements(actorState, state.inventorySnapshotRef.current, {
        actorId,
      });
      const worldPos = new THREE.Vector3();
      mesh?.getWorldPosition?.(worldPos);
      worldPos.y += 1.05;
      const screenPos = projectWorldToScreenPx(worldPos, camera, domElement);

      if (!screenPos) {
        state.setTargetBuildCard(null);
      } else {
        const selfUserId = Number(state.runtimeRef.current?.userId ?? state.runtimeRef.current?.user_id ?? 0) || null;
        const ownerUserId = Number(actorState?.ownerUserId ?? actorState?.owner_user_id ?? actorState?.ownerId ?? 0) || null;
        const ownerName =
          String(actorState?.ownerName ?? actorState?.owner_name ?? snapshotActor?.displayName ?? "Unknown").trim() || "Unknown";
        const isOwner = selfUserId != null && ownerUserId != null && Number(selfUserId) === Number(ownerUserId);
        const canCancel = isOwner && buildState.canCancel;
        const canBuild = isOwner && buildState.canBuild;
        const canPause = isOwner && buildState.canPause;
        const canResume = isOwner && buildState.canResume;
        const canDeposit = isOwner && buildState.canDeposit;
        const canSleep = isOwner && buildState.isCompleted;
        const canDismantle = isOwner && buildState.canDismantle;
        const sleepCurrent =
          Number(state.runtimeRef.current?.status?.sleep?.current ?? state.runtimeRef.current?.sleepCurrent ?? 100);
        const sleepMax =
          Math.max(1, Number(state.runtimeRef.current?.status?.sleep?.max ?? state.runtimeRef.current?.sleepMax ?? 100));

        state.setTargetBuildCard({
          id: actorId,
          x: screenPos.x,
          y: screenPos.y,
          displayName:
            String(actorState?.displayName ?? actorState?.structureName ?? snapshotActor?.displayName ?? "Primitive Shelter").trim() ||
            "Primitive Shelter",
          ownerName,
          stateLabel: buildState.constructionStateLabel,
          canCancel,
          canBuild,
          canPause,
          canResume,
          canDeposit,
          canSleep,
          canDismantle,
          sleepCurrent,
          sleepMax,
          buildState,
          buildDurationLabel: buildState.progressLabel,
          xpReward: buildState.xpReward,
          onCancel: canCancel
            ? () => {
                state.clearBuildPlacement?.();
                state.setTargetBuildCard(null);
                const cancelBuild = state.cancelBuild ?? null;
                if (typeof cancelBuild !== "function") return;

                window.setTimeout(() => {
                  cancelBuild(actorId);
                }, 0);
              }
            : null,
          onPause: canPause
            ? () => {
                const pauseBuild = state.pauseBuild ?? null;
                if (typeof pauseBuild !== "function") return;
                window.setTimeout(() => {
                  pauseBuild(actorId);
                }, 0);
              }
            : null,
          onResume: canResume
            ? () => {
                const resumeBuild = state.resumeBuild ?? null;
                if (typeof resumeBuild !== "function") return null;
                return resumeBuild(actorId);
              }
            : null,
          onDismantle: canDismantle
            ? () => {
                const cancelBuild = state.cancelBuild ?? null;
                if (state.selectedTargetRef) state.selectedTargetRef.current = null;
                if (state.combatTargetRef) state.combatTargetRef.current = null;
                if (state.selectedObjectRef) state.selectedObjectRef.current = null;
                if (typeof state.setSnapshot === "function") {
                  state.setSnapshot((prev) => {
                    if (!prev) return prev;
                    const actors = Array.isArray(prev.actors) ? prev.actors : [];
                    if (!actors.some((entry) => String(entry.id) === actorId)) return prev;

                    return {
                      ...prev,
                      actors: actors.filter((entry) => String(entry.id) !== actorId),
                    };
                  });
                }
                const worldStore = state.worldStoreRef?.current ?? null;
                if (worldStore?.removeActor) {
                  worldStore.removeActor(actorId);
                }
                state.setTargetBuildCard(null);
                state.clearTargetBuildCard?.();
                if (typeof cancelBuild !== "function") return;
                window.setTimeout(() => {
                  cancelBuild(actorId);
                }, 0);
              }
            : null,
          onSleep: canSleep
            ? () => {
                const startSleep = state.startSleep ?? null;
                if (typeof startSleep !== "function") return;
                return startSleep(actorId);
              }
            : null,
          onBuild: canBuild
            ? () => {
                const startBuild = state.startBuild ?? null;
                state.selectedTargetRef.current = null;
                if (typeof startBuild !== "function") return;
                window.setTimeout(() => {
                  startBuild(actorId);
                }, 0);
              }
            : null,
          onDepositMaterial: canDeposit
            ? (itemCode, qty) => {
                const depositBuildMaterial = state.depositBuildMaterial ?? null;
                if (typeof depositBuildMaterial !== "function") {
                  return Promise.resolve({ ok: false, code: "DEPOSIT_UNAVAILABLE" });
                }
                return depositBuildMaterial(actorId, itemCode, qty);
              }
            : null,
        });
      }

      state.setTargetPlayerCard(null);
      state.setTargetLootCard(null);
      return state.setTargetHpBar(null);
    }

    state.setTargetBuildCard(null);

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
        id: actorId,
        x: screenPos.x,
        y: screenPos.y,
        actorName:
          mesh?.userData?.displayName ??
          snapshotActor?.displayName ??
          mesh?.userData?.actorType ??
          snapshotActor?.actorType ??
          `Actor ${actorId}`,
        lootSummary,
      });
    }

    state.setTargetBuildCard(null);
    return state.setTargetHpBar(null);
  }

  state.setTargetHpBar(null);
  state.setTargetPlayerCard(null);
  state.setTargetLootCard(null);
  state.setTargetBuildCard(null);
}
