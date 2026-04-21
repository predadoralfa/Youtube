"use strict";

const {
  FEVER_TICK_INTERVAL_MS,
  FEVER_MAX_VALUE,
  FEVER_START_VALUE,
  FEVER_STEP,
  FEVER_RECOVERY_STEP,
} = require("../../config/feverConstants");
const {
  readRuntimeDiseaseLevel,
  readRuntimeDiseaseSeverity,
  readRuntimeImmunityCurrent,
  readRuntimeImmunityMax,
} = require("../movement/stamina/runtimeVitals/readers");

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function writeRuntimeDiseaseState(rt, level, severity) {
  const nextLevel = toFiniteNumber(level, 0);
  const nextSeverity = toFiniteNumber(severity, 0);
  const nextPercent = nextLevel <= 0 ? 0 : Math.round((Math.min(nextLevel, FEVER_MAX_VALUE) / FEVER_MAX_VALUE) * 100000) / 1000;

  rt.diseaseLevel = nextLevel;
  rt.diseaseSeverity = nextSeverity;
  rt.diseasePercent = nextPercent;

  if (!rt.status) rt.status = {};
  if (!rt.status.fever) rt.status.fever = { current: nextLevel, max: FEVER_MAX_VALUE, percent: nextPercent, severity: nextSeverity, active: nextLevel > 0 };
  rt.status.fever.current = nextLevel;
  rt.status.fever.max = FEVER_MAX_VALUE;
  rt.status.fever.percent = nextPercent;
  rt.status.fever.severity = nextSeverity;
  rt.status.fever.active = nextLevel > 0;

  rt.status.disease = rt.status.fever;

  if (!rt.stats) rt.stats = {};
  rt.stats.diseaseLevel = nextLevel;
  rt.stats.diseaseSeverity = nextSeverity;
  rt.stats.diseasePercent = nextPercent;
}

function resolveDiseaseChance(immunityCurrent, immunityMax) {
  const max = Math.max(1, toFiniteNumber(immunityMax, 100));
  const current = clamp(toFiniteNumber(immunityCurrent, 100), 0, max);
  return clamp(1 - current / max, 0, 1);
}

function resolveFeverDebuffTier(feverCurrent, feverSeverity) {
  const current = Math.max(0, toFiniteNumber(feverCurrent, 0));
  if (current <= 0) {
    return 0;
  }

  const severity = clamp(
    Number.isFinite(Number(feverSeverity)) ? toFiniteNumber(feverSeverity, 0) : current / FEVER_MAX_VALUE,
    0,
    1
  );
  if (severity <= 0) {
    return 0;
  }

  return clamp(Math.ceil(severity * 10), 1, 10);
}

function resolveFeverDebuffTempoMultiplier(feverCurrent, feverSeverity) {
  const tier = resolveFeverDebuffTier(feverCurrent, feverSeverity);
  if (tier <= 0) {
    return 1;
  }

  if (tier <= 5) {
    return 1 + tier * 0.1;
  }

  return 1 + 5 * 0.1 + (tier - 5) * 0.15;
}

function resolveFeverDebuffProfile(feverCurrent, feverSeverity) {
  const tier = resolveFeverDebuffTier(feverCurrent, feverSeverity);
  const tempoMultiplier = resolveFeverDebuffTempoMultiplier(feverCurrent, feverSeverity);
  const staminaRegenMultiplier = tier > 0 ? 1 / tempoMultiplier : 1;
  return {
    active: tier > 0,
    tier,
    tempoMultiplier,
    staminaRegenMultiplier,
  };
}

function resolveFeverSweepIntervalMs(timeFactor = 1) {
  void timeFactor;
  return FEVER_TICK_INTERVAL_MS;
}

function applyFeverTick(
  rt,
  nowMs,
  {
    timeFactor = 1,
    immunityCurrent = 100,
    immunityMax = 100,
    sleeping = false,
    intervalMs = FEVER_TICK_INTERVAL_MS,
  } = {}
) {
  if (!rt) {
    return {
      changed: false,
      feverChanged: false,
      feverCurrent: 0,
      feverSeverity: 0,
      feverActive: false,
      dt: 0,
      onsetChance: 0,
    };
  }

  const now = Number(nowMs ?? 0);
  const lastTickAtMs = Number(rt.feverTickAtMs ?? 0);
  const sweepIntervalMs = resolveFeverSweepIntervalMs(timeFactor);
  if (lastTickAtMs <= 0) {
    rt.feverTickAtMs = now;
    const current = Math.max(0, toFiniteNumber(readRuntimeDiseaseLevel(rt), 0));
    const severity = clamp(readRuntimeDiseaseSeverity(rt), 0, 1);
    return {
      changed: false,
      feverChanged: false,
      feverCurrent: current,
      feverSeverity: severity,
      feverActive: current > 0,
      dt: 0,
      onsetChance: resolveDiseaseChance(immunityCurrent, immunityMax),
    };
  }

  const elapsedMs = Math.max(0, now - lastTickAtMs);
  const tickInterval = Math.max(1000, toFiniteNumber(intervalMs, sweepIntervalMs));
  if (elapsedMs < tickInterval) {
    const current = Math.max(0, toFiniteNumber(readRuntimeDiseaseLevel(rt), 0));
    const severity = clamp(readRuntimeDiseaseSeverity(rt), 0, 1);
    return {
      changed: false,
      feverChanged: false,
      feverCurrent: current,
      feverSeverity: severity,
      feverActive: current > 0,
      dt: 0,
      onsetChance: resolveDiseaseChance(immunityCurrent, immunityMax),
    };
  }

  const dt = elapsedMs / 1000;
  rt.feverTickAtMs = now;

  const current = Math.max(0, toFiniteNumber(readRuntimeDiseaseLevel(rt), 0));
  const immunityRatio = clamp(immunityCurrent / Math.max(1, immunityMax), 0, 1);
  const onsetChance = resolveDiseaseChance(immunityCurrent, immunityMax);
  const roll = Math.random();

  let nextCurrent = current;
  let feverChanged = false;

  if (current <= 0) {
    if (roll > immunityRatio) {
      nextCurrent = FEVER_START_VALUE;
      feverChanged = true;
    }
  } else if (roll > immunityRatio) {
    nextCurrent = current + FEVER_STEP;
    feverChanged = true;
  } else {
    nextCurrent = Math.max(0, current - FEVER_RECOVERY_STEP);
    feverChanged = Math.abs(nextCurrent - current) > 1e-9;
  }

  const feverSeverity = clamp(nextCurrent / FEVER_MAX_VALUE, 0, 1);

  if (feverChanged || readRuntimeDiseaseLevel(rt) !== nextCurrent || readRuntimeDiseaseSeverity(rt) !== feverSeverity) {
    writeRuntimeDiseaseState(rt, nextCurrent, feverSeverity);
  }

  console.log(
    `[FEVER_TICK] ${JSON.stringify({
      userId: rt.userId ?? rt.user_id ?? null,
      t: now,
      current: Number(nextCurrent.toFixed(3)),
      severity: Number(feverSeverity.toFixed(3)),
      active: nextCurrent > 0,
      activated: feverChanged && current <= 0 && nextCurrent > 0,
      changed: feverChanged,
      onsetChance: Number(onsetChance.toFixed(3)),
      roll: Number(roll.toFixed(3)),
      immunityCurrent: Number(immunityCurrent.toFixed(3)),
      immunityMax: Number(immunityMax.toFixed(3)),
    })}`
  );

  return {
    changed: feverChanged,
    feverChanged,
    feverCurrent: nextCurrent,
    feverSeverity,
    feverActive: nextCurrent > 0,
    dt,
    onsetChance,
  };
}

module.exports = {
  FEVER_TICK_INTERVAL_MS,
  resolveDiseaseChance,
  resolveFeverDebuffTier,
  resolveFeverDebuffTempoMultiplier,
  resolveFeverDebuffProfile,
  resolveFeverSweepIntervalMs,
  applyFeverTick,
};
