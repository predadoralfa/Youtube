// server/state/movement/entityMotion.js

const { clampPosToBounds, normalize2D } = require("./math");

function resolveDesiredPosition(desired, bounds) {
  if (!bounds) {
    return {
      ok: true,
      pos: desired,
    };
  }

  const clampedPos = clampPosToBounds(desired, bounds);
  if (!clampedPos) {
    return {
      ok: false,
      reason: "invalid_bounds",
      pos: desired,
    };
  }

  return {
    ok: true,
    pos: clampedPos,
  };
}

function moveEntityByDirection({ pos, dir, speed, dt, bounds }) {
  const direction = normalize2D(Number(dir?.x ?? 0), Number(dir?.z ?? 0));
  if (direction.x === 0 && direction.z === 0) {
    return {
      ok: true,
      moved: false,
      pos: { x: Number(pos?.x ?? 0), y: Number(pos?.y ?? 0), z: Number(pos?.z ?? 0) },
      direction,
    };
  }

  const currentPos = {
    x: Number(pos?.x ?? 0),
    y: Number(pos?.y ?? 0),
    z: Number(pos?.z ?? 0),
  };

  const desired = {
    x: currentPos.x + direction.x * speed * dt,
    y: currentPos.y,
    z: currentPos.z + direction.z * speed * dt,
  };

  const resolved = resolveDesiredPosition(desired, bounds);
  if (!resolved.ok) {
    return {
      ok: false,
      reason: resolved.reason ?? "invalid_bounds",
      moved: false,
      pos: currentPos,
      direction,
    };
  }

  const clampedPos = resolved.pos;
  const moved = clampedPos.x !== currentPos.x || clampedPos.z !== currentPos.z;
  return {
    ok: true,
    moved,
    pos: clampedPos,
    direction,
  };
}

function moveEntityTowardTarget({ pos, target, speed, dt, bounds, stopRadius }) {
  const currentPos = {
    x: Number(pos?.x ?? 0),
    y: Number(pos?.y ?? 0),
    z: Number(pos?.z ?? 0),
  };

  const tx = Number(target?.x);
  const tz = Number(target?.z);
  if (!Number.isFinite(tx) || !Number.isFinite(tz)) {
    return {
      ok: false,
      reason: "invalid_target",
      reached: false,
      moved: false,
      distance: null,
      pos: currentPos,
      direction: { x: 0, z: 0 },
      yaw: null,
    };
  }

  const dx = tx - currentPos.x;
  const dz = tz - currentPos.z;
  const distance = Math.hypot(dx, dz);
  const stopR = Number(stopRadius);
  const effectiveStopRadius = Number.isFinite(stopR) && stopR > 0 ? stopR : 0;

  if (distance <= effectiveStopRadius) {
    return {
      ok: true,
      reached: true,
      moved: false,
      distance,
      pos: currentPos,
      direction: { x: 0, z: 0 },
      yaw: null,
    };
  }

  const direction = normalize2D(dx, dz);
  if (direction.x === 0 && direction.z === 0) {
    return {
      ok: true,
      reached: false,
      moved: false,
      distance,
      pos: currentPos,
      direction,
      yaw: null,
    };
  }

  const desired = {
    x: currentPos.x + direction.x * speed * dt,
    y: currentPos.y,
    z: currentPos.z + direction.z * speed * dt,
  };

  const resolved = resolveDesiredPosition(desired, bounds);
  if (!resolved.ok) {
    return {
      ok: false,
      reason: resolved.reason ?? "invalid_bounds",
      reached: false,
      moved: false,
      distance,
      pos: currentPos,
      direction,
      yaw: null,
    };
  }

  const clampedPos = resolved.pos;
  const moved = clampedPos.x !== currentPos.x || clampedPos.z !== currentPos.z;
  return {
    ok: true,
    reached: false,
    moved,
    distance,
    pos: clampedPos,
    direction,
    yaw: Math.atan2(direction.x, direction.z),
  };
}

module.exports = {
  moveEntityByDirection,
  moveEntityTowardTarget,
};
