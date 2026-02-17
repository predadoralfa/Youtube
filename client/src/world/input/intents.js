
export const IntentType = {
  CAMERA_ZOOM: "CAMERA_ZOOM",
  CAMERA_ORBIT: "CAMERA_ORBIT",
};

export function intentCameraZoom(delta) {
  return { type: IntentType.CAMERA_ZOOM, delta, ts: performance.now() };
}

export function intentCameraOrbit(dx, dy) {
  return { type: IntentType.CAMERA_ORBIT, dx, dy, ts: performance.now() };
}

