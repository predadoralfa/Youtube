"use strict";

const { toFiniteNumber } = require("../shared");

function syncRuntimeHp(rt, current, max) {
  const nextCurrent = toFiniteNumber(current, 0);
  const nextMax = toFiniteNumber(max, 0);

  rt.hpCurrent = nextCurrent;
  rt.hpMax = nextMax;
  rt.hp = nextCurrent;

  if (!rt.vitals) rt.vitals = {};
  if (!rt.vitals.hp) rt.vitals.hp = { current: nextCurrent, max: nextMax };
  rt.vitals.hp.current = nextCurrent;
  rt.vitals.hp.max = nextMax;

  if (!rt.combat) rt.combat = {};
  rt.combat.hpCurrent = nextCurrent;
  rt.combat.hpMax = nextMax;

  if (!rt.stats) rt.stats = {};
  rt.stats.hpCurrent = nextCurrent;
  rt.stats.hpMax = nextMax;
}

function syncRuntimeStamina(rt, current, max) {
  const nextCurrent = toFiniteNumber(current, 0);
  const nextMax = toFiniteNumber(max, 0);

  rt.staminaCurrent = nextCurrent;
  rt.staminaMax = nextMax;

  if (!rt.vitals) rt.vitals = {};
  if (!rt.vitals.stamina) rt.vitals.stamina = { current: nextCurrent, max: nextMax };
  rt.vitals.stamina.current = nextCurrent;
  rt.vitals.stamina.max = nextMax;

  if (!rt.combat) rt.combat = {};
  rt.combat.staminaCurrent = nextCurrent;
  rt.combat.staminaMax = nextMax;

  if (!rt.stats) rt.stats = {};
  rt.stats.staminaCurrent = nextCurrent;
  rt.stats.staminaMax = nextMax;
}

function syncRuntimeHunger(rt, current, max) {
  const nextCurrent = toFiniteNumber(current, 0);
  const nextMax = toFiniteNumber(max, 0);

  rt.hungerCurrent = nextCurrent;
  rt.hungerMax = nextMax;

  if (!rt.vitals) rt.vitals = {};
  if (!rt.vitals.hunger) rt.vitals.hunger = { current: nextCurrent, max: nextMax };
  rt.vitals.hunger.current = nextCurrent;
  rt.vitals.hunger.max = nextMax;

  if (!rt.combat) rt.combat = {};
  rt.combat.hungerCurrent = nextCurrent;
  rt.combat.hungerMax = nextMax;

  if (!rt.stats) rt.stats = {};
  rt.stats.hungerCurrent = nextCurrent;
  rt.stats.hungerMax = nextMax;
}

function syncRuntimeThirst(rt, current, max) {
  const nextCurrent = toFiniteNumber(current, 0);
  const nextMax = toFiniteNumber(max, 0);

  rt.thirstCurrent = nextCurrent;
  rt.thirstMax = nextMax;

  if (!rt.vitals) rt.vitals = {};
  if (!rt.vitals.thirst) rt.vitals.thirst = { current: nextCurrent, max: nextMax };
  rt.vitals.thirst.current = nextCurrent;
  rt.vitals.thirst.max = nextMax;

  if (!rt.combat) rt.combat = {};
  rt.combat.thirstCurrent = nextCurrent;
  rt.combat.thirstMax = nextMax;

  if (!rt.stats) rt.stats = {};
  rt.stats.thirstCurrent = nextCurrent;
  rt.stats.thirstMax = nextMax;
}

function ensureStatus(runtime) {
  if (!runtime.status) runtime.status = {};
  if (!runtime.status.immunity) runtime.status.immunity = {};
  if (!runtime.status.fever) runtime.status.fever = { current: 100, severity: 0 };
  if (!runtime.status.disease) runtime.status.disease = runtime.status.fever;
  if (!runtime.status.debuffs) runtime.status.debuffs = { active: false, tier: 0, tempoMultiplier: 1, staminaRegenMultiplier: 1 };
  if (!runtime.status.medical) runtime.status.medical = { cooldowns: {} };
  if (!runtime.status.sleep) runtime.status.sleep = {};
  return runtime.status;
}

function syncRuntimeImmunity(rt, current, max) {
  const nextCurrent = toFiniteNumber(current, 100);
  const nextMax = toFiniteNumber(max, 100);

  rt.immunityCurrent = nextCurrent;
  rt.immunityMax = nextMax;

  const status = ensureStatus(rt);
  status.immunity.current = nextCurrent;
  status.immunity.max = nextMax;

  if (!rt.stats) rt.stats = {};
  rt.stats.immunityCurrent = nextCurrent;
  rt.stats.immunityMax = nextMax;
}

function syncRuntimeDisease(rt, level, severity) {
  const nextLevel = toFiniteNumber(level, 0);
  const nextSeverity = toFiniteNumber(severity, 0);

  rt.diseaseLevel = nextLevel;
  rt.diseaseSeverity = nextSeverity;

  const status = ensureStatus(rt);
  status.fever = {
    current: nextLevel,
    severity: nextSeverity,
  };
  status.disease = status.fever;
  status.debuffs = {
    ...(status.debuffs ?? {}),
    active: nextLevel < 100,
    tier: nextLevel >= 100 ? 0 : Math.max(1, Math.min(10, Math.ceil(nextSeverity * 10))),
    tempoMultiplier: nextLevel >= 100 ? 1 : 1 + Math.min(10, Math.max(1, Math.ceil(nextSeverity * 10))) * 0.1 + Math.max(0, Math.min(5, Math.max(1, Math.ceil(nextSeverity * 10)) - 5)) * 0.05,
    staminaRegenMultiplier: nextLevel >= 100 ? 1 : 1 / (1 + Math.min(10, Math.max(1, Math.ceil(nextSeverity * 10))) * 0.1 + Math.max(0, Math.min(5, Math.max(1, Math.ceil(nextSeverity * 10)) - 5)) * 0.05),
  };

  if (!rt.stats) rt.stats = {};
  rt.stats.diseaseLevel = nextLevel;
  rt.stats.diseaseSeverity = nextSeverity;
}

function syncRuntimeSleep(rt, current, max) {
  const nextCurrent = toFiniteNumber(current, 100);
  const nextMax = toFiniteNumber(max, 100);

  rt.sleepCurrent = nextCurrent;
  rt.sleepMax = nextMax;

  const status = ensureStatus(rt);
  status.sleep.current = nextCurrent;
  status.sleep.max = nextMax;

  if (!rt.stats) rt.stats = {};
  rt.stats.sleepCurrent = nextCurrent;
  rt.stats.sleepMax = nextMax;
}

module.exports = {
  syncRuntimeHp,
  syncRuntimeStamina,
  syncRuntimeHunger,
  syncRuntimeThirst,
  syncRuntimeImmunity,
  syncRuntimeDisease,
  syncRuntimeSleep,
};
