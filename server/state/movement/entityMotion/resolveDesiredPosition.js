"use strict";

const { clampPosToBounds } = require("../math");

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

module.exports = {
  resolveDesiredPosition,
};
