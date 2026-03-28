// server/state/runtime/combatLoader.js
const db = require("../../models");

function readStrictNumber(value, fieldName, userId) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Stat de combate inválido ou ausente: ${fieldName} para userId=${userId}`);
  }
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
      "attack_range",
    ],
  });

  if (!stats) {
    throw new Error(`Stats de combate ausentes para userId=${userId}`);
  }

  const hpMax = readStrictNumber(stats.hp_max, "hp_max", userId);
  const hpCurrent = readStrictNumber(stats.hp_current, "hp_current", userId);
  const staminaMax = readStrictNumber(stats.stamina_max, "stamina_max", userId);
  const staminaCurrent = readStrictNumber(stats.stamina_current, "stamina_current", userId);
  const attackPower = readStrictNumber(stats.attack_power, "attack_power", userId);
  const defense = readStrictNumber(stats.defense, "defense", userId);
  const attackSpeed = readStrictNumber(stats.attack_speed, "attack_speed", userId);
  const attackRange = readStrictNumber(stats.attack_range, "attack_range", userId);

  return {
    hpMax,
    hpCurrent: Math.min(hpCurrent, hpMax),
    staminaMax,
    staminaCurrent: Math.min(staminaCurrent, staminaMax),
    attackPower,
    defense,
    attackSpeed,
    attackRange,
  };
}

module.exports = {
  loadPlayerCombatStats,

  _internal: {
    readStrictNumber,
  },
};
