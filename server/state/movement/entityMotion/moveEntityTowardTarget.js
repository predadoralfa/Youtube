"use strict";

const { normalize2D } = require("../math");
const { resolveTerrainHeightFromBounds } = require("../terrain");
const { resolveDesiredPosition } = require("./resolveDesiredPosition");

function moveEntityTowardTarget({ pos, target, speed, dt, bounds, stopRadius }) {
  const currentPos = {
    x: Number(pos?.x ?? 0),
    y: Number(pos?.y ?? 0),
    z: Number(pos?.z ?? 0),
  };
  const groundY = resolveTerrainHeightFromBounds(bounds, currentPos.x, currentPos.z);

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
      pos: { x: currentPos.x, y: groundY, z: currentPos.z },
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
      pos: { x: currentPos.x, y: groundY, z: currentPos.z },
      direction,
      yaw: null,
    };
  }

  const desired = {
    x: currentPos.x + direction.x * speed * dt,
    y: groundY,
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
      pos: { x: currentPos.x, y: groundY, z: currentPos.z },
      direction,
      yaw: null,
    };
  }

  const clampedPos = resolved.pos;
  clampedPos.y = resolveTerrainHeightFromBounds(bounds, clampedPos.x, clampedPos.z);
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
  moveEntityTowardTarget,
};
