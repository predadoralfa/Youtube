"use strict";

const { readRuntimeHungerMax } = require("../../state/movement/stamina");

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getFoodMacroState(rt) {
  if (!rt.autoFood || typeof rt.autoFood !== "object") {
    rt.autoFood = {
      itemInstanceId: null,
      hungerThreshold: 60,
      cooldownUntilMs: 0,
      activeConsumption: null,
    };
  }

  const hungerMax = Math.max(0, toFiniteNumber(readRuntimeHungerMax(rt), 100)) || 100;
  rt.autoFood.hungerThreshold = clamp(
    toFiniteNumber(rt.autoFood.hungerThreshold, Math.min(60, hungerMax)),
    0,
    hungerMax
  );
  rt.autoFood.cooldownUntilMs = Math.max(0, toFiniteNumber(rt.autoFood.cooldownUntilMs, 0));

  return rt.autoFood;
}

function buildAutoFoodPayload(rt) {
  const autoFood = getFoodMacroState(rt);
  return {
    itemInstanceId: autoFood.itemInstanceId != null ? String(autoFood.itemInstanceId) : null,
    hungerThreshold: toFiniteNumber(autoFood.hungerThreshold, 0),
    cooldownUntilMs: toFiniteNumber(autoFood.cooldownUntilMs, 0),
    activeConsumption: autoFood.activeConsumption
      ? {
          itemInstanceId: String(autoFood.activeConsumption.itemInstanceId),
          startedAtMs: toFiniteNumber(autoFood.activeConsumption.startedAtMs, 0),
          consumeTimeMs: toFiniteNumber(autoFood.activeConsumption.consumeTimeMs, 0),
          restoreHunger: toFiniteNumber(autoFood.activeConsumption.restoreHunger, 0),
        }
      : null,
  };
}

module.exports = {
  toFiniteNumber,
  clamp,
  parseMaybeJsonObject,
  getFoodMacroState,
  buildAutoFoodPayload,
};
