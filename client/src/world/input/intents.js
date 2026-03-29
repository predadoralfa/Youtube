// input/intents.js

export const IntentType = {
  CAMERA_ZOOM: "CAMERA_ZOOM",
  CAMERA_ORBIT: "CAMERA_ORBIT",
  MOVE_DIRECTION: "MOVE_DIRECTION",

  // Mouse
  CLICK_PRIMARY: "CLICK_PRIMARY",

  // UI
  UI_TOGGLE_INVENTORY: "UI_TOGGLE_INVENTORY",
  UI_CANCEL: "UI_CANCEL",

  // Gameplay: interação canônica
  INTERACT_PRESS: "INTERACT_PRESS",
  INTERACT_RELEASE: "INTERACT_RELEASE",

  // Compatibilidade transitória
  INTERACT_PRIMARY_DOWN: "INTERACT_PRIMARY_DOWN",
  INTERACT_PRIMARY_UP: "INTERACT_PRIMARY_UP",

  // Seleção
  TARGET_SELECT: "TARGET_SELECT",
  TARGET_CLEAR: "TARGET_CLEAR",
};

export function intentCameraZoom(delta) {
  return {
    type: IntentType.CAMERA_ZOOM,
    delta,
    ts: performance.now(),
  };
}

export function intentCameraOrbit(dx, dy) {
  return {
    type: IntentType.CAMERA_ORBIT,
    dx,
    dy,
    ts: performance.now(),
  };
}

export function intentMoveDirection(x, z) {
  return {
    type: IntentType.MOVE_DIRECTION,
    dir: { x, z },
    ts: performance.now(),
  };
}

// LMB: só coords; raycast/decisão ocorre fora do input system
export function intentClickPrimary(clientX, clientY) {
  return {
    type: IntentType.CLICK_PRIMARY,
    clientX,
    clientY,
    ts: performance.now(),
  };
}

// UI
export function intentUiToggleInventory() {
  return {
    type: IntentType.UI_TOGGLE_INVENTORY,
    ts: performance.now(),
  };
}

export function intentUiCancel() {
  return {
    type: IntentType.UI_CANCEL,
    ts: performance.now(),
  };
}

// Interação canônica
export function intentInteractPress() {
  return {
    type: IntentType.INTERACT_PRESS,
    ts: performance.now(),
  };
}

export function intentInteractRelease() {
  return {
    type: IntentType.INTERACT_RELEASE,
    ts: performance.now(),
  };
}

// Compatibilidade transitória
export function intentInteractPrimaryDown() {
  return {
    type: IntentType.INTERACT_PRIMARY_DOWN,
    ts: performance.now(),
  };
}

export function intentInteractPrimaryUp() {
  return {
    type: IntentType.INTERACT_PRIMARY_UP,
    ts: performance.now(),
  };
}

// Seleção
export function intentTargetSelect(target) {
  return {
    type: IntentType.TARGET_SELECT,
    target: target
      ? {
          kind: target.kind != null ? String(target.kind) : null,
          id: target.id != null ? String(target.id) : null,
        }
      : null,
    ts: performance.now(),
  };
}

export function intentTargetClear() {
  return {
    type: IntentType.TARGET_CLEAR,
    ts: performance.now(),
  };
}
