import { useEffect } from "react";
import { setupSceneRuntime } from "./setup";
import { createSelectionTools } from "./selection";
import { cleanupSceneRuntime } from "./cleanup";
import { setupSceneInput } from "./useSceneRuntime/input";
import { startSceneTick } from "./useSceneRuntime/tick";

export function useSceneRuntime({ snapshot, worldStoreRef, onInputIntent, onTargetSelect, onTargetClear, state }) {
  useEffect(() => {
    if (snapshot) {
      state.runtimeRef.current = snapshot.runtime ?? null;
      state.templateRef.current = snapshot.localTemplate ?? null;
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
      worldTimeRef: state.worldTimeRef,
      cameraRef: state.cameraRef,
    });

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
        boundsGeometry: runtime.boundsGeometry,
        boundsMaterial: runtime.boundsMaterial,
        onResize: runtime.cameraApi.onResize,
        state,
      });
    };
  }, [onInputIntent, onTargetSelect, onTargetClear, state, worldStoreRef]);
}
