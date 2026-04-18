"use strict";

const { normalize2D } = require("../math");
const { resolveTerrainHeightFromBounds } = require("../terrain");
const { resolveDesiredPosition } = require("./resolveDesiredPosition");

function moveEntityByDirection({ pos, dir, speed, dt, bounds }) {
  const direction = normalize2D(Number(dir?.x ?? 0), Number(dir?.z ?? 0));
  if (direction.x === 0 && direction.z === 0) {
    return {
      ok: true,
      moved: false,
      pos: { x: currentPos.x, y: groundY, z: currentPos.z },
      direction,
    };
  }

  const currentPos = {
    x: Number(pos?.x ?? 0),
    y: Number(pos?.y ?? 0),
    z: Number(pos?.z ?? 0),
  };
  const groundY = resolveTerrainHeightFromBounds(bounds, currentPos.x, currentPos.z);

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
      moved: false,
      pos: { x: currentPos.x, y: groundY, z: currentPos.z },
      direction,
    };
  }

  const clampedPos = resolved.pos;
  clampedPos.y = resolveTerrainHeightFromBounds(bounds, clampedPos.x, clampedPos.z);
  const moved = clampedPos.x !== currentPos.x || clampedPos.z !== currentPos.z;
  return {
    ok: true,
    moved,
    pos: clampedPos,
    direction,
  };
}

module.exports = {
  moveEntityByDirection,
};
