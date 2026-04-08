"use strict";

const db = require("../../models");
const { loadPlayerCombatStats: loadStrictPlayerCombatStats } = require("../../state/runtime/combatLoader");

async function loadPlayerCombatStats(userId) {
  return loadStrictPlayerCombatStats(userId);
}

async function loadEnemyCombatStats(enemyInstanceId) {
  try {
    const enemySlot = await db.GaSpawnInstanceEnemy.findByPk(enemyInstanceId, {
      include: [
        {
          association: "spawnDefEnemy",
          required: true,
          include: [
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
        },
      ],
    });

    const baseStats = enemySlot?.spawnDefEnemy?.enemyDef?.baseStats;
    if (!enemySlot || !baseStats) return null;

    return {
      hpCurrent: Number(enemySlot.hp_current),
      hpMax: Number(baseStats.hp_max),
      attackSpeed: Number(baseStats.attack_speed),
      moveSpeed: Number(baseStats.move_speed),
      attackPower: Number(baseStats.attack_power),
      defense: Number(baseStats.defense),
      attackRange: Number(baseStats.attack_range),
    };
  } catch (err) {
    console.error(`[COMBAT] Error loading enemy slot stats for ${enemyInstanceId}:`, err);
    return null;
  }
}

module.exports = {
  loadPlayerCombatStats,
  loadEnemyCombatStats,
};
