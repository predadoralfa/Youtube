"use strict";

const { getActorsForInstance } = require("../../../state/actorsRuntimeStore");
const { DEFAULT_COLLECT_RADIUS } = require("../../../config/interactionConstants");

const RIVER_INTERACT_HALF_WIDTH = 3.25;
const RIVER_INTERACT_HALF_DEPTH = 1.2;
const RIVER_INTERACT_STOP_RADIUS = Math.hypot(RIVER_INTERACT_HALF_WIDTH, RIVER_INTERACT_HALF_DEPTH) + 0.15;

function isRiverSourceActor(actor) {
  const actorType = String(actor?.actorType ?? actor?.actorDefCode ?? "").trim().toUpperCase();
  const actorKind = String(actor?.actorKind ?? "").trim().toUpperCase();
  const visualHint = String(actor?.visualHint ?? "").trim().toUpperCase();

  return (
    actorType === "RIVER_PATCH" ||
    actorKind === "WATER_SOURCE" ||
    visualHint === "WATER"
  );
}

function isInsideRiverBox(actor, originX, originZ) {
  const ax = Number(actor?.pos?.x ?? NaN);
  const az = Number(actor?.pos?.z ?? NaN);
  if (!Number.isFinite(ax) || !Number.isFinite(az)) return false;

  return (
    Math.abs(Number(originX) - ax) <= RIVER_INTERACT_HALF_WIDTH &&
    Math.abs(Number(originZ) - az) <= RIVER_INTERACT_HALF_DEPTH
  );
}

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

    if (isRiverSourceActor(actor)) {
      if (!isInsideRiverBox(actor, originX, originZ)) continue;

      const ax = Number(actor.pos?.x ?? 0);
      const az = Number(actor.pos?.z ?? 0);
      const dx = ax - originX;
      const dz = az - originZ;
      const distSq = dx * dx + dz * dz;

      if (!Number.isFinite(distSq) || distSq >= bestDistSq) continue;

      best = actor;
      bestDistSq = distSq;
      continue;
    }

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
    stopRadius: isRiverSourceActor(best) ? RIVER_INTERACT_STOP_RADIUS : radius,
  };
}

module.exports = {
  resolveNearbyCollectTarget,
};
