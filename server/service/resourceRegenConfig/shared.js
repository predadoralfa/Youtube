"use strict";

const DEFAULT_INSTANCE_RESOURCE_REGEN_ENABLED = true;
const DEFAULT_INSTANCE_RESOURCE_REGEN_MULTIPLIER = 1;
const DEFAULT_INSTANCE_RESOURCE_REGEN_TICK_MS = 60000;

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampFloorInt(value, fallback = 1) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function normalizeInstanceResourceConfig(config) {
  if (!config) {
    return {
      resourceRegenEnabled: DEFAULT_INSTANCE_RESOURCE_REGEN_ENABLED,
      resourceRegenMultiplier: DEFAULT_INSTANCE_RESOURCE_REGEN_MULTIPLIER,
      resourceRegenTickMs: DEFAULT_INSTANCE_RESOURCE_REGEN_TICK_MS,
    };
  }

  return {
    resourceRegenEnabled:
      config.resource_regen_enabled == null
        ? DEFAULT_INSTANCE_RESOURCE_REGEN_ENABLED
        : Boolean(config.resource_regen_enabled),
    resourceRegenMultiplier: Math.max(
      0,
      toNum(config.resource_regen_multiplier, DEFAULT_INSTANCE_RESOURCE_REGEN_MULTIPLIER)
    ),
    resourceRegenTickMs: Math.max(
      1000,
      clampFloorInt(config.resource_regen_tick_ms, DEFAULT_INSTANCE_RESOURCE_REGEN_TICK_MS)
    ),
  };
}

function resolveInstanceResourceConfig(instance) {
  const rawConfig =
    instance?.resourceConfig?.get?.({ plain: true }) ??
    instance?.resourceConfig ??
    null;

  return normalizeInstanceResourceConfig(rawConfig);
}

function computeEffectiveResourceRegenIntervalMs(baseIntervalMs, instanceResourceConfig) {
  const base = Math.max(0, clampFloorInt(baseIntervalMs, 300000));
  const multiplier = Math.max(
    0,
    toNum(instanceResourceConfig?.resourceRegenMultiplier, DEFAULT_INSTANCE_RESOURCE_REGEN_MULTIPLIER)
  );

  return Math.max(0, Math.floor(base * multiplier));
}

module.exports = {
  DEFAULT_INSTANCE_RESOURCE_REGEN_ENABLED,
  DEFAULT_INSTANCE_RESOURCE_REGEN_MULTIPLIER,
  DEFAULT_INSTANCE_RESOURCE_REGEN_TICK_MS,
  normalizeInstanceResourceConfig,
  resolveInstanceResourceConfig,
  computeEffectiveResourceRegenIntervalMs,
};
