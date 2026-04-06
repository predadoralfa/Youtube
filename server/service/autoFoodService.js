"use strict";

const db = require("../models");
const { ensureInventoryLoaded } = require("../state/inventory/loader");
const { withInventoryLock, markDirty } = require("../state/inventory/store");
const { buildInventoryFull } = require("../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../state/equipment/loader");
const { markRuntimeDirty, markStatsDirty } = require("../state/runtime/dirty");
const {
  readRuntimeHungerCurrent,
  readRuntimeHungerMax,
  syncRuntimeHunger,
} = require("../state/movement/stamina");
const { ensureResearchLoaded, hasCapability } = require("./researchService");

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

function normalizePersistedAutoFoodConfig(row, hungerMax = 100) {
  const config = row?.config_json ?? row?.configJson ?? {};
  return {
    itemInstanceId:
      config?.itemInstanceId == null || config?.itemInstanceId === "" ? null : String(config.itemInstanceId),
    hungerThreshold: clamp(
      toFiniteNumber(config?.hungerThreshold, Math.min(60, hungerMax)),
      0,
      Math.max(0, hungerMax)
    ),
    cooldownUntilMs: 0,
    activeConsumption: null,
  };
}

async function loadPersistedAutoFoodConfig(userId, hungerMax = 100) {
  const row = await db.GaUserMacroConfig.findOne({
    where: {
      user_id: Number(userId),
      macro_code: "AUTO_FOOD",
      is_active: true,
    },
  });

  if (!row) {
    return {
      itemInstanceId: null,
      hungerThreshold: Math.min(60, Math.max(0, hungerMax)),
      cooldownUntilMs: 0,
      activeConsumption: null,
    };
  }

  return normalizePersistedAutoFoodConfig(row, hungerMax);
}

async function persistAutoFoodConfig(userId, autoFood) {
  const itemInstanceId =
    autoFood?.itemInstanceId == null || autoFood?.itemInstanceId === "" ? null : String(autoFood.itemInstanceId);
  const hungerThreshold = toFiniteNumber(autoFood?.hungerThreshold, 0);

  if (!itemInstanceId) {
    console.log("[AUTO_FOOD][DB] clearing config", {
      userId,
      macroCode: "AUTO_FOOD",
    });
    await db.GaUserMacroConfig.destroy({
      where: {
        user_id: Number(userId),
        macro_code: "AUTO_FOOD",
      },
    });
    return;
  }

  console.log("[AUTO_FOOD][DB] upserting config", {
    userId,
    macroCode: "AUTO_FOOD",
    itemInstanceId,
    hungerThreshold,
  });
  await db.GaUserMacroConfig.upsert({
    user_id: Number(userId),
    macro_code: "AUTO_FOOD",
    is_active: true,
    config_json: {
      itemInstanceId,
      hungerThreshold,
    },
    state_json: null,
  });
}

function findSlotByItemInstance(invRt, itemInstanceId) {
  const target = String(itemInstanceId ?? "");
  if (!target) return null;

  for (const container of invRt?.containers ?? []) {
    for (const slot of container?.slots ?? []) {
      if (String(slot?.itemInstanceId ?? "") === target && Number(slot?.qty ?? 0) > 0) {
        return {
          container,
          slot,
        };
      }
    }
  }

  return null;
}

function findConsumableComponent(itemDef) {
  const components = Array.isArray(itemDef?.components) ? itemDef.components : [];
  return (
    components.find((component) => String(component?.componentType ?? component?.component_type ?? "").toUpperCase() === "CONSUMABLE") ??
    null
  );
}

function getFoodSpec(invRt, itemInstanceId) {
  const itemInstance = invRt?.itemInstanceById?.get?.(String(itemInstanceId)) ?? null;
  if (!itemInstance) return null;

  const itemDef = invRt?.itemDefsById?.get?.(String(itemInstance.itemDefId)) ?? null;
  if (!itemDef) return null;
  if (String(itemDef.category ?? "").toUpperCase() !== "FOOD") return null;

  const component = findConsumableComponent(itemDef);
  const data = component?.dataJson ?? component?.data_json ?? null;
  const effects = Array.isArray(data?.effects) ? data.effects : [];
  const restoreEffect =
    effects.find((effect) => String(effect?.type ?? "").toUpperCase() === "RESTORE_HUNGER") ?? null;

  if (!restoreEffect) return null;

  const slotRef = findSlotByItemInstance(invRt, itemInstanceId);
  if (!slotRef) return null;

  return {
    itemInstance,
    itemDef,
    component,
    slotRef,
    restoreHunger: Math.max(0, toFiniteNumber(restoreEffect.value, 0)),
    consumeTimeMs: Math.max(1000, toFiniteNumber(data?.consumeTimeMs, 60000)),
    cooldownMs: Math.max(0, toFiniteNumber(data?.cooldownMs, 0)),
  };
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

async function consumeOneConfiguredFood(userId, itemInstanceId) {
  return withInventoryLock(userId, async () => {
    const invRt = await ensureInventoryLoaded(userId);
    const slotRef = findSlotByItemInstance(invRt, itemInstanceId);
    if (!slotRef) {
      return { ok: false, code: "AUTO_FOOD_ITEM_MISSING", invRt };
    }

    const { container, slot } = slotRef;
    const currentQty = Number(slot.qty ?? 0);
    if (currentQty <= 0) {
      return { ok: false, code: "AUTO_FOOD_QTY_EMPTY", invRt };
    }

    const tx = await db.sequelize.transaction();
    try {
      if (currentQty <= 1) {
        const consumedInstanceId = Number(slot.itemInstanceId);
        slot.itemInstanceId = null;
        slot.qty = 0;
        invRt.itemInstanceById?.delete?.(String(consumedInstanceId));

        await db.GaContainerSlot.upsert(
          {
            container_id: Number(container.id),
            slot_index: Number(slot.slotIndex),
            item_instance_id: null,
            qty: 0,
          },
          { transaction: tx }
        );

        await db.GaItemInstance.destroy({
          where: { id: consumedInstanceId },
          transaction: tx,
        });
      } else {
        slot.qty = currentQty - 1;
        await db.GaContainerSlot.upsert(
          {
            container_id: Number(container.id),
            slot_index: Number(slot.slotIndex),
            item_instance_id: Number(slot.itemInstanceId),
            qty: Number(slot.qty),
          },
          { transaction: tx }
        );
      }

      container.rev = Number(container.rev ?? 0) + 1;
      await db.GaContainer.increment({ rev: 1 }, { where: { id: Number(container.id) }, transaction: tx });
      markDirty(userId, container.id);

      await tx.commit();
      return { ok: true, invRt };
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    }
  });
}

async function setAutoFoodConfig(userId, rt, intent = {}) {
  if (!rt) {
    return { ok: false, code: "RUNTIME_NOT_LOADED", message: "Runtime not loaded" };
  }

  const invRt = await ensureInventoryLoaded(userId);
  const autoFood = getFoodMacroState(rt);
  const nextItemInstanceId =
    intent.itemInstanceId == null || intent.itemInstanceId === "" ? null : String(intent.itemInstanceId);
  const hungerMax = Math.max(0, toFiniteNumber(readRuntimeHungerMax(rt), 100)) || 100;
  const nextThreshold = clamp(
    toFiniteNumber(intent.hungerThreshold, autoFood.hungerThreshold ?? Math.min(60, hungerMax)),
    0,
    hungerMax
  );

  console.log("[AUTO_FOOD][SET] start", {
    userId,
    current: {
      itemInstanceId: autoFood.itemInstanceId ?? null,
      hungerThreshold: autoFood.hungerThreshold ?? null,
    },
    next: {
      itemInstanceId: nextItemInstanceId,
      hungerThreshold: nextThreshold,
    },
  });

  if (nextItemInstanceId) {
    await ensureResearchLoaded(userId, rt);
    const foodSpec = getFoodSpec(invRt, nextItemInstanceId);
    if (!foodSpec) {
      console.log("[AUTO_FOOD][SET] invalid item", {
        userId,
        itemInstanceId: nextItemInstanceId,
      });
      return {
        ok: false,
        code: "AUTO_FOOD_INVALID_ITEM",
        message: "Selected item is not a valid FOOD consumable",
      };
    }
    const autoFoodUnlockCode = `macro.auto_food:${foodSpec?.itemDef?.code ?? ""}`;
    if (!hasCapability(rt, autoFoodUnlockCode)) {
      return {
        ok: false,
        code: "RESEARCH_REQUIRED_FOR_AUTO_FOOD",
        message: "Study this food before using it in auto food",
      };
    }
    console.log("[AUTO_FOOD][SET] validated item", {
      userId,
      itemInstanceId: nextItemInstanceId,
      itemDefId: foodSpec?.itemDef?.id ?? null,
      itemCode: foodSpec?.itemDef?.code ?? null,
      hungerRestore: foodSpec?.restoreHunger ?? null,
      consumeTimeMs: foodSpec?.consumeTimeMs ?? null,
      cooldownMs: foodSpec?.cooldownMs ?? null,
      qty: foodSpec?.slotRef?.slot?.qty ?? null,
      containerId: foodSpec?.slotRef?.container?.id ?? null,
      slotIndex: foodSpec?.slotRef?.slot?.slotIndex ?? null,
    });
  }

  autoFood.itemInstanceId = nextItemInstanceId;
  autoFood.hungerThreshold = nextThreshold;
  if (!nextItemInstanceId) {
    autoFood.activeConsumption = null;
    autoFood.cooldownUntilMs = 0;
  } else if (String(autoFood.activeConsumption?.itemInstanceId ?? "") !== nextItemInstanceId) {
    autoFood.activeConsumption = null;
  }

  await persistAutoFoodConfig(userId, autoFood);
  markRuntimeDirty(userId);
  console.log("[AUTO_FOOD][SET] persisted", {
    userId,
    state: buildAutoFoodPayload(rt),
  });

  const eqRt = await ensureEquipmentLoaded(userId);
  const inventory = buildInventoryFull(invRt, eqRt);
  inventory.macro = {
    autoFood: buildAutoFoodPayload(rt),
  };

  return {
    ok: true,
    inventory,
  };
}

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
      console.log("[AUTO_FOOD][TICK] finishing consumption", {
        userId: rt.userId,
        itemInstanceId: active.itemInstanceId,
        restoreApplied: toFiniteNumber(active.appliedRestore, 0),
        cooldownUntilMs: autoFood.cooldownUntilMs,
      });

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
  const foodSpec = getFoodSpec(invRt, autoFood.itemInstanceId);
  if (!foodSpec) {
    console.log("[AUTO_FOOD][TICK] configured item missing or invalid", {
      userId: rt.userId,
      itemInstanceId: autoFood.itemInstanceId,
    });
    autoFood.itemInstanceId = null;
    autoFood.activeConsumption = null;
    autoFood.cooldownUntilMs = 0;
    markRuntimeDirty(rt.userId, now);
    return { changed: true, inventoryChanged: false };
  }

  await ensureResearchLoaded(rt.userId, rt);
  const consumeUnlockCode = `item.consume:${foodSpec?.itemDef?.code ?? ""}`;
  if (!hasCapability(rt, consumeUnlockCode)) {
    autoFood.itemInstanceId = null;
    autoFood.activeConsumption = null;
    autoFood.cooldownUntilMs = 0;
    markRuntimeDirty(rt.userId, now);
    return { changed: true, inventoryChanged: false };
  }

  console.log("[AUTO_FOOD][TICK] starting consumption", {
    userId: rt.userId,
    itemInstanceId: autoFood.itemInstanceId,
    hungerCurrent,
    hungerThreshold: autoFood.hungerThreshold,
    hungerRestore: foodSpec.restoreHunger,
    consumeTimeMs: foodSpec.consumeTimeMs,
    cooldownMs: foodSpec.cooldownMs,
  });

  const consumeResult = await consumeOneConfiguredFood(rt.userId, autoFood.itemInstanceId);
  if (!consumeResult?.ok) {
    console.log("[AUTO_FOOD][TICK] consume failed at start", {
      userId: rt.userId,
      itemInstanceId: autoFood.itemInstanceId,
      code: consumeResult?.code ?? "AUTO_FOOD_CONSUME_FAILED",
    });
    autoFood.itemInstanceId = null;
    autoFood.activeConsumption = null;
    autoFood.cooldownUntilMs = 0;
    markRuntimeDirty(rt.userId, now);
    return { changed: true, inventoryChanged: false };
  }

  console.log("[AUTO_FOOD][TICK] consume reserved at start", {
    userId: rt.userId,
    itemInstanceId: autoFood.itemInstanceId,
  });

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
  getFoodMacroState,
  buildAutoFoodPayload,
  loadPersistedAutoFoodConfig,
  setAutoFoodConfig,
  processAutoFoodTick,
};
