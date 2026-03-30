// server/state/movement/stamina.js

const { DT_MAX } = require("./config");
const {
  MOVE_STAMINA_DRAIN_PER_SEC,
  MOVE_STAMINA_DRAIN_WARN_RATIO,
  MOVE_STAMINA_DRAIN_DANGER_RATIO,
  MOVE_STAMINA_DRAIN_WARN_MULTIPLIER,
  MOVE_STAMINA_DRAIN_DANGER_MULTIPLIER,
} = require("../../config/movementConstants");
const STAMINA_BASE_REGEN_PER_SEC = 0.5;
const HP_BASE_REGEN_PER_SEC = 0.5;
const DEFAULT_TERRAIN_DRAIN_MULTIPLIER = 1.0;
const DEFAULT_STAMINA_REGEN_MULTIPLIER = 1.0;
const DEFAULT_HP_REGEN_MULTIPLIER = 1.0;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveCarryWeightDrainMultiplier(carryWeightRatio) {
  const ratio = clamp(toFiniteNumber(carryWeightRatio, 0), 0, Number.POSITIVE_INFINITY);

  if (ratio >= MOVE_STAMINA_DRAIN_DANGER_RATIO) {
    return MOVE_STAMINA_DRAIN_DANGER_MULTIPLIER;
  }

  if (ratio >= MOVE_STAMINA_DRAIN_WARN_RATIO) {
    return MOVE_STAMINA_DRAIN_WARN_MULTIPLIER;
  }

  return MOVE_STAMINA_DRAIN_PER_SEC;
}

function readRuntimeStaminaCurrent(rt) {
  return toFiniteNumber(
    rt?.staminaCurrent ??
      rt?.stamina_current ??
      rt?.stats?.staminaCurrent ??
      rt?.stats?.stamina_current ??
      rt?.combat?.staminaCurrent ??
      rt?.combat?.stamina_current,
    0
  );
}

function readRuntimeStaminaMax(rt) {
  return toFiniteNumber(
    rt?.staminaMax ??
      rt?.stamina_max ??
      rt?.stats?.staminaMax ??
      rt?.stats?.stamina_max ??
      rt?.combat?.staminaMax ??
      rt?.combat?.stamina_max,
    0
  );
}

function readRuntimeHpCurrent(rt) {
  return toFiniteNumber(
    rt?.hpCurrent ??
      rt?.hp_current ??
      rt?.vitals?.hp?.current ??
      rt?.combat?.hpCurrent ??
      rt?.combat?.hp_current ??
      rt?.stats?.hpCurrent ??
      rt?.stats?.hp_current ??
      rt?.hp,
    0
  );
}

function readRuntimeHpMax(rt) {
  return toFiniteNumber(
    rt?.hpMax ??
      rt?.hp_max ??
      rt?.vitals?.hp?.max ??
      rt?.combat?.hpMax ??
      rt?.combat?.hp_max ??
      rt?.stats?.hpMax ??
      rt?.stats?.hp_max,
    0
  );
}

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

  if (!rt.combat) rt.combat = {};
  rt.combat.staminaCurrent = nextCurrent;
  rt.combat.staminaMax = nextMax;

  if (!rt.stats) rt.stats = {};
  rt.stats.staminaCurrent = nextCurrent;
  rt.stats.staminaMax = nextMax;
}

function applyVitalsTick(
  rt,
  nowMs,
  {
    movedReal = false,
    carryWeightRatio = 0,
    terrainDrainMultiplier = DEFAULT_TERRAIN_DRAIN_MULTIPLIER,
    regenMultiplier = DEFAULT_STAMINA_REGEN_MULTIPLIER,
    hpRegenMultiplier = DEFAULT_HP_REGEN_MULTIPLIER,
    dtMax = DT_MAX,
  } = {}
) {
  if (!rt) {
    return {
      changed: false,
      hpChanged: false,
      staminaChanged: false,
      dt: 0,
      hpRegen: 0,
      drain: 0,
      regen: 0,
      hpCurrent: 0,
      hpMax: 0,
      current: 0,
      max: 0,
    };
  }

  const lastTickAtMs = Number(rt.staminaTickAtMs ?? 0);
  const dtRaw = lastTickAtMs > 0 ? (Number(nowMs ?? 0) - lastTickAtMs) / 1000 : 0;
  const dt = clamp(dtRaw, 0, dtMax);

  rt.staminaTickAtMs = Number(nowMs ?? 0);

  const hpCurrent = readRuntimeHpCurrent(rt);
  const hpMax = Math.max(0, readRuntimeHpMax(rt));
  const current = readRuntimeStaminaCurrent(rt);
  const max = Math.max(0, readRuntimeStaminaMax(rt));

  const hpRegen = HP_BASE_REGEN_PER_SEC * dt * toFiniteNumber(hpRegenMultiplier, 1.0);
  const drain = movedReal
    ? resolveCarryWeightDrainMultiplier(carryWeightRatio) *
      dt *
      toFiniteNumber(terrainDrainMultiplier, 1.0)
    : 0;
  const regen = STAMINA_BASE_REGEN_PER_SEC * dt * toFiniteNumber(regenMultiplier, 1.0);
  const nextHpCurrent = clamp(hpCurrent + hpRegen, 0, hpMax);
  const nextCurrent = clamp(current + regen - drain, 0, max);
  const hpChanged = Math.abs(nextHpCurrent - hpCurrent) > 1e-9;
  const staminaChanged = Math.abs(nextCurrent - current) > 1e-9;
  const changed = hpChanged || staminaChanged;

  if (hpChanged || hpMax !== readRuntimeHpMax(rt)) {
    syncRuntimeHp(rt, nextHpCurrent, hpMax);
  }

  if (staminaChanged || max !== readRuntimeStaminaMax(rt)) {
    syncRuntimeStamina(rt, nextCurrent, max);
  }

  return {
    changed,
    hpChanged,
    staminaChanged,
    dt,
    hpRegen,
    drain,
    regen,
    hpCurrent: nextHpCurrent,
    hpMax,
    current: nextCurrent,
    max,
  };
}

const applyStaminaTick = applyVitalsTick;

module.exports = {
  MOVE_STAMINA_DRAIN_PER_SEC,
  STAMINA_BASE_REGEN_PER_SEC,
  HP_BASE_REGEN_PER_SEC,
  DEFAULT_TERRAIN_DRAIN_MULTIPLIER,
  DEFAULT_STAMINA_REGEN_MULTIPLIER,
  DEFAULT_HP_REGEN_MULTIPLIER,
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  syncRuntimeHp,
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  syncRuntimeStamina,
  applyVitalsTick,
  applyStaminaTick,
};
