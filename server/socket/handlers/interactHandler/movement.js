"use strict";

const { clamp } = require("./shared");

function applyApproach({ rt, nowMs, targetPos, stopRadius }) {
  const b = rt.bounds;
  if (!b) return false;

  const minX = Number(b.minX);
  const maxX = Number(b.maxX);
  const minZ = Number(b.minZ);
  const maxZ = Number(b.maxZ);
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) {
    return false;
  }

  const tx = clamp(Number(targetPos.x), minX, maxX);
  const tz = clamp(Number(targetPos.z), minZ, maxZ);

  rt.moveMode = "CLICK";
  rt.moveTarget = { x: tx, z: tz };
  rt.moveStopRadius = stopRadius;
  rt.moveTickAtMs = nowMs;
  rt.action = "move";

  return true;
}

module.exports = {
  applyApproach,
};
