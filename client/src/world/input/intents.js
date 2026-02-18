// input/intents.js
export const IntentType = {
  CAMERA_ZOOM: "CAMERA_ZOOM",
  CAMERA_ORBIT: "CAMERA_ORBIT",
  MOVE_DIRECTION: "MOVE_DIRECTION",
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
