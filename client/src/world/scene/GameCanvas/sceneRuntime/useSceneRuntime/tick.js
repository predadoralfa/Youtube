import * as THREE from "three";
import { applyDayNightCycle } from "../../../light/dayNightCycle";
import { syncActorMeshes } from "../syncActors";
import { syncEnemyMeshes } from "../syncEnemies";
import { syncPlayerMeshes } from "../syncPlayers";
import { syncProceduralWorld } from "../procedural";
import { updateOverlayState } from "../overlay";

export function startSceneTick({ runtime, tools, state, worldStoreRef }) {
  let alive = true;
  const clock = new THREE.Clock();
  const fallbackTarget = new THREE.Object3D();
  fallbackTarget.position.set(0, 0, 0);
  const tmpWorld = new THREE.Vector3();
  let markerAccum = 0;
  let loggedInitialState = false;

  const tick = () => {
    if (!alive) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    markerAccum += dt;

    const actors = state.actorsRef.current ?? [];
    syncActorMeshes({
      actors,
      scene: runtime.scene,
      state,
      clearSelection: tools.clearSelection,
      sampleGroundHeight: runtime.sampleGroundHeight,
    });

    const store = worldStoreRef?.current ?? null;
    const entities = store?.getSnapshot?.() ?? null;
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
      if (focusPos) {
        runtime.proceduralFocus = {
          x: Number(focusPos.x ?? 0),
          z: Number(focusPos.z ?? 0),
        };
      }
      syncProceduralWorld(runtime, state.proceduralMapRef.current ?? null, focusPos?.x ?? 0, focusPos?.z ?? 0);
    } else {
      const rt = state.runtimeRef.current;
      if (!loggedInitialState) {
        loggedInitialState = true;
        console.log(
          `[CLIENT_TICK] entities=0 selfKey=${String(selfKey ?? "null")} ` +
            `runtime=(${Number(rt?.pos?.x ?? NaN)}, ${Number(rt?.pos?.z ?? NaN)})`
        );
      }
      if (rt?.pos) {
        const x = Number(rt.pos?.x ?? 0);
        const z = Number(rt.pos?.z ?? 0);
        runtime.proceduralFocus = { x, z };
        syncProceduralWorld(runtime, state.proceduralMapRef.current ?? null, x, z);
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
      renderer: runtime.renderer,
      hemiLight: runtime.lightRig.hemiLight,
      dirLight: runtime.lightRig.dirLight,
      worldTime: state.worldTimeRef.current,
    });

    runtime.renderer.render(runtime.scene, runtime.cameraApi.camera);
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);

  return () => {
    alive = false;
  };
}
