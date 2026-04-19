// server/state/runtime/combatLoader.js
const db = require("../../models");
const { getTimeFactor } = require("../../service/worldClockService");
const { resolveHungerDrainPerSecond, resolveThirstDrainPerSecond } = require("../movement/stamina");
const { getUserStatsSupport } = require("./statsSchema");

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
  const support = await getUserStatsSupport();
  const stats = await db.GaUserStats.findOne({
    where: { user_id: userId },
    attributes: [
      "user_id",
      "hp_current",
      "hp_max",
      "stamina_current",
      "stamina_max",
      "hunger_current",
      "hunger_max",
      ...(support.supportsThirst ? ["thirst_current", "thirst_max"] : []),
      "attack_power",
      "defense",
      "attack_speed",
      "attack_range",
      "updated_at",
    ],
  });

  if (!stats) {
    throw new Error(`Stats de combate ausentes para userId=${userId}`);
  }

  const hpMax = readStrictNumber(stats.hp_max, "hp_max", userId);
  const hpCurrent = readStrictNumber(stats.hp_current, "hp_current", userId);
  const staminaMax = readStrictNumber(stats.stamina_max, "stamina_max", userId);
  const staminaCurrent = readStrictNumber(stats.stamina_current, "stamina_current", userId);
  const hungerMax = readStrictNumber(stats.hunger_max, "hunger_max", userId);
  const persistedHungerCurrent = readStrictNumber(stats.hunger_current, "hunger_current", userId);
  const thirstMax = support.supportsThirst ? Number(stats.thirst_max ?? 100) || 100 : 100;
  const persistedThirstCurrent = support.supportsThirst
    ? Number(stats.thirst_current ?? thirstMax) || thirstMax
    : thirstMax;
  const attackPower = readStrictNumber(stats.attack_power, "attack_power", userId);
  const defense = readStrictNumber(stats.defense, "defense", userId);
  const attackSpeed = readStrictNumber(stats.attack_speed, "attack_speed", userId);
  const attackRange = readStrictNumber(stats.attack_range, "attack_range", userId);
  const statsUpdatedAtMs = stats.updated_at ? new Date(stats.updated_at).getTime() : Date.now();
  const timeFactor = await getTimeFactor();
  const elapsedSeconds = Math.max(0, (Date.now() - statsUpdatedAtMs) / 1000);
  const offlineHungerDrain = resolveHungerDrainPerSecond(hungerMax, timeFactor) * elapsedSeconds;
  const hungerCurrent = Math.max(0, Math.min(hungerMax, persistedHungerCurrent - offlineHungerDrain));
  const hungerWasAdjusted = Math.abs(hungerCurrent - persistedHungerCurrent) > 1e-9;
  const offlineThirstDrain = support.supportsThirst
    ? resolveThirstDrainPerSecond(thirstMax, timeFactor) * elapsedSeconds
    : 0;
  const thirstCurrent = Math.max(0, Math.min(thirstMax, persistedThirstCurrent - offlineThirstDrain));
  const thirstWasAdjusted = support.supportsThirst && Math.abs(thirstCurrent - persistedThirstCurrent) > 1e-9;

  return {
    hpMax,
    hpCurrent: Math.min(hpCurrent, hpMax),
    staminaMax,
    staminaCurrent: Math.min(staminaCurrent, staminaMax),
    hungerMax,
    hungerCurrent,
    hungerWasAdjusted,
    thirstSupported: support.supportsThirst,
    thirstMax,
    thirstCurrent,
    thirstWasAdjusted,
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
