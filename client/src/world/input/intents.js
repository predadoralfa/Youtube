// input/intents.js

export const IntentType = {
  CAMERA_ZOOM: "CAMERA_ZOOM",
  CAMERA_ORBIT: "CAMERA_ORBIT",
  MOVE_DIRECTION: "MOVE_DIRECTION",

  // Mouse
  CLICK_PRIMARY: "CLICK_PRIMARY",

  // UI
  UI_TOGGLE_INVENTORY: "UI_TOGGLE_INVENTORY",

  // (NOVO) Gameplay: interação (segurar barra de espaço)
  INTERACT_PRESS: "INTERACT_PRESS",
  INTERACT_RELEASE: "INTERACT_RELEASE",
};

export function intentCameraZoom(delta) {
  return { type: IntentType.CAMERA_ZOOM, delta, ts: performance.now() };
}

export function intentCameraOrbit(dx, dy) {
  return { type: IntentType.CAMERA_ORBIT, dx, dy, ts: performance.now() };
}

export function intentMoveDirection(x, z) {
  return {
    type: IntentType.MOVE_DIRECTION,
    dir: { x, z },
    ts: performance.now(),
  };
}

// LMB (só coords; raycast/decisão é no GameCanvas)
export function intentClickPrimary(clientX, clientY) {
  return {
    type: IntentType.CLICK_PRIMARY,
    clientX,
    clientY,
    ts: performance.now(),
  };
}

// UI: toggle inventário (decisão de abrir/fechar é fora do GameCanvas)
export function intentUiToggleInventory() {
  return { type: IntentType.UI_TOGGLE_INVENTORY, ts: performance.now() };
}

// (NOVO) Interação: spacebar
export function intentInteractPress() {
  return { type: IntentType.INTERACT_PRESS, ts: performance.now() };
}

export function intentInteractRelease() {
  return { type: IntentType.INTERACT_RELEASE, ts: performance.now() };
}