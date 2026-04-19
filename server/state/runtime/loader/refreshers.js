"use strict";

const { getRuntime } = require("../store");
const { markStatsDirty } = require("../dirty");
const { loadPlayerCombatStats } = require("../combatLoader");
const {
  resolveStaminaPersistBucket,
  syncStaminaPersistMarkers,
} = require("../../movement/stamina");
const { applyCombatStatsToRuntime } = require("./shared");
const { loadSpeedFromStats } = require("./queries");

async function refreshRuntimeStats(userId) {
  const runtime = getRuntime(userId);
  if (!runtime) return null;

  const speedFromStats = await loadSpeedFromStats(userId);
  if (speedFromStats == null) return runtime;

  runtime.speed = speedFromStats;
  runtime._speedFallback = false;

  markStatsDirty(userId);
  return runtime;
}

async function refreshRuntimeCombatStats(userId) {
  const runtime = getRuntime(userId);
  if (!runtime) return null;

  const combatStats = await loadPlayerCombatStats(userId);
  applyCombatStatsToRuntime(runtime, combatStats);
  runtime.dirtyStats = Boolean(combatStats?.hungerWasAdjusted || combatStats?.thirstWasAdjusted);
  syncStaminaPersistMarkers(
    runtime,
    resolveStaminaPersistBucket(combatStats?.staminaCurrent, combatStats?.staminaMax)
  );
  markStatsDirty(userId);
  return runtime;
}

module.exports = {
  refreshRuntimeStats,
  refreshRuntimeCombatStats,
};
