"use strict";

const {
  MOVE_STAMINA_DRAIN_PER_SEC,
  STAMINA_BASE_REGEN_PER_SEC,
  HP_BASE_REGEN_PER_SEC,
  DEFAULT_TERRAIN_DRAIN_MULTIPLIER,
  DEFAULT_STAMINA_REGEN_MULTIPLIER,
  DEFAULT_HP_REGEN_MULTIPLIER,
  HUNGER_TICK_INTERVAL_MS,
  HUNGER_WORLD_HOURS_TO_EMPTY,
  THIRST_TICK_INTERVAL_MS,
  THIRST_WORLD_HOURS_TO_EMPTY,
} = require("./stamina/shared");
const {
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  syncRuntimeHp,
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  syncRuntimeHunger,
  readRuntimeThirstCurrent,
  readRuntimeThirstMax,
  syncRuntimeThirst,
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  syncRuntimeStamina,
} = require("./stamina/runtimeVitals");
const {
  applyVitalsTick,
  applyStaminaTick,
} = require("./stamina/vitalsTick");
const {
  resolveHungerRegenMultiplier,
  resolveHungerDrainPerSecond,
  applyHungerTick,
} = require("./stamina/hunger");
const {
  resolveThirstRegenMultiplier,
  resolveThirstDrainPerSecond,
  applyThirstTick,
} = require("./stamina/thirst");
const {
  resolveCarryWeightDrainMultiplier,
  resolveMoveSpeedMultiplierFromStamina,
} = require("./stamina/carryWeight");
const {
  resolveStaminaPersistBucket,
  syncStaminaPersistMarkers,
  shouldQueueStaminaPersist,
} = require("./stamina/persist");

module.exports = {
  MOVE_STAMINA_DRAIN_PER_SEC,
  STAMINA_BASE_REGEN_PER_SEC,
  HP_BASE_REGEN_PER_SEC,
  DEFAULT_TERRAIN_DRAIN_MULTIPLIER,
  DEFAULT_STAMINA_REGEN_MULTIPLIER,
  DEFAULT_HP_REGEN_MULTIPLIER,
  HUNGER_TICK_INTERVAL_MS,
  HUNGER_WORLD_HOURS_TO_EMPTY,
  THIRST_TICK_INTERVAL_MS,
  THIRST_WORLD_HOURS_TO_EMPTY,
  readRuntimeHpCurrent,
  readRuntimeHpMax,
  syncRuntimeHp,
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  syncRuntimeHunger,
  readRuntimeThirstCurrent,
  readRuntimeThirstMax,
  syncRuntimeThirst,
  readRuntimeStaminaCurrent,
  readRuntimeStaminaMax,
  syncRuntimeStamina,
  applyVitalsTick,
  applyStaminaTick,
  applyHungerTick,
  resolveHungerRegenMultiplier,
  resolveHungerDrainPerSecond,
  resolveThirstRegenMultiplier,
  resolveThirstDrainPerSecond,
  resolveCarryWeightDrainMultiplier,
  resolveMoveSpeedMultiplierFromStamina,
  resolveStaminaPersistBucket,
  syncStaminaPersistMarkers,
  shouldQueueStaminaPersist,
  applyThirstTick,
};
