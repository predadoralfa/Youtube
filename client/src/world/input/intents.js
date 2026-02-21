// input/intents.js
export const IntentType = {
  CAMERA_ZOOM: "CAMERA_ZOOM",
  CAMERA_ORBIT: "CAMERA_ORBIT",
  MOVE_DIRECTION: "MOVE_DIRECTION",
  // (NOVO)
  CLICK_PRIMARY: "CLICK_PRIMARY",
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

// (NOVO) clique primário (LMB)
// Só carrega coords de tela. Raycast e decisão de {x,z} é no GameCanvas.
export function intentClickPrimary(clientX, clientY) {
  return {
    type: IntentType.CLICK_PRIMARY,
    clientX,
    clientY,
    ts: performance.now(),
  };
}