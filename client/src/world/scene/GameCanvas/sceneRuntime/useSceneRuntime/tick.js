import * as THREE from "three";
import { applyDayNightCycle } from "../../../light/dayNightCycle";
import { getSocket } from "@/services/Socket";
import { createPlayerMesh } from "../../../../entities/character/player";
import { readPosYawFromRuntime } from "../../helpers";
import { syncActorMeshes } from "../syncActors";
import { syncEnemyMeshes } from "../syncEnemies";
import { syncPlayerMeshes } from "../syncPlayers";
import { updateOverlayState } from "../overlay";

export function startSceneTick({ runtime, tools, state, worldStoreRef, getMoveDir }) {
  let alive = true;
  const clock = new THREE.Clock();
  const fallbackTarget = new THREE.Object3D();
  fallbackTarget.position.set(0, 0, 0);
  const tmpWorld = new THREE.Vector3();
  let markerAccum = 0;

  const tick = () => {
    if (!alive) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    markerAccum += dt;

    const socket = getSocket();
    if (socket) {
      const camState = runtime.cameraApi.getState();
      socket.emit("move:intent", {
        dir: getMoveDir(),
        dt,
        yawDesired: camState.yaw,
        cameraPitch: camState.pitch,
        cameraDistance: camState.distance,
      });
    }

    const actors = state.actorsRef.current ?? [];
    syncActorMeshes({ actors, scene: runtime.scene, state, clearSelection: tools.clearSelection });

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
      });

      syncPlayerMeshes({
        entities,
        selfKey,
        scene: runtime.scene,
        state,
        clearSelection: tools.clearSelection,
        entityPositions,
        update(target) {
          runtime.cameraApi.update(target ?? fallbackTarget, dt);
        },
      });
    } else {
      const rt = state.runtimeRef.current;
      if (rt) {
        const { x, y, z, yaw } = readPosYawFromRuntime(rt);
        const legacyId = "__legacy_self__";
        let mesh = state.meshByEntityIdRef.current.get(legacyId);
        if (!mesh) {
          mesh = createPlayerMesh({ isSelf: true });
          mesh.userData.kind = "PLAYER";
          mesh.userData.entityId = legacyId;
          state.meshByEntityIdRef.current.set(legacyId, mesh);
          runtime.scene.add(mesh);
        }
        mesh.position.set(x, y ?? 0, z);
        mesh.rotation.y = yaw;
        runtime.cameraApi.update(mesh, dt);
      } else {
        runtime.cameraApi.update(fallbackTarget, dt);
      }
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
