"use strict";

const { updateSingleEnemyAI } = require("./movement");
const { updateSingleEnemyAttack } = require("./attack");

async function tickEnemyAI(enemies, t, dt) {
  if (!enemies || !Array.isArray(enemies)) {
    return [];
  }

  const changedEnemies = [];
  const attacks = [];

  for (const enemy of enemies) {
    if (!enemy || String(enemy.status) !== "ALIVE") {
      continue;
    }

    const aiChanged = updateSingleEnemyAI(enemy, t);
    if (aiChanged) {
      changedEnemies.push(enemy);
    }

    const attackResult = await updateSingleEnemyAttack(enemy, t);
    if (attackResult) {
      attacks.push(attackResult);
      if (!changedEnemies.includes(enemy)) {
        changedEnemies.push(enemy);
      }
    }
  }

  enemies._lastTickAttacks = attacks.length > 0 ? attacks : [];
  return changedEnemies;
}

function getLastTickAttacks(enemies) {
  if (!enemies || !Array.isArray(enemies)) {
    return [];
  }

  const attacks = enemies._lastTickAttacks || [];
  enemies._lastTickAttacks = [];
  return attacks;
}

module.exports = {
  tickEnemyAI,
  getLastTickAttacks,
  updateSingleEnemyAI,
  updateSingleEnemyAttack,
};
