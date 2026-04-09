import { useEffect } from "react";
import { useWorldClock } from "../../hooks/useWorldClock";
import { useCombatEffects } from "./effects/useCombatEffects";
import { useSceneRuntime } from "./sceneRuntime/useSceneRuntime";
import { useGameCanvasState } from "./useGameCanvasState";
import { GameCanvasView } from "./view";

export function GameCanvas(props) {
  const currentWorldTime = useWorldClock(props.worldClock);
  const state = useGameCanvasState(currentWorldTime);

  useEffect(() => {
    state.worldTimeRef.current = currentWorldTime;
  }, [currentWorldTime, state]);

  useCombatEffects(state, props.worldStoreRef);
  useSceneRuntime({
    snapshot: props.snapshot,
    worldStoreRef: props.worldStoreRef,
    onInputIntent: props.onInputIntent,
    onTargetSelect: props.onTargetSelect,
    onTargetClear: props.onTargetClear,
    state,
  });

  return <GameCanvasView state={state} lootNotifications={props.lootNotifications ?? []} />;
}
