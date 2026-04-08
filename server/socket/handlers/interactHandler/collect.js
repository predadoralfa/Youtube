"use strict";

const { getActorsForInstance } = require("../../../state/actorsRuntimeStore");
const { DEFAULT_COLLECT_RADIUS } = require("../../../config/interactionConstants");

function resolveNearbyCollectTarget(rt, radius = DEFAULT_COLLECT_RADIUS) {
  if (!rt?.instanceId || !rt?.pos) return null;

  const originX = Number(rt.pos.x ?? 0);
  const originZ = Number(rt.pos.z ?? 0);
  const maxDistSq = Number(radius) * Number(radius);
  const actors = getActorsForInstance(rt.instanceId);

  let best = null;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const actor of actors) {
    if (!actor) continue;
    if (String(actor.status ?? "ACTIVE") !== "ACTIVE") continue;

    const hasLootContainer =
      Array.isArray(actor.containers) &&
      actor.containers.some((container) => String(container?.slotRole ?? "") === "LOOT");
    if (!hasLootContainer) continue;

    const ax = Number(actor.pos?.x ?? 0);
    const az = Number(actor.pos?.z ?? 0);
    const dx = ax - originX;
    const dz = az - originZ;
    const distSq = dx * dx + dz * dz;

    if (!Number.isFinite(distSq) || distSq > maxDistSq) continue;
    if (distSq >= bestDistSq) continue;

    best = actor;
    bestDistSq = distSq;
  }

  if (!best) return null;

  return {
    kind: "ACTOR",
    id: String(best.id),
    stopRadius: radius,
  };
}

module.exports = {
  resolveNearbyCollectTarget,
};
