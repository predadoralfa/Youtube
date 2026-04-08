"use strict";

const { getRuntime } = require("../../../state/runtimeStore");
const { getActor } = require("../../../state/actorsRuntimeStore");
const { getEnemy } = require("../../../state/enemies/enemiesRuntimeStore");
const { isFiniteNumber } = require("./shared");

function resolveTargetPos({ requesterRt, target }) {
  console.log(`[INTERACT_DEBUG] resolveTargetPos: kind=${target.kind}, id=${target.id}`);

  if (!target?.kind || target?.id == null) {
    console.log("[INTERACT_DEBUG] invalid target");
    return null;
  }

  if (target.kind === "PLAYER") {
    const other = getRuntime(String(target.id));
    if (!other || String(other.instanceId) !== String(requesterRt.instanceId)) {
      return null;
    }
    const p = other.pos;
    if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.z)) {
      return null;
    }
    return { x: p.x, z: p.z };
  }

  if (target.kind === "ACTOR") {
    const actor = getActor(String(target.id));
    if (!actor || String(actor.instanceId) !== String(requesterRt.instanceId)) {
      return null;
    }
    const p = actor.pos;
    if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.z)) {
      return null;
    }
    return { x: p.x, z: p.z };
  }

  if (target.kind === "ENEMY") {
    const cleanId = String(target.id).replace(/^enemy_/, "");
    const enemy = getEnemy(cleanId);
    if (
      !enemy ||
      String(enemy.instanceId) !== String(requesterRt.instanceId) ||
      String(enemy.status) !== "ALIVE"
    ) {
      return null;
    }

    const p = enemy.pos;
    if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.z)) {
      return null;
    }
    return { x: p.x, z: p.z };
  }

  return null;
}

module.exports = {
  resolveTargetPos,
};
