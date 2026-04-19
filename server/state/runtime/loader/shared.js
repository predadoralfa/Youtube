"use strict";

function sanitizeSpeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function applyCombatStatsToRuntime(runtime, combatStats) {
  const hpCurrent = combatStats?.hpCurrent;
  const hpMax = combatStats?.hpMax;
  const staminaCurrent = combatStats?.staminaCurrent;
  const staminaMax = combatStats?.staminaMax;
  const hungerCurrent = combatStats?.hungerCurrent;
  const hungerMax = combatStats?.hungerMax;
  const thirstCurrent = combatStats?.thirstCurrent;
  const thirstMax = combatStats?.thirstMax;
  const thirstSupported = Boolean(combatStats?.thirstSupported);
  const attackPower = combatStats?.attackPower;
  const defense = combatStats?.defense;
  const attackSpeed = combatStats?.attackSpeed;
  const attackRange = combatStats?.attackRange;

  runtime.combat = {
    hpCurrent,
    hpMax,
    staminaCurrent,
    staminaMax,
    hungerCurrent,
    hungerMax,
    thirstCurrent,
    thirstMax,
    thirstSupported,
    attackPower,
    defense,
    attackSpeed,
    attackRange,
    lastAttackAtMs: Number(runtime?.combat?.lastAttackAtMs ?? 0),
    targetId: runtime?.combat?.targetId ?? null,
    targetKind: runtime?.combat?.targetKind ?? null,
    state: runtime?.combat?.state ?? "IDLE",
  };

  runtime.hp = hpCurrent;
  runtime.hpCurrent = hpCurrent;
  runtime.hpMax = hpMax;
  runtime.staminaCurrent = staminaCurrent;
  runtime.staminaMax = staminaMax;
  runtime.hungerCurrent = hungerCurrent;
  runtime.hungerMax = hungerMax;
  runtime.thirstCurrent = thirstCurrent;
  runtime.thirstMax = thirstMax;
  runtime.thirstSupported = thirstSupported;
  runtime.attackPower = attackPower;
  runtime.defense = defense;
  runtime.attackSpeed = attackSpeed;
  runtime.attackRange = attackRange;

  runtime.stats = {
    ...(runtime.stats ?? {}),
    hpCurrent,
    hpMax,
    staminaCurrent,
    staminaMax,
    hungerCurrent,
    hungerMax,
    thirstCurrent,
    thirstMax,
    thirstSupported,
    attackPower,
    defense,
    attackSpeed,
    attackRange,
  };

  runtime.vitals = {
    ...(runtime.vitals ?? {}),
    hp: {
      current: hpCurrent,
      max: hpMax,
    },
    stamina: {
      current: staminaCurrent,
      max: staminaMax,
    },
    hunger: {
      current: hungerCurrent,
      max: hungerMax,
    },
    thirst: {
      current: thirstCurrent,
      max: thirstMax,
    },
  };

  return runtime;
}

module.exports = {
  sanitizeSpeed,
  toNum,
  applyCombatStatsToRuntime,
};
