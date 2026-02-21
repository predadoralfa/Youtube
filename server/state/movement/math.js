// server/state/movement/math.js

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalize2D(x, z) {
  const len = Math.hypot(x, z);
  if (len <= 0.00001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

function clampPosToBounds(pos, bounds) {
  const minX = Number(bounds?.minX);
  const maxX = Number(bounds?.maxX);
  const minZ = Number(bounds?.minZ);
  const maxZ = Number(bounds?.maxZ);

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(minZ) ||
    !Number.isFinite(maxZ)
  ) {
    return null;
  }

  return {
    x: clamp(pos.x, minX, maxX),
    y: pos.y,
    z: clamp(pos.z, minZ, maxZ),
  };
}

function readRuntimeSpeedStrict(runtime) {
  const n = Number(runtime?.speed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function computeDtSeconds(nowMs, lastTickAtMs, dtMaxSeconds) {
  const last = Number(lastTickAtMs ?? 0);
  const dtRaw = last > 0 ? (nowMs - last) / 1000 : 0;
  return clamp(dtRaw, 0, dtMaxSeconds);
}

module.exports = {
  clamp,
  normalize2D,
  clampPosToBounds,
  readRuntimeSpeedStrict,
  computeDtSeconds,
};
