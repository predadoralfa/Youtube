"use strict";

const db = require("../../models");
const { loadPlayerCombatStats: loadStrictPlayerCombatStats } = require("../../state/runtime/combatLoader");

async function loadPlayerCombatStats(userId) {
  return loadStrictPlayerCombatStats(userId);
}

async function loadEnemyCombatStats(enemyInstanceId) {
  try {
    const enemyRuntime = await db.GaEnemyRuntime.findByPk(enemyInstanceId, {
      include: [
        {
          association: "stats",
          required: true,
          attributes: [
            "hp_current",
            "hp_max",
            "attack_speed",
            "move_speed",
          ],
        },
        {
          association: "enemyDef",
          required: true,
          attributes: ["id"],
          include: [
            {
              association: "baseStats",
              required: true,
              attributes: [
                "hp_max",
                "move_speed",
                "attack_speed",
                "attack_power",
                "defense",
                "attack_range",
              ],
            },
          ],
        },
      ],
    });

    const stats = enemyRuntime?.stats;
    const baseStats = enemyRuntime?.enemyDef?.baseStats;
    if (!stats || !baseStats) return null;

    return {
      hpCurrent: Number(stats.hp_current),
      hpMax: Number(stats.hp_max),
      attackSpeed: Number(stats.attack_speed),
      moveSpeed: Number(stats.move_speed),
      attackPower: Number(baseStats.attack_power),
      defense: Number(baseStats.defense),
      attackRange: Number(baseStats.attack_range),
    };
  } catch (err) {
    console.error(`[COMBAT] Error loading enemy runtime stats for ${enemyInstanceId}:`, err);
    return null;
  }
}

module.exports = {
  loadPlayerCombatStats,
  loadEnemyCombatStats,
};
