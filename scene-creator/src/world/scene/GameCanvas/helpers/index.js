export function projectWorldToScreenPx(worldPos, camera, domElement) {
  if (!worldPos || !camera || !domElement) return null;

  const rect = domElement.getBoundingClientRect();
  const v = worldPos.clone().project(camera);

  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || v.z < -1 || v.z > 1) {
    return null;
  }

  return {
    x: (v.x * 0.5 + 0.5) * rect.width,
    y: (-v.y * 0.5 + 0.5) * rect.height,
  };
}
