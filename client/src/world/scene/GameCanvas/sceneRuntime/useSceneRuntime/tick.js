import * as THREE from "three";
import { applyDayNightCycle } from "../../../light/dayNightCycle";
import { syncActorMeshes } from "../syncActors";
import { syncSceneObjectMeshes } from "../syncSceneObjects";
import { syncEnemyMeshes } from "../syncEnemies";
import { syncPlayerMeshes } from "../syncPlayers";
import { updateOverlayState } from "../overlay";

export function startSceneTick({ runtime, tools, state, worldStoreRef, getMoveState }) {
  let alive = true;
  const clock = new THREE.Clock();
  const fallbackTarget = new THREE.Object3D();
  fallbackTarget.position.set(0, 0, 0);
  const tmpWorld = new THREE.Vector3();
  let markerAccum = 0;
  let loggedInitialState = false;
  let lastEditorSyncSignature = "";

  const tick = () => {
    if (!alive) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    markerAccum += dt;

    const actors = state.actorsRef.current ?? [];
    const sceneObjects = state.sceneObjectsRef.current ?? [];
    syncSceneObjectMeshes({
      sceneObjects,
      scene: runtime.scene,
      state,
      sampleGroundHeight: runtime.sampleGroundHeight,
    });

    syncActorMeshes({
      actors,
      scene: runtime.scene,
      state,
      clearSelection: tools.clearSelection,
      sampleGroundHeight: runtime.sampleGroundHeight,
    });

    const store = worldStoreRef?.current ?? null;
    const entities = state.disableWorldEntities ? null : store?.getSnapshot?.() ?? null;
    const selfKey = store?.selfId == null ? null : String(store.selfId);
    const entityPositions = state.entityPositionsRef.current;
    entityPositions.clear();

    if (Array.isArray(entities) && entities.length > 0) {
      syncEnemyMeshes({
        entities,
        selfKey,
        scene: runtime.scene,
        state,
        clearSelection: tools.clearSelection,
        entityPositions,
        sampleGroundHeight: runtime.sampleGroundHeight,
      });

      syncPlayerMeshes({
        entities,
        selfKey,
        scene: runtime.scene,
        state,
        dt,
        clearSelection: tools.clearSelection,
        entityPositions,
        sampleGroundHeight: runtime.sampleGroundHeight,
        update(target) {
          runtime.cameraApi.update(target ?? fallbackTarget, dt);
        },
      });

      const focusPos =
        (selfKey ? entityPositions.get(selfKey) : null) ??
        (state.runtimeRef.current
          ? {
              x: Number(state.runtimeRef.current.pos?.x ?? 0),
              z: Number(state.runtimeRef.current.pos?.z ?? 0),
            }
          : null);
      if (!loggedInitialState) {
        loggedInitialState = true;
        console.log(
          `[CLIENT_TICK] entities=${Number(entities.length)} ` +
            `selfKey=${String(selfKey ?? "null")} ` +
            `focus=(${Number(focusPos?.x ?? NaN)}, ${Number(focusPos?.z ?? NaN)}) ` +
            `runtime=(${Number(state.runtimeRef.current?.pos?.x ?? NaN)}, ${Number(
              state.runtimeRef.current?.pos?.z ?? NaN
            )})`
        );
      }
    } else {
      const editorFocus = state.editorCameraFocusRef?.current ?? null;
      const moveState = getMoveState?.() ?? { dir: { x: 0, z: 0 }, speedScale: 1 };
      const moveDir = moveState.dir ?? { x: 0, z: 0 };
      const moveSpeed = Number(state.editorMoveSpeedRef?.current ?? 10) * Number(moveState.speedScale ?? 1);
      const rt = state.runtimeRef.current;

      if (editorFocus) {
        if (Math.abs(moveDir.x) > 0.0001 || Math.abs(moveDir.z) > 0.0001) {
          editorFocus.x += Number(moveDir.x ?? 0) * moveSpeed * dt;
          editorFocus.z += Number(moveDir.z ?? 0) * moveSpeed * dt;
        }
        editorFocus.y = 0;
        fallbackTarget.position.set(
          Number(editorFocus.x ?? 0),
          Number(runtime.sampleGroundHeight(editorFocus.x ?? 0, editorFocus.z ?? 0) ?? 0) +
            Number(editorFocus.y ?? 0),
          Number(editorFocus.z ?? 0)
        );
        runtime.cameraApi.update(fallbackTarget, dt);
        const cameraYaw = Number(runtime.cameraApi?.getState?.().yaw ?? 0);
        const nextEditorSignature = [
          Number(editorFocus.x ?? 0).toFixed(3),
          Number(editorFocus.y ?? 0).toFixed(3),
          Number(editorFocus.z ?? 0).toFixed(3),
          Number(cameraYaw ?? 0).toFixed(3),
        ].join("|");
        if (nextEditorSignature !== lastEditorSyncSignature) {
          lastEditorSyncSignature = nextEditorSignature;
          state.onEditorTick?.({
            pos: {
              x: Number(editorFocus.x ?? 0),
              y: Number(editorFocus.y ?? 0),
              z: Number(editorFocus.z ?? 0),
            },
            yaw: cameraYaw,
          });
        }
        if (rt?.pos) {
          rt.pos.x = Number(editorFocus.x ?? 0);
          rt.pos.y = 0;
          rt.pos.z = Number(editorFocus.z ?? 0);
        }
      }

      if (!loggedInitialState) {
        loggedInitialState = true;
        console.log(
          `[CLIENT_TICK] entities=0 selfKey=${String(selfKey ?? "null")} ` +
          `runtime=(${Number(rt?.pos?.x ?? NaN)}, ${Number(rt?.pos?.z ?? NaN)})`
        );
      }
      if (rt?.pos && !editorFocus) {
        const x = Number(rt.pos?.x ?? 0);
        const y = Number(rt.pos?.y ?? 0);
        const z = Number(rt.pos?.z ?? 0);
        fallbackTarget.position.set(x, Number(runtime.sampleGroundHeight(x, z) ?? 0) + y, z);
      }
      runtime.cameraApi.update(fallbackTarget, dt);
    }

    if (markerAccum >= 0.05) {
      markerAccum = 0;
      updateOverlayState({
        camera: runtime.cameraApi.camera,
        domElement: runtime.renderer.domElement,
        tmpWorld,
        entityPositions,
        state,
      });
    }

    applyDayNightCycle({
      scene: runtime.scene,
      hemiLight: runtime.lightRig.hemiLight,
      dirLight: runtime.lightRig.dirLight,
      worldTime: state.worldTimeRef.current,
    });
    runtime.skyDome?.updateByWorldClock?.(state.worldTimeRef.current);

    runtime.renderer.render(runtime.scene, runtime.cameraApi.camera);
    runtime.statsPanel?.stats?.update?.();
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);

  return () => {
    alive = false;
  };
}
