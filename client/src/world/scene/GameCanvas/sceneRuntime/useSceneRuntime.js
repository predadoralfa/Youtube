import { useEffect, useRef } from "react";
import { applySceneTemplate, setupSceneRuntime } from "./setup";
import { createSelectionTools } from "./selection";
import { cleanupSceneRuntime } from "./cleanup";
import { setupSceneInput } from "./useSceneRuntime/input";
import { startSceneTick } from "./useSceneRuntime/tick";

export function useSceneRuntime({ snapshot, worldStoreRef, onInputIntent, onTargetSelect, onTargetClear, state }) {
  const runtimeInstanceId = snapshot?.runtime?.instance_id ?? null;
  const localTemplateVersion = snapshot?.localTemplateVersion ?? null;
  const sceneRuntimeRef = useRef(null);

  useEffect(() => {
    if (snapshot) {
      state.runtimeRef.current = snapshot.runtime ?? null;
      state.templateRef.current = snapshot.localTemplate ?? null;
      state.proceduralMapRef.current = snapshot.proceduralMap ?? null;
      state.versionRef.current = snapshot.localTemplateVersion ?? null;
      state.actorsRef.current = snapshot.actors ?? [];
    }
  }, [snapshot, state]);

  useEffect(() => {
    const container = state.containerRef.current;
    if (!container) return;

    const runtime = setupSceneRuntime({
      container,
      runtimeRef: state.runtimeRef,
      templateRef: state.templateRef,
      proceduralMapRef: state.proceduralMapRef,
      worldTimeRef: state.worldTimeRef,
      cameraRef: state.cameraRef,
    });
    sceneRuntimeRef.current = runtime;

    const tools = createSelectionTools({
      renderer: runtime.renderer,
      camera: runtime.cameraApi.camera,
      groundMesh: runtime.groundMesh,
      worldStoreRef,
      state,
      onInputIntent,
      onTargetSelect,
      onTargetClear,
    });

    const input = setupSceneInput(runtime.renderer, runtime.cameraApi, tools, onInputIntent);
    const stopTick = startSceneTick({
      runtime,
      tools,
      state,
      worldStoreRef,
      getMoveDir: input.getMoveDir,
    });

    return () => {
      stopTick();
      input.off();
      input.unbindInputs();
        cleanupSceneRuntime({
          scene: runtime.scene,
          renderer: runtime.renderer,
          groundMesh: runtime.groundMesh,
          boundsLine: runtime.boundsLine,
          boundsGeometry: runtime.boundsGeometry,
          boundsMaterial: runtime.boundsMaterial,
          proceduralWorldGroup: runtime.proceduralWorldGroup,
          onResize: runtime.cameraApi.onResize,
          state,
        });
      };
    }, [onInputIntent, onTargetSelect, onTargetClear, state, worldStoreRef, runtimeInstanceId, localTemplateVersion]);

  useEffect(() => {
    const runtime = sceneRuntimeRef.current;
    if (!runtime) return;

    applySceneTemplate(
      runtime,
      snapshot?.localTemplate ?? null,
      snapshot?.proceduralMap ?? null
    );
  }, [snapshot?.localTemplateVersion, snapshot?.localTemplate, snapshot?.proceduralMap]);
}
