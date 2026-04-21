import { createInputBus } from "../../../../input/InputBus";
import { bindInputs } from "../../../../input/inputs";
import { IntentType } from "../../../../input/intents";
import { getSocket } from "@/services/Socket";
import { toWorldDir } from "../../helpers";

export function setupSceneInput(renderer, cameraApi, tools, onInputIntent, state) {
  const bus = createInputBus();
  const unbindInputs = bindInputs(renderer.domElement, bus);
  let moveInputDir = { x: 0, z: 0 };

  function emitMoveIntent(dir, { bumpSeq = false } = {}) {
    const socket = getSocket();
    const camState = cameraApi.getState();
    const worldDir = toWorldDir(dir, camState.yaw);
    const movementVisual = state?.movementVisualRef?.current ?? null;

    if (movementVisual) {
      if (bumpSeq) {
        movementVisual.seq += 1;
      }
      if (worldDir.x !== 0 || worldDir.z !== 0) {
        movementVisual.lastActiveDir = worldDir;
        movementVisual.stopRequestedAt = 0;
        movementVisual.directionChangedAt = performance.now();
      } else {
        movementVisual.stopRequestedAt = performance.now();
      }
      movementVisual.mode = worldDir.x === 0 && worldDir.z === 0 ? "STOP" : "WASD";
      movementVisual.dir = worldDir;
      if (movementVisual.mode !== "CLICK") {
        movementVisual.clickTarget = null;
      }
    }

    if (!socket) return;

    socket.emit("move:intent", {
      seq: state?.movementVisualRef?.current?.seq ?? 0,
      dir: worldDir,
      yaw: camState.yaw,
      cameraPitch: camState.pitch,
      cameraDistance: camState.distance,
    });
  }

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

    if (intent.type === IntentType.CAMERA_ZOOM) {
      cameraApi.applyZoom(intent.delta);
      if ((state?.movementVisualRef?.current?.mode ?? "STOP") === "WASD") {
        emitMoveIntent(moveInputDir);
      }
      return;
    }
    if (intent.type === IntentType.CAMERA_ORBIT) {
      cameraApi.applyOrbit(intent.dx, intent.dy);
      if ((state?.movementVisualRef?.current?.mode ?? "STOP") === "WASD") {
        emitMoveIntent(moveInputDir);
      }
      return;
    }
    if (intent.type === IntentType.MOVE_DIRECTION) {
      moveInputDir = intent?.dir ?? { x: 0, z: 0 };
      emitMoveIntent(moveInputDir, { bumpSeq: true });
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
