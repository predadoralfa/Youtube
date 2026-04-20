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

function resolveFeverDebuffProfile(feverCurrent, feverSeverity) {
  const current = Math.max(0, Math.min(100, toNum(feverCurrent, 100)));
  if (current >= 100) {
    return {
      active: false,
      tier: 0,
      tempoMultiplier: 1,
      staminaRegenMultiplier: 1,
    };
  }

  const severity = Math.max(
    0,
    Math.min(
      1,
      Number.isFinite(Number(feverSeverity)) ? toNum(feverSeverity, 0) : 1 - current / 100
    )
  );
  const tier = Math.max(1, Math.min(10, Math.ceil(severity * 10)));
  const tempoMultiplier =
    tier <= 5 ? 1 + tier * 0.1 : 1 + 5 * 0.1 + (tier - 5) * 0.15;

  return {
    active: true,
    tier,
    tempoMultiplier,
    staminaRegenMultiplier: 1 / tempoMultiplier,
  };
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
  const immunityCurrent = combatStats?.immunityCurrent;
  const immunityMax = combatStats?.immunityMax;
  const diseaseLevel = combatStats?.diseaseLevel;
  const diseaseSeverity = combatStats?.diseaseSeverity;
  const sleepCurrent = combatStats?.sleepCurrent;
  const sleepMax = combatStats?.sleepMax;
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
    immunityCurrent,
    immunityMax,
    diseaseLevel,
    diseaseSeverity,
    sleepCurrent,
    sleepMax,
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
  runtime.immunityCurrent = immunityCurrent;
  runtime.immunityMax = immunityMax;
  runtime.diseaseLevel = diseaseLevel;
  runtime.diseaseSeverity = diseaseSeverity;
  runtime.sleepCurrent = sleepCurrent;
  runtime.sleepMax = sleepMax;
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
    immunityCurrent,
    immunityMax,
    diseaseLevel,
    diseaseSeverity,
    sleepCurrent,
    sleepMax,
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
    immunity: {
      current: immunityCurrent,
      max: immunityMax,
    },
    fever: {
      current: diseaseLevel,
      severity: diseaseSeverity,
    },
    sleep: {
      current: sleepCurrent,
      max: sleepMax,
    },
  };

  runtime.status = {
    ...(runtime.status ?? {}),
    immunity: {
      current: immunityCurrent,
      max: immunityMax,
    },
    fever: {
      current: diseaseLevel,
      severity: diseaseSeverity,
    },
    debuffs: resolveFeverDebuffProfile(diseaseLevel, diseaseSeverity),
    disease: {
      current: diseaseLevel,
      severity: diseaseSeverity,
    },
    sleep: {
      current: sleepCurrent,
      max: sleepMax,
    },
  };

  return runtime;
}

module.exports = {
  sanitizeSpeed,
  toNum,
  applyCombatStatsToRuntime,
};
