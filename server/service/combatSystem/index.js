"use strict";

const { loadPlayerCombatStats, loadEnemyCombatStats } = require("./stats");
const { executeAttack } = require("./executeAttack");

module.exports = {
  loadPlayerCombatStats,
  loadEnemyCombatStats,
  executeAttack,
};
