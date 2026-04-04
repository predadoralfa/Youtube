// server/state/movement/stamina.js

const { DT_MAX } = require("./config");
const {
  MOVE_STAMINA_DRAIN_PER_SEC,
  MOVE_STAMINA_DRAIN_WARN_RATIO,
  MOVE_STAMINA_DRAIN_DANGER_RATIO,
  MOVE_STAMINA_DRAIN_WARN_MULTIPLIER,
  MOVE_STAMINA_DRAIN_DANGER_MULTIPLIER,
  STAMINA_BASE_REGEN_PER_SEC,
  HP_BASE_REGEN_PER_SEC,
  MOVE_SPEED_AT_ZERO_STAMINA_MULTIPLIER,
} = require("../../config/movementConstants");
const DEFAULT_TERRAIN_DRAIN_MULTIPLIER = 1.0;
const DEFAULT_STAMINA_REGEN_MULTIPLIER = 1.0;
const DEFAULT_HP_REGEN_MULTIPLIER = 1.0;
const DEFAULT_HUNGER_ITEM_RECOVERY = 0;

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

function resolveMoveSpeedMultiplierFromStamina(staminaCurrent, projectedStaminaAfterMove = null) {
  const current = toFiniteNumber(staminaCurrent, 0);
  const projected = projectedStaminaAfterMove == null ? null : toFiniteNumber(projectedStaminaAfterMove, current);

  if (projected != null && projected <= 0) {
    return MOVE_SPEED_AT_ZERO_STAMINA_MULTIPLIER;
  }

  return current <= 0 ? MOVE_SPEED_AT_ZERO_STAMINA_MULTIPLIER : 1;
}

function resolveStaminaPersistBucket(staminaCurrent, staminaMax) {
  const max = Math.max(0, toFiniteNumber(staminaMax, 0));
  if (max <= 0) return 0;

  const ratio = clamp(toFiniteNumber(staminaCurrent, 0) / max, 0, 1);
  return Math.max(0, Math.min(4, Math.floor(ratio * 4 + 1e-9)));
}

function syncStaminaPersistMarkers(rt, bucket) {
  if (!rt) return;
  const nextBucket = Math.max(0, Math.min(4, Number(bucket)));
  rt._lastPersistedStaminaBucket = nextBucket;
  rt._lastQueuedStaminaBucket = nextBucket;
}

function shouldQueueStaminaPersist(rt, staminaCurrent, staminaMax) {
  const bucket = resolveStaminaPersistBucket(staminaCurrent, staminaMax);
  const lastQueued = Number.isFinite(Number(rt?._lastQueuedStaminaBucket))
    ? Number(rt._lastQueuedStaminaBucket)
    : Number.isFinite(Number(rt?._lastPersistedStaminaBucket))
      ? Number(rt._lastPersistedStaminaBucket)
      : bucket;

  const changed = bucket !== lastQueued;
  if (changed && rt) {
    rt._lastQueuedStaminaBucket = bucket;
  }

  return { changed, bucket, lastQueued };
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

function readRuntimeHungerCurrent(rt) {
  return toFiniteNumber(
    rt?.hungerCurrent ??
      rt?.hunger_current ??
      rt?.vitals?.hunger?.current ??
      rt?.combat?.hungerCurrent ??
      rt?.combat?.hunger_current ??
      rt?.stats?.hungerCurrent ??
      rt?.stats?.hunger_current,
    0
  );
}

function readRuntimeHungerMax(rt) {
  return toFiniteNumber(
    rt?.hungerMax ??
      rt?.hunger_max ??
      rt?.vitals?.hunger?.max ??
      rt?.combat?.hungerMax ??
      rt?.combat?.hunger_max ??
      rt?.stats?.hungerMax ??
      rt?.stats?.hunger_max,
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

function resolveHungerRegenMultiplier(hungerCurrent, hungerMax) {
  const max = Math.max(0, toFiniteNumber(hungerMax, 0));
  if (max <= 0) return 0;

  const ratio = clamp(toFiniteNumber(hungerCurrent, 0) / max, 0, 1);
  if (ratio <= 0) return 0;
  if (ratio <= 0.05) return 0.05;
  if (ratio < 0.15) return 0.5;
  if (ratio < 0.35) return 0.8;
  return 1;
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
    hungerItemRecovery = DEFAULT_HUNGER_ITEM_RECOVERY,
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
      hungerCurrent: 0,
      hungerMax: 0,
      hungerRegenMultiplier: 0,
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
  const hungerCurrent = readRuntimeHungerCurrent(rt);
  const hungerMax = Math.max(0, readRuntimeHungerMax(rt));
  const hungerRegenMultiplier = resolveHungerRegenMultiplier(hungerCurrent, hungerMax);
  const effectiveStaminaRegenMultiplier =
    toFiniteNumber(regenMultiplier, 1.0) * hungerRegenMultiplier;
  const effectiveHpRegenMultiplier =
    toFiniteNumber(hpRegenMultiplier, 1.0) * hungerRegenMultiplier;

  const hpRegen = HP_BASE_REGEN_PER_SEC * dt * effectiveHpRegenMultiplier;
  const drain = movedReal
    ? resolveCarryWeightDrainMultiplier(carryWeightRatio) *
      dt *
      toFiniteNumber(terrainDrainMultiplier, 1.0)
    : 0;
  const regen = STAMINA_BASE_REGEN_PER_SEC * dt * effectiveStaminaRegenMultiplier;
  const nextHungerCurrent = clamp(
    hungerCurrent + toFiniteNumber(hungerItemRecovery, 0),
    0,
    hungerMax
  );
  const nextHpCurrent = clamp(hpCurrent + hpRegen, 0, hpMax);
  const nextCurrent = clamp(current + regen - drain, 0, max);
  const hpChanged = Math.abs(nextHpCurrent - hpCurrent) > 1e-9;
  const staminaChanged = Math.abs(nextCurrent - current) > 1e-9;
  const hungerChanged = Math.abs(nextHungerCurrent - hungerCurrent) > 1e-9;
  const changed = hpChanged || staminaChanged || hungerChanged;

  if (hpChanged || hpMax !== readRuntimeHpMax(rt)) {
    syncRuntimeHp(rt, nextHpCurrent, hpMax);
  }

  if (staminaChanged || max !== readRuntimeStaminaMax(rt)) {
    syncRuntimeStamina(rt, nextCurrent, max);
  }

  if (hungerChanged || hungerMax !== readRuntimeHungerMax(rt)) {
    syncRuntimeHunger(rt, nextHungerCurrent, hungerMax);
  } else if (readRuntimeHungerMax(rt) !== hungerMax) {
    syncRuntimeHunger(rt, hungerCurrent, hungerMax);
  }

  return {
    changed,
    hpChanged,
    staminaChanged,
    hungerChanged,
    dt,
    hpRegen,
    drain,
    regen,
    hpCurrent: nextHpCurrent,
    hpMax,
    hungerCurrent: nextHungerCurrent,
    hungerMax,
    hungerRegenMultiplier,
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
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  syncRuntimeHunger,
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  syncRuntimeStamina,
  applyVitalsTick,
  applyStaminaTick,
  resolveHungerRegenMultiplier,
  resolveCarryWeightDrainMultiplier,
  resolveMoveSpeedMultiplierFromStamina,
  resolveStaminaPersistBucket,
  syncStaminaPersistMarkers,
  shouldQueueStaminaPersist,
};
