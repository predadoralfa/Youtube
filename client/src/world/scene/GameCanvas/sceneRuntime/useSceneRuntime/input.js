import { createInputBus } from "../../../../input/InputBus";
import { bindInputs } from "../../../../input/inputs";
import { IntentType } from "../../../../input/intents";
import { toWorldDir } from "../../helpers";

export function setupSceneInput(renderer, cameraApi, tools, onInputIntent, state) {
  const bus = createInputBus();
  const unbindInputs = bindInputs(renderer.domElement, bus);
  let moveInputDir = { x: 0, z: 0 };

  const off = bus.on((intent) => {
    if (!intent || typeof intent !== "object") return;

    if (
      intent.type === IntentType.UI_TOGGLE_INVENTORY ||
      intent.type === IntentType.UI_TOGGLE_RESEARCH ||
      intent.type === IntentType.UI_TOGGLE_BUILD ||
      intent.type === IntentType.UI_CANCEL
    ) {
      onInputIntent?.(intent);
      return;
    }

    if (intent.type === IntentType.POINTER_MOVE) {
      const buildPlacement = state?.buildPlacementRef?.current ?? null;
      if (!buildPlacement?.visible) return;

      const ground = tools.tryPickGround?.(intent.clientX, intent.clientY);
      if (!ground) return;

      if (state?.buildPlacementRef?.current) {
        state.buildPlacementRef.current = {
          ...state.buildPlacementRef.current,
          worldPos: ground,
        };
      }

      if (typeof state?.setBuildPlacement === "function") {
        state.setBuildPlacement((prev) => {
          if (!prev?.visible) return prev;
          return {
            ...prev,
            worldPos: ground,
          };
        });
      }
      return;
    }

    if (intent.type === IntentType.CAMERA_ZOOM) return cameraApi.applyZoom(intent.delta);
    if (intent.type === IntentType.CAMERA_ORBIT) return cameraApi.applyOrbit(intent.dx, intent.dy);
    if (intent.type === IntentType.MOVE_DIRECTION) {
      moveInputDir = intent?.dir ?? { x: 0, z: 0 };
      return;
    }

    if (intent.type === IntentType.CLICK_PRIMARY) {
      return tools.emitClick(
        intent.clientX,
        intent.clientY,
        toWorldDir(moveInputDir, cameraApi.getState().yaw)
      );
    }

    if (intent.type === IntentType.CONTEXT_MENU) {
      const buildPlacement = state?.buildPlacementRef?.current ?? null;
      if (buildPlacement?.visible) {
        onInputIntent?.({ type: IntentType.BUILD_CANCEL });
        return;
      }

      tools.emitContextMenu?.(intent.clientX, intent.clientY);
      return;
    }

    if (intent.type === IntentType.BUILD_PLACE_CONFIRM || intent.type === IntentType.BUILD_CANCEL) {
      onInputIntent?.(intent);
      return;
    }

    onInputIntent?.(intent);
  });

  return {
    off,
    unbindInputs,
    getMoveDir() {
      return toWorldDir(moveInputDir, cameraApi.getState().yaw);
    },
  };
}
