"use strict";

const { normalize2D } = require("../math");
const { resolveDesiredPosition } = require("./resolveDesiredPosition");

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

module.exports = {
  moveEntityByDirection,
};
