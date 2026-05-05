import { useEffect, useRef } from "react";
import { applySceneTemplate, setupSceneRuntime } from "./setup";
import { createSelectionTools } from "./selection";
import { cleanupSceneRuntime } from "./cleanup";
import { setupSceneInput } from "./useSceneRuntime/input";
import { startSceneTick } from "./useSceneRuntime/tick";
import { toWorldDir } from "../helpers";

export function useSceneRuntime({
  snapshot,
  worldStoreRef,
  onInputIntent,
  onTargetSelect,
  onTargetClear,
  state,
  cameraOptions = {},
}) {
  const runtimeInstanceId = snapshot?.runtime?.instance_id ?? null;
  const localTemplateVersion = snapshot?.localTemplateVersion ?? null;
  const sceneRuntimeRef = useRef(null);

  useEffect(() => {
    if (snapshot) {
      state.runtimeRef.current = snapshot.runtime ?? null;
      state.templateRef.current = snapshot.localTemplate ?? null;
      state.versionRef.current = snapshot.localTemplateVersion ?? null;
      state.actorsRef.current = snapshot.actors ?? [];
      state.sceneObjectsRef.current = snapshot.sceneObjects ?? [];
      if (state.editorCameraFocusRef?.current) {
        state.editorCameraFocusRef.current = {
          x: Number(snapshot.runtime?.pos?.x ?? 0),
          y: Number(snapshot.runtime?.pos?.y ?? 0),
          z: Number(snapshot.runtime?.pos?.z ?? 0),
        };
      }
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
      cameraOptions,
    });
    sceneRuntimeRef.current = runtime;
    if (state.cameraApiRef) {
      state.cameraApiRef.current = runtime.cameraApi;
    }
    if (state.exposeRuntimeRef) {
      state.exposeRuntimeRef.current = runtime;
    }
    if (state.exposeCameraRef) {
      state.exposeCameraRef.current = runtime.cameraApi?.camera ?? null;
    }
    if (state.exposeCameraApiRef) {
      state.exposeCameraApiRef.current = runtime.cameraApi;
    }

    const tools = createSelectionTools({
      renderer: runtime.renderer,
      camera: runtime.cameraApi.camera,
      groundMesh: runtime.groundMesh,
      worldStoreRef,
      state,
      onInputIntent,
      onTargetSelect,
      onTargetClear,
      allowObjectSelection: Boolean(state.allowObjectSelection ?? false),
      disableGroundMove: Boolean(state.disableGroundMove ?? false),
    });

    const input = state.disableSceneInput
      ? {
          off() {},
          unbindInputs() {},
          getMoveState() {
            const localMoveState = state.editorMoveStateRef?.current ?? { dir: { x: 0, z: 0 }, speedScale: 1 };
            const cameraYaw = Number(runtime.cameraApi?.getState?.().yaw ?? 0);
            return {
              dir: toWorldDir(localMoveState.dir ?? { x: 0, z: 0 }, cameraYaw),
              speedScale: Number(localMoveState.speedScale ?? 1),
            };
          },
        }
      : setupSceneInput(runtime.renderer, runtime.cameraApi, tools, onInputIntent, state);
    const stopTick = startSceneTick({
      runtime,
      tools,
      state,
      worldStoreRef,
      getMoveState: input.getMoveState,
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
        onResize: runtime.cameraApi.onResize,
        statsPanel: runtime.statsPanel,
        state,
      });
      if (state.cameraApiRef) {
        state.cameraApiRef.current = null;
      }
      if (state.exposeRuntimeRef) {
        state.exposeRuntimeRef.current = null;
      }
      if (state.exposeCameraRef) {
        state.exposeCameraRef.current = null;
      }
      if (state.exposeCameraApiRef) {
        state.exposeCameraApiRef.current = null;
      }
    };
  }, [
    onInputIntent,
    onTargetSelect,
    onTargetClear,
    state,
    worldStoreRef,
    runtimeInstanceId,
    localTemplateVersion,
    state.allowObjectSelection,
    state.disableGroundMove,
    state.cameraApiRef,
    cameraOptions,
  ]);

  useEffect(() => {
    const runtime = sceneRuntimeRef.current;
    if (!runtime) return;

    applySceneTemplate(runtime, snapshot?.localTemplate ?? null);
  }, [snapshot?.localTemplateVersion, snapshot?.localTemplate]);
}
