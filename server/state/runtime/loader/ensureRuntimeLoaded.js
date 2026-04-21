"use strict";

const { computeChunk } = require("../chunk");
const { getRuntime, setRuntime, hasRuntime } = require("../store");
const { loadPlayerCombatStats } = require("../combatLoader");
const { loadPersistedAutoFoodConfig } = require("../../../service/autoFoodService");
const {
  resolveStaminaPersistBucket,
  syncStaminaPersistMarkers,
} = require("../../movement/stamina");
const { applyCombatStatsToRuntime } = require("./shared");
const { loadSpeedFromStats, loadBoundsForInstance, loadRuntimeRow } = require("./queries");
const { createBaseRuntime } = require("./runtimeFactory");

async function ensureRuntimeLoaded(userId) {
  const key = String(userId);
  if (hasRuntime(key)) return getRuntime(key);

  const row = await loadRuntimeRow(userId);
  if (!row) {
    throw new Error("Runtime ausente no banco (ga_user_runtime)");
  }

  const [bounds, speedFromStats, combatStats] = await Promise.all([
    loadBoundsForInstance(row.instance_id),
    loadSpeedFromStats(userId),
    loadPlayerCombatStats(userId),
  ]);

  if (speedFromStats == null) {
    throw new Error(
      `move_speed ausente ou invalido para userId=${userId}; runtime nao pode ser carregado sem velocidade autoritativa`
    );
  }

  const hungerMax = Math.max(0, Number(combatStats?.hungerMax ?? 100) || 100);
  const persistedAutoFood = await loadPersistedAutoFoodConfig(userId, hungerMax);
  const nowMs = Date.now();

  const runtime = createBaseRuntime({
    row,
    bounds,
    speed: speedFromStats,
    combatStats,
    autoFood: persistedAutoFood,
    nowMs,
  });

  applyCombatStatsToRuntime(runtime, combatStats);
  runtime.dirtyStats = Boolean(
    runtime.dirtyStats ||
    combatStats?.hungerWasAdjusted ||
    combatStats?.thirstWasAdjusted ||
    combatStats?.immunityWasAdjusted ||
    combatStats?.sleepWasAdjusted
  );
  syncStaminaPersistMarkers(
    runtime,
    resolveStaminaPersistBucket(combatStats?.staminaCurrent, combatStats?.staminaMax)
  );

  runtime.chunk = computeChunk(runtime.pos);
  setRuntime(key, runtime);
  return runtime;
}

module.exports = {
  ensureRuntimeLoaded,
};
