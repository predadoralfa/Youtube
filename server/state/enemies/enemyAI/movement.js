"use strict";

const { getRuntime } = require("../../runtimeStore");
const { COMBAT_RANGE_LIMIT } = require("../../../config/enemyConstants");
const { isFiniteNumber, calculateDistance, resetEnemyToSpawn } = require("./helpers");

function updateSingleEnemyAI(enemy, nowMs) {
  if (!enemy || !enemy.pos || String(enemy.status) !== "ALIVE") {
    return false;
  }

  const prevMoveMode = enemy.moveMode;
  let changed = false;

  if (enemy._combatMode === true && enemy._combatActive === false) {
    if (enemy.moveMode !== "IDLE") {
      enemy.moveMode = "IDLE";
      enemy.moveTarget = null;
      enemy.moveStopRadius = null;
      changed = true;
    }
    return changed;
  }

  if (enemy._combatMode === true && enemy._combatActive === true) {
    const targetId = enemy._combatTargetId;
    if (!targetId) {
      resetEnemyToSpawn(enemy);
      return true;
    }

    const targetRt = getRuntime(String(targetId));
    if (!targetRt || !targetRt.pos) {
      resetEnemyToSpawn(enemy);
      return true;
    }

    if (!isFiniteNumber(targetRt.pos.x) || !isFiniteNumber(targetRt.pos.z)) {
      resetEnemyToSpawn(enemy);
      return true;
    }

    const attackRange = Number(enemy.stats?.attackRange);
    if (!Number.isFinite(attackRange) || attackRange <= 0) {
      console.warn(`[ENEMY_AI] Enemy ${enemy.id} sem attackRange valido`);
      return null;
    }

    const dist = calculateDistance(enemy.pos, targetRt.pos);
    if (dist > COMBAT_RANGE_LIMIT) {
      resetEnemyToSpawn(enemy);
      return true;
    }

    if (dist <= attackRange) {
      enemy._moveTarget = null;
      if (enemy.moveMode !== "IDLE") {
        enemy.moveMode = "IDLE";
        enemy.moveTarget = null;
        enemy.moveStopRadius = null;
        changed = true;
      }
      return changed;
    }

    if (prevMoveMode !== "FOLLOW") {
      changed = true;
    }

    enemy.moveMode = "FOLLOW";
    enemy.moveTarget = { x: targetRt.pos.x, z: targetRt.pos.z };
    enemy.moveStopRadius = attackRange;
    enemy.moveTickAtMs = nowMs;
    enemy._moveTarget = { x: targetRt.pos.x, z: targetRt.pos.z };
    enemy._moveTargetSetAt = nowMs;

    return changed;
  }

  if (enemy.moveMode !== "IDLE") {
    enemy.moveMode = "IDLE";
    enemy.moveTarget = null;
    enemy.moveStopRadius = null;
    changed = true;
  }

  return changed;
}

module.exports = {
  updateSingleEnemyAI,
};
