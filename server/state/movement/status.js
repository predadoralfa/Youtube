"use strict";

const { getProceduralMapProfile } = require("../../config/mapProceduralProfiles");
const {
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  readRuntimeImmunityCurrent,
  readRuntimeImmunityMax,
  readRuntimeImmunityPercent,
  readRuntimeSleepCurrent,
  readRuntimeSleepMax,
  syncRuntimeImmunity,
  syncRuntimeHp,
  syncRuntimeStamina,
  syncRuntimeSleep,
} = require("./stamina/runtimeVitals");
const { resolveDiseaseChance } = require("../conditions/fever");

const IMMUNITY_TICK_INTERVAL_MS = 60 * 1000;
const IMMUNITY_FULL_RECOVERY_WORLD_HOURS = 8;
const IMMUNITY_FULL_DECAY_WORLD_HOURS = 8;
const IMMUNITY_MIN_VALUE = 100;
const IMMUNITY_MAX_VALUE = 500;
const IMMUNITY_MIN_DOSE_CHANCE = 0;
const IMMUNITY_MAX_DOSE_CHANCE = 1;
const SLEEP_TICK_INTERVAL_MS = 60 * 1000;
const SLEEP_WORLD_HOURS_TO_EMPTY = 24;
const SLEEP_WORLD_HOURS_TO_FULL = 3;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveClimateStressFactor(instanceId) {
  const profile = getProceduralMapProfile(instanceId);
  const climate = String(profile?.profile?.climate ?? "").toLowerCase();

  switch (climate) {
    case "winter":
    case "cold":
    case "frozen":
      return 1.35;
    case "cool":
      return 1.15;
    case "mild":
      return 0.9;
    case "temperate":
      return 1;
    case "hot":
    case "dry":
      return 1.1;
    case "tropical":
      return 0.95;
    default:
      return 1;
  }
}

function resolveImmunityRecoveryPerSecond(immunityMax, timeFactor = 1) {
  const max = Math.max(IMMUNITY_MIN_VALUE, toFiniteNumber(immunityMax, IMMUNITY_MIN_VALUE));
  const factor = Math.max(0, toFiniteNumber(timeFactor, 1));
  return (max * factor) / (IMMUNITY_FULL_RECOVERY_WORLD_HOURS * 60 * 60);
}

function resolveImmunityPercent(immunityCurrent, immunityMax) {
  const max = Math.max(1, toFiniteNumber(immunityMax, IMMUNITY_MIN_VALUE));
  const current = clamp(toFiniteNumber(immunityCurrent, IMMUNITY_MIN_VALUE), 0, max);
  return Math.round((current / max) * 100000) / 1000;
}

function resolveNeedStressLevel(ratio) {
  const need = clamp(toFiniteNumber(ratio, 1), 0, 1);

  if (need >= 0.3) {
    return 0;
  }

  if (need >= 0.15) {
    return 0.3;
  }

  if (need >= 0.05) {
    return 0.6;
  }

  return 1.25;
}

function resolveNeedRecoveryMultiplier(hungerRatio, thirstRatio) {
  const hunger = clamp(toFiniteNumber(hungerRatio, 1), 0, 1);
  const thirst = clamp(toFiniteNumber(thirstRatio, 1), 0, 1);

  const resolveContribution = (needRatio) => {
    if (needRatio >= 0.3) {
      return 0.5;
    }
    if (needRatio >= 0.15) {
      return -0.5;
    }
    if (needRatio >= 0.05) {
      return -1;
    }
    return -2;
  };

  return resolveContribution(hunger) + resolveContribution(thirst);
}

function resolveNeedLossMultiplier(hungerRatio, thirstRatio) {
  return resolveNeedRecoveryMultiplier(hungerRatio, thirstRatio);
}

function resolveImmunityLossPerSecond({
  immunityMax,
  timeFactor = 1,
  climateStressFactor = 1,
  hungerRatio = 1,
  thirstRatio = 1,
  hpRatio = 1,
}) {
  const max = Math.max(IMMUNITY_MIN_VALUE, toFiniteNumber(immunityMax, IMMUNITY_MIN_VALUE));
  const factor = Math.max(0, toFiniteNumber(timeFactor, 1));
  const climateStress = Math.max(0, toFiniteNumber(climateStressFactor, 1));
  const hp = clamp(toFiniteNumber(hpRatio, 1), 0, 1);
  const hpStress = clamp((0.9 - hp) / 0.9, 0, 1);
  const climateLoss = ((max * factor) / (IMMUNITY_FULL_DECAY_WORLD_HOURS * 60 * 60)) * Math.max(0, climateStress - 1) * 0.15;
  const hpLoss = ((max * factor) / (IMMUNITY_FULL_DECAY_WORLD_HOURS * 60 * 60)) * hpStress * 0.2;
  return climateLoss + hpLoss;
}

function resolveSleepXpMultiplierBasisPoints(sleepCurrent, sleepMax = 100) {
  const max = Math.max(1, toFiniteNumber(sleepMax, 100));
  const current = clamp(toFiniteNumber(sleepCurrent, 100), 0, max);
  const sleepPercent = clamp((current / max) * 100, 0, 100);

  if (sleepPercent >= 30) {
    const bonusRatio = (sleepPercent - 30) / 70;
    return Math.round(10000 + bonusRatio * 2000);
  }

  const penaltyRatio = (30 - sleepPercent) / 30;
  return Math.round(10000 - penaltyRatio * 1000);
}

function resolveSleepXpMultiplier(sleepCurrent, sleepMax = 100) {
  return resolveSleepXpMultiplierBasisPoints(sleepCurrent, sleepMax) / 10000;
}

function resolveSleepDrainPerSecond(sleepMax, timeFactor = 1) {
  const max = Math.max(1, toFiniteNumber(sleepMax, 100));
  const factor = Math.max(0, toFiniteNumber(timeFactor, 1));
  return (max * factor) / (SLEEP_WORLD_HOURS_TO_EMPTY * 60 * 60);
}

function resolveSleepRecoveryPerSecond(sleepMax, timeFactor = 1) {
  const max = Math.max(1, toFiniteNumber(sleepMax, 100));
  const factor = Math.max(0, toFiniteNumber(timeFactor, 1));
  return (max * factor) / (SLEEP_WORLD_HOURS_TO_FULL * 60 * 60);
}

function applyImmunityTick(
  rt,
  nowMs,
  {
    timeFactor = 1,
    climateStressFactor = 1,
    hungerRatio = 1,
    thirstRatio = 1,
    hpRatio = 1,
    sleeping = false,
    intervalMs = IMMUNITY_TICK_INTERVAL_MS,
  } = {}
) {
  if (!rt) {
    return {
      changed: false,
      immunityChanged: false,
      diseaseChance: IMMUNITY_MIN_DOSE_CHANCE,
      dt: 0,
      recovery: 0,
      loss: 0,
      immunityCurrent: IMMUNITY_MIN_VALUE,
      immunityMax: IMMUNITY_MIN_VALUE,
    };
  }

  const now = Number(nowMs ?? 0);
  const lastTickAtMs = Number(rt.immunityTickAtMs ?? 0);
  if (lastTickAtMs <= 0) {
    rt.immunityTickAtMs = now;
    return {
      changed: false,
      immunityChanged: false,
      diseaseChance: resolveDiseaseChance(readRuntimeImmunityCurrent(rt), readRuntimeImmunityMax(rt)),
      dt: 0,
      recovery: 0,
      loss: 0,
      immunityCurrent: readRuntimeImmunityCurrent(rt),
      immunityMax: readRuntimeImmunityMax(rt),
    };
  }

  const elapsedMs = Math.max(0, now - lastTickAtMs);
  const tickInterval = Math.max(1000, toFiniteNumber(intervalMs, IMMUNITY_TICK_INTERVAL_MS));
  if (elapsedMs < tickInterval) {
    return {
      changed: false,
      immunityChanged: false,
      diseaseChance: resolveDiseaseChance(readRuntimeImmunityCurrent(rt), readRuntimeImmunityMax(rt)),
      dt: 0,
      recovery: 0,
      loss: 0,
      immunityCurrent: readRuntimeImmunityCurrent(rt),
      immunityMax: readRuntimeImmunityMax(rt),
    };
  }

  const dt = elapsedMs / 1000;
  rt.immunityTickAtMs = now;

  const immunityCurrent = clamp(readRuntimeImmunityCurrent(rt), 0, IMMUNITY_MAX_VALUE);
  const immunityMax = clamp(readRuntimeImmunityMax(rt), IMMUNITY_MIN_VALUE, IMMUNITY_MAX_VALUE);
  const recoveryPerSecond = resolveImmunityRecoveryPerSecond(immunityMax, timeFactor);
  const lossPerSecond = resolveImmunityLossPerSecond({
    immunityMax,
    timeFactor,
    climateStressFactor,
    hungerRatio,
    thirstRatio,
    hpRatio,
  });

  const sleepRecoveryBonus = sleeping ? 0.5 : 0;
  const recoveryMultiplier = resolveNeedRecoveryMultiplier(hungerRatio, thirstRatio) + sleepRecoveryBonus;
   const effectiveNeedDeltaPerSecond = recoveryPerSecond * recoveryMultiplier;
   const recovery = effectiveNeedDeltaPerSecond * dt;
   const loss = lossPerSecond * dt;
  const nextImmunityCurrent = clamp(immunityCurrent + recovery - loss, 0, immunityMax);
  const immunityChanged = Math.abs(nextImmunityCurrent - immunityCurrent) > 1e-9;
  const immunityPercent = resolveImmunityPercent(nextImmunityCurrent, immunityMax);

  if (
    immunityChanged ||
    readRuntimeImmunityMax(rt) !== immunityMax ||
    Number(readRuntimeImmunityPercent(rt)) !== immunityPercent
  ) {
    syncRuntimeImmunity(rt, nextImmunityCurrent, immunityMax, immunityPercent);
    console.log(
      `[IMMUNITY_TICK] ${JSON.stringify({
        userId: rt.userId ?? rt.user_id ?? null,
        t: now,
        before: Number(immunityCurrent.toFixed(3)),
        current: Number(nextImmunityCurrent.toFixed(3)),
        max: Number(immunityMax.toFixed(3)),
        percent: Number(immunityPercent.toFixed(3)),
        recovery: Number(recovery.toFixed(3)),
        loss: Number(loss.toFixed(3)),
        recoveryMultiplier: Number(recoveryMultiplier.toFixed(3)),
        sleepRecoveryBonus: Number(sleepRecoveryBonus.toFixed(3)),
        lossMultiplier: Number(resolveNeedLossMultiplier(hungerRatio, thirstRatio).toFixed(3)),
        climateStressFactor: Number(climateStressFactor.toFixed(3)),
      })}`
    );
  }

  const diseaseChance = resolveDiseaseChance(nextImmunityCurrent, immunityMax);

  return {
    changed: immunityChanged,
    immunityChanged,
    diseaseChance,
    dt,
    recovery,
    loss,
    recoveryPerSecond,
    recoveryMultiplier,
    effectiveRecoveryPerSecond: effectiveNeedDeltaPerSecond,
    lossPerSecond,
    lossMultiplier: resolveNeedLossMultiplier(hungerRatio, thirstRatio),
    immunityCurrent: nextImmunityCurrent,
    immunityMax,
    immunityPercent,
  };
}

function applySleepTick(
  rt,
  nowMs,
  {
    timeFactor = 1,
    sleeping = false,
    intervalMs = SLEEP_TICK_INTERVAL_MS,
  } = {}
) {
  if (!rt) {
    return {
      changed: false,
      sleepChanged: false,
      sleepCurrent: 100,
      sleepMax: 100,
      dt: 0,
      recovery: 0,
      drain: 0,
      sleeping: Boolean(sleeping),
    };
  }

  const now = Number(nowMs ?? 0);
  const lastTickAtMs = Number(rt.sleepTickAtMs ?? 0);
  if (lastTickAtMs <= 0) {
    rt.sleepTickAtMs = now;
    const current = clamp(readRuntimeSleepCurrent(rt), 0, readRuntimeSleepMax(rt));
    const max = Math.max(1, toFiniteNumber(readRuntimeSleepMax(rt), 100));
    return {
      changed: false,
      sleepChanged: false,
      sleepCurrent: current,
      sleepMax: max,
      dt: 0,
      recovery: 0,
      drain: 0,
      sleeping: Boolean(sleeping),
    };
  }

  const elapsedMs = Math.max(0, now - lastTickAtMs);
  const tickInterval = Math.max(1000, toFiniteNumber(intervalMs, SLEEP_TICK_INTERVAL_MS));
  if (elapsedMs < tickInterval) {
    const current = clamp(readRuntimeSleepCurrent(rt), 0, readRuntimeSleepMax(rt));
    const max = Math.max(1, toFiniteNumber(readRuntimeSleepMax(rt), 100));
    return {
      changed: false,
      sleepChanged: false,
      sleepCurrent: current,
      sleepMax: max,
      dt: 0,
      recovery: 0,
      drain: 0,
      sleeping: Boolean(sleeping),
    };
  }

  const dt = elapsedMs / 1000;
  rt.sleepTickAtMs = now;

  const sleepMax = Math.max(1, clamp(readRuntimeSleepMax(rt), 1, 100));
  const sleepCurrent = clamp(readRuntimeSleepCurrent(rt), 0, sleepMax);
  const recoveryPerSecond = resolveSleepRecoveryPerSecond(sleepMax, timeFactor);
  const drainPerSecond = resolveSleepDrainPerSecond(sleepMax, timeFactor);
  const recovery = sleeping ? recoveryPerSecond * dt : 0;
  const drain = sleeping ? 0 : drainPerSecond * dt;
  const nextSleepCurrent = clamp(sleepCurrent + recovery - drain, 0, sleepMax);
  const sleepChanged = Math.abs(nextSleepCurrent - sleepCurrent) > 1e-9;

  if (sleepChanged || readRuntimeSleepMax(rt) !== sleepMax) {
    syncRuntimeSleep(rt, nextSleepCurrent, sleepMax);
  }

  return {
    changed: sleepChanged,
    sleepChanged,
    sleepCurrent: nextSleepCurrent,
    sleepMax,
    dt,
    recovery,
    drain,
    sleeping: Boolean(sleeping),
  };
}

module.exports = {
  IMMUNITY_TICK_INTERVAL_MS,
  IMMUNITY_FULL_RECOVERY_WORLD_HOURS,
  IMMUNITY_MIN_VALUE,
  IMMUNITY_MAX_VALUE,
  IMMUNITY_MIN_DOSE_CHANCE,
  IMMUNITY_MAX_DOSE_CHANCE,
  SLEEP_TICK_INTERVAL_MS,
  SLEEP_WORLD_HOURS_TO_EMPTY,
  SLEEP_WORLD_HOURS_TO_FULL,
  resolveClimateStressFactor,
  resolveImmunityRecoveryPerSecond,
  resolveNeedRecoveryMultiplier,
  resolveNeedLossMultiplier,
  resolveImmunityPercent,
  resolveImmunityLossPerSecond,
  resolveDiseaseChance,
  resolveSleepXpMultiplierBasisPoints,
  resolveSleepXpMultiplier,
  resolveSleepDrainPerSecond,
  resolveSleepRecoveryPerSecond,
  applyImmunityTick,
  applySleepTick,
};
