// server/state/runtime/combatLoader.js
const db = require("../../models");

function toUInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function toPositiveNumber(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

/**
 * Carrega apenas stats de combate/sobrevivência do player.
 * NÃO carrega move_speed.
 *
 * Isso permite manter movimento em seu trilho atual
 * e combate em trilho separado.
 */
async function loadPlayerCombatStats(userId) {
  const stats = await db.GaUserStats.findOne({
    where: { user_id: userId },
    attributes: [
      "user_id",
      "hp_current",
      "hp_max",
      "stamina_current",
      "stamina_max",
      "attack_power",
      "defense",
      "attack_speed",
    ],
  });

  if (!stats) {
    return {
      hpCurrent: 100,
      hpMax: 100,
      staminaCurrent: 100,
      staminaMax: 100,
      attackPower: 10,
      defense: 0,
      attackSpeed: 1,
    };
  }

  const hpMax = toUInt(stats.hp_max, 100);
  const hpCurrentRaw = toUInt(stats.hp_current, hpMax);
  const staminaMax = toUInt(stats.stamina_max, 100);
  const staminaCurrentRaw = toUInt(stats.stamina_current, staminaMax);

  return {
    hpCurrent: Math.min(hpCurrentRaw, hpMax),
    hpMax,
    staminaCurrent: Math.min(staminaCurrentRaw, staminaMax),
    staminaMax,
    attackPower: toUInt(stats.attack_power, 10),
    defense: toUInt(stats.defense, 0),
    attackSpeed: toPositiveNumber(stats.attack_speed, 1),
  };
}

module.exports = {
  loadPlayerCombatStats,

  _internal: {
    toUInt,
    toPositiveNumber,
  },
};