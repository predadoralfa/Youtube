import { useCallback, useEffect } from "react";
import { useWorldClock } from "../../hooks/useWorldClock";
import { useCombatEffects } from "./effects/useCombatEffects";
import { useSceneRuntime } from "./sceneRuntime/useSceneRuntime";
import { useGameCanvasState } from "./useGameCanvasState";
import { GameCanvasView } from "./view";

const EMPTY_CAMERA_OPTIONS = {};

export function GameCanvas(props) {
  const currentWorldTime = useWorldClock(props.worldClock);
  const state = useGameCanvasState(currentWorldTime, props.buildPlacement ?? null);
  const cameraOptions = props.cameraOptions ?? EMPTY_CAMERA_OPTIONS;
  const disableInput = props.disableInput ?? false;
  const disableSceneInput = props.disableSceneInput ?? false;
  state.worldStoreRef = props.worldStoreRef ?? null;
  state.setSnapshot = props.setSnapshot ?? null;
  state.clearBuildPlacement = props.onClearBuildPlacement ?? null;
  state.cancelBuild = props.onCancelBuild ?? null;
  state.pauseBuild = props.onPauseBuild ?? null;
  state.resumeBuild = props.onResumeBuild ?? null;
  state.startBuild = props.onStartBuild ?? null;
  state.depositBuildMaterial = props.onDepositBuildMaterial ?? null;
  state.startSleep = props.onStartSleep ?? null;
  state.stopSleep = props.onStopSleep ?? null;
  state.allowObjectSelection = props.allowObjectSelection ?? false;
  state.disableGroundMove = props.disableGroundMove ?? false;
  state.disableWorldEntities = props.disableWorldEntities ?? false;
  state.disableSceneInput = disableSceneInput;
  state.exposeRuntimeRef = props.exposeRuntimeRef ?? null;
  state.exposeCameraRef = props.exposeCameraRef ?? null;
  state.exposeCameraApiRef = props.exposeCameraApiRef ?? null;
  state.editorCameraFocusRef = props.editorCameraFocusRef ?? state.editorCameraFocusRef;
  state.editorMoveSpeedRef = props.editorMoveSpeedRef ?? state.editorMoveSpeedRef;
  state.editorMoveStateRef = props.editorMoveStateRef ?? state.editorMoveStateRef;
  state.editorInputStateRef = props.editorInputStateRef ?? state.editorInputStateRef ?? null;
  state.onEditorTick = props.onEditorTick ?? null;
  const clearTargetBuildCard = useCallback(() => {
    state.selectedTargetRef.current = null;
    state.selectedObjectRef.current = null;
    state.setTargetBuildCard(null);
  }, [state]);
  state.clearTargetBuildCard = clearTargetBuildCard;
  state.inventorySnapshotRef.current = props.inventorySnapshot ?? null;

  useEffect(() => {
    state.worldTimeRef.current = currentWorldTime;
  }, [currentWorldTime, state]);

  useEffect(() => {
    if (!state.targetBuildCard) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      state.clearTargetBuildCard?.();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [state, state.targetBuildCard]);

  useCombatEffects(state, props.worldStoreRef);
  useSceneRuntime({
    snapshot: props.snapshot,
    worldStoreRef: props.worldStoreRef,
    onInputIntent: disableInput ? null : props.onInputIntent,
    onTargetSelect: props.onTargetSelect,
    onTargetClear: props.onTargetClear,
    state,
    cameraOptions,
  });

  return (
    <GameCanvasView
      state={state}
      lootNotifications={props.lootNotifications ?? []}
      buildPlacement={props.buildPlacement ?? null}
      onClearBuildPlacement={props.onClearBuildPlacement ?? null}
      onCloseTargetBuildCard={clearTargetBuildCard}
    />
  );
}
