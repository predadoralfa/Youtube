"use strict";

const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const { markRuntimeDirty, markStatsDirty } = require("../../state/runtime/dirty");
const {
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  syncRuntimeHunger,
} = require("../../state/movement/stamina");
const { ensureResearchLoaded, hasCapability } = require("../researchService");
const { persistAutoFoodConfig } = require("./config");
const { getFoodSpec } = require("./foodSpec");
const { consumeOneConfiguredFood } = require("./actions");
const { clamp, getFoodMacroState, toFiniteNumber } = require("./shared");

async function processAutoFoodTick(rt, nowMs) {
  if (!rt) return { changed: false, inventoryChanged: false };

  const autoFood = getFoodMacroState(rt);
  if (!autoFood.itemInstanceId) return { changed: false, inventoryChanged: false };

  const now = toFiniteNumber(nowMs, Date.now());
  const hungerMax = Math.max(0, toFiniteNumber(readRuntimeHungerMax(rt), 0));
  const hungerCurrent = Math.max(0, toFiniteNumber(readRuntimeHungerCurrent(rt), 0));

  if (autoFood.activeConsumption) {
    const active = autoFood.activeConsumption;
    const elapsedMs = clamp(now - toFiniteNumber(active.startedAtMs, now), 0, toFiniteNumber(active.consumeTimeMs, 0));
    const durationMs = Math.max(1, toFiniteNumber(active.consumeTimeMs, 1));
    const targetAppliedRestore = toFiniteNumber(active.restoreHunger, 0) * (elapsedMs / durationMs);
    const alreadyAppliedRestore = toFiniteNumber(active.appliedRestore, 0);
    const deltaRestore = Math.max(0, targetAppliedRestore - alreadyAppliedRestore);

    let changed = false;
    let inventoryChanged = false;

    if (deltaRestore > 1e-9) {
      syncRuntimeHunger(rt, clamp(hungerCurrent + deltaRestore, 0, hungerMax), hungerMax);
      active.appliedRestore = alreadyAppliedRestore + deltaRestore;
      changed = true;
    }

    if (elapsedMs >= durationMs) {
      autoFood.cooldownUntilMs = now + Math.max(0, toFiniteNumber(active.cooldownMs, 0));
      autoFood.activeConsumption = null;
      changed = true;
    }

    if (changed) {
      markStatsDirty(rt.userId, now);
      markRuntimeDirty(rt.userId, now);
    }

    return { changed, inventoryChanged };
  }

  if (now < toFiniteNumber(autoFood.cooldownUntilMs, 0)) {
    return { changed: false, inventoryChanged: false };
  }

  if (hungerCurrent > toFiniteNumber(autoFood.hungerThreshold, 0)) {
    return { changed: false, inventoryChanged: false };
  }

  const invRt = await ensureInventoryLoaded(rt.userId);
  const eqRt = await ensureEquipmentLoaded(rt.userId);
  const foodSpec = await getFoodSpec(invRt, eqRt, autoFood.itemInstanceId);
  if (!foodSpec) {
    autoFood.itemInstanceId = null;
    autoFood.activeConsumption = null;
    autoFood.cooldownUntilMs = 0;
    await persistAutoFoodConfig(rt.userId, autoFood);
    markRuntimeDirty(rt.userId, now);
    return { changed: true, inventoryChanged: false };
  }

  await ensureResearchLoaded(rt.userId, rt);
  const consumeUnlockCode = `item.consume:${foodSpec?.itemDef?.code ?? ""}`;
  if (!hasCapability(rt, consumeUnlockCode)) {
    autoFood.itemInstanceId = null;
    autoFood.activeConsumption = null;
    autoFood.cooldownUntilMs = 0;
    await persistAutoFoodConfig(rt.userId, autoFood);
    markRuntimeDirty(rt.userId, now);
    return { changed: true, inventoryChanged: false };
  }

  const consumeResult = await consumeOneConfiguredFood(rt.userId, autoFood.itemInstanceId);
  if (!consumeResult?.ok) {
    autoFood.itemInstanceId = null;
    autoFood.activeConsumption = null;
    autoFood.cooldownUntilMs = 0;
    await persistAutoFoodConfig(rt.userId, autoFood);
    markRuntimeDirty(rt.userId, now);
    return { changed: true, inventoryChanged: false };
  }

  autoFood.activeConsumption = {
    itemInstanceId: String(autoFood.itemInstanceId),
    startedAtMs: now,
    consumeTimeMs: foodSpec.consumeTimeMs,
    cooldownMs: foodSpec.cooldownMs,
    restoreHunger: foodSpec.restoreHunger,
    appliedRestore: 0,
  };
  markRuntimeDirty(rt.userId, now);
  return { changed: true, inventoryChanged: true };
}

module.exports = {
  processAutoFoodTick,
};
