"use strict";

const { computeChunk } = require("../chunk");
const { getRuntime, setRuntime, hasRuntime } = require("../store");
const { loadPlayerCombatStats } = require("../combatLoader");
const { loadPersistedAutoFoodConfig } = require("../../../service/autoFoodService");
const { getTimeFactor } = require("../../../service/worldClockService");
const {
  resolveClimateStressFactor,
  resolveImmunityRecoveryPerSecond,
  resolveImmunityLossPerSecond,
  IMMUNITY_MIN_VALUE,
  IMMUNITY_MAX_VALUE,
} = require("../../movement/status");
const {
  resolveStaminaPersistBucket,
  syncStaminaPersistMarkers,
} = require("../../movement/stamina");
const { syncRuntimeImmunity } = require("../../movement/stamina/runtimeVitals");
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
  const worldTimeFactor = await getTimeFactor();

  const runtime = createBaseRuntime({
    row,
    bounds,
    speed: speedFromStats,
    combatStats,
    autoFood: persistedAutoFood,
    nowMs,
  });

  applyCombatStatsToRuntime(runtime, combatStats);
  const statsUpdatedAtMs = Number(combatStats?.statsUpdatedAtMs ?? nowMs);
  const elapsedSeconds = Math.max(0, (nowMs - statsUpdatedAtMs) / 1000);

  if (combatStats?.immunityCurrent != null && combatStats?.immunityMax != null && elapsedSeconds > 0) {
    const climateStressFactor = resolveClimateStressFactor(row.instance_id);
    const hungerRatio = Math.max(
      0,
      Math.min(
        1,
        (Number(combatStats?.hungerCurrent ?? 100) || 100) /
          Math.max(1, Number(combatStats?.hungerMax ?? 100) || 100)
      )
    );
    const hpRatio = Math.max(
      0,
      Math.min(
        1,
        (Number(combatStats?.hpCurrent ?? 100) || 100) /
          Math.max(1, Number(combatStats?.hpMax ?? 100) || 100)
      )
    );
    const recoveryPerSecond = resolveImmunityRecoveryPerSecond(
      combatStats.immunityMax,
      worldTimeFactor
    );
    const lossPerSecond = resolveImmunityLossPerSecond({
      immunityMax: combatStats.immunityMax,
      timeFactor: worldTimeFactor,
      climateStressFactor,
      hungerRatio,
      hpRatio,
    });
    const nextImmunityCurrent = Math.max(
      IMMUNITY_MIN_VALUE,
      Math.min(
        IMMUNITY_MAX_VALUE,
        Number(combatStats.immunityCurrent ?? IMMUNITY_MIN_VALUE) +
          recoveryPerSecond * elapsedSeconds -
          lossPerSecond * elapsedSeconds
      )
    );

    if (
      Math.abs(nextImmunityCurrent - Number(combatStats.immunityCurrent ?? IMMUNITY_MIN_VALUE)) >
      1e-9
    ) {
      syncRuntimeImmunity(runtime, nextImmunityCurrent, combatStats.immunityMax);
      runtime.dirtyStats = true;
    }
  }

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
