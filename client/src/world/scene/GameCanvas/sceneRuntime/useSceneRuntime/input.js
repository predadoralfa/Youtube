import { createInputBus } from "../../../../input/InputBus";
import { bindInputs } from "../../../../input/inputs";
import { IntentType } from "../../../../input/intents";
import { toWorldDir } from "../../helpers";

export function setupSceneInput(renderer, cameraApi, tools, onInputIntent) {
  const bus = createInputBus();
  const unbindInputs = bindInputs(renderer.domElement, bus);
  let moveDir = { x: 0, z: 0 };

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

    if (intent.type === IntentType.CAMERA_ZOOM) return cameraApi.applyZoom(intent.delta);
    if (intent.type === IntentType.CAMERA_ORBIT) return cameraApi.applyOrbit(intent.dx, intent.dy);
    if (intent.type === IntentType.MOVE_DIRECTION) {
      moveDir = toWorldDir(intent?.dir ?? { x: 0, z: 0 }, cameraApi.getState().yaw);
      return;
    }

    if (intent.type === IntentType.CLICK_PRIMARY) {
      return tools.emitClick(intent.clientX, intent.clientY, moveDir);
    }

    onInputIntent?.(intent);
  });

  return {
    off,
    unbindInputs,
    getMoveDir() {
      return moveDir;
    },
  };
}
