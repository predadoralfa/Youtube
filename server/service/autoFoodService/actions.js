"use strict";

const db = require("../../models");
const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { withInventoryLock } = require("../../state/inventory/store");
const { buildInventoryFull } = require("../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const { clearEquipment } = require("../../state/equipment/store");
const { markRuntimeDirty, markStatsDirty } = require("../../state/runtime/dirty");
const { readRuntimeHungerMax } = require("../../state/movement/stamina");
const { ensureResearchLoaded, hasCapability } = require("../researchService");
const { buildAutoFoodPayload, clamp, getFoodMacroState, toFiniteNumber } = require("./shared");
const { persistAutoFoodConfig } = require("./config");
const { getFoodItemInstance, ensureItemDefHydrated, getFoodSpec, findFoodLocation } = require("./foodSpec");
const DEBUG_AUTO_FOOD = process.env.NODE_ENV !== "production";

async function consumeFoodInstanceUnlocked(userId, itemInstanceId) {
  const invRt = await ensureInventoryLoaded(userId);
  const eqRt = await ensureEquipmentLoaded(userId);
  const slotRef = findFoodLocation(invRt, eqRt, itemInstanceId);
  if (!slotRef) {
    return { ok: false, code: "AUTO_FOOD_ITEM_MISSING", invRt, eqRt };
  }

  const tx = await db.sequelize.transaction();
  try {
    if (slotRef.kind === "INVENTORY") {
      const { container, slot } = slotRef;
      const currentQty = Number(slot.qty ?? 0);
      if (currentQty <= 0) {
        return { ok: false, code: "AUTO_FOOD_QTY_EMPTY", invRt, eqRt };
      }

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
    } else {
      const consumedInstanceId = Number(slotRef.equipment?.itemInstanceId);
      if (!consumedInstanceId) {
        return { ok: false, code: "AUTO_FOOD_ITEM_MISSING", invRt, eqRt };
      }

      await db.GaEquippedItem.destroy({
        where: {
          owner_kind: "PLAYER",
          owner_id: Number(userId),
          item_instance_id: consumedInstanceId,
        },
        transaction: tx,
      });

      invRt.itemInstanceById?.delete?.(String(consumedInstanceId));
      clearEquipment(userId);
      await db.GaItemInstance.destroy({
        where: { id: consumedInstanceId },
        transaction: tx,
      });
    }

    await tx.commit();
    return { ok: true, invRt, eqRt, slotRef };
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
}

async function consumeOneConfiguredFood(userId, itemInstanceId) {
  return withInventoryLock(userId, async () => consumeFoodInstanceUnlocked(userId, itemInstanceId));
}

async function resolveFoodCapabilityCode(invRt, eqRt, itemInstanceId) {
  const itemInstance = getFoodItemInstance(invRt, eqRt, itemInstanceId);
  if (!itemInstance) return null;

  const itemDef = await ensureItemDefHydrated(invRt, eqRt, itemInstance.itemDefId, true);
  const category = String(itemDef?.category ?? "").toUpperCase();
  if (DEBUG_AUTO_FOOD) {
    console.debug("[AUTO_FOOD][server][resolve:item]", {
      itemInstanceId: String(itemInstanceId ?? ""),
      itemDefId: String(itemInstance.itemDefId ?? ""),
      itemCode: String(itemDef?.code ?? ""),
      category,
      hasComponents: Array.isArray(itemDef?.components) && itemDef.components.length > 0,
    });
  }
  if (!(category === "FOOD" || category === "CONSUMABLE")) return null;

  const itemCode = String(itemDef?.code ?? "").trim().toUpperCase();
  return itemCode ? { itemDef, itemCode } : null;
}

async function startFoodConsumption(rt, itemInstanceId, options = {}) {
  if (!rt) {
    return { ok: false, code: "RUNTIME_NOT_LOADED", message: "Runtime not loaded" };
  }

  const userId = Number(rt.userId);
  const run = async () => {
    const invRt = await ensureInventoryLoaded(userId);
    const eqRt = await ensureEquipmentLoaded(userId);
    if (DEBUG_AUTO_FOOD) {
      console.debug("[AUTO_FOOD][server][consume:start]", {
        userId,
        itemInstanceId: String(itemInstanceId ?? ""),
      });
    }
    const capabilityItem = await resolveFoodCapabilityCode(invRt, eqRt, itemInstanceId);
    if (!capabilityItem?.itemCode) {
      if (DEBUG_AUTO_FOOD) {
        console.debug("[AUTO_FOOD][server][consume:invalid-item]", {
          userId,
          itemInstanceId: String(itemInstanceId ?? ""),
        });
      }
      return {
        ok: false,
        code: "AUTO_FOOD_INVALID_ITEM",
        message: "Selected item is not a valid FOOD consumable",
      };
    }

    if (DEBUG_AUTO_FOOD) {
      console.debug("[AUTO_FOOD][server][consume:resolved-item]", {
        userId,
        itemInstanceId: String(itemInstanceId ?? ""),
        itemDefId: String(capabilityItem.itemDef?.id ?? ""),
        itemCode: capabilityItem.itemCode,
        category: String(capabilityItem.itemDef?.category ?? "").toUpperCase(),
      });
    }

    const foodSpec = await getFoodSpec(invRt, eqRt, itemInstanceId);
    if (!foodSpec) {
      if (DEBUG_AUTO_FOOD) {
        console.debug("[AUTO_FOOD][server][consume:invalid-spec]", {
          userId,
          itemInstanceId: String(itemInstanceId ?? ""),
          itemCode: capabilityItem.itemCode,
        });
      }
      return {
        ok: false,
        code: "AUTO_FOOD_INVALID_ITEM",
        message: "Selected item is not a valid FOOD consumable",
      };
    }

    await ensureResearchLoaded(userId, rt);
    const consumeUnlockCode = `item.consume:${capabilityItem.itemCode}`;
    const consumeUnlocked = hasCapability(rt, consumeUnlockCode);
    if (DEBUG_AUTO_FOOD) {
      console.debug("[AUTO_FOOD][server][consume:research-check]", {
        userId,
        itemCode: capabilityItem.itemCode,
        consumeUnlockCode,
        consumeUnlocked,
      });
    }
    if (!consumeUnlocked) {
      return {
        ok: false,
        code: "RESEARCH_REQUIRED_FOR_AUTO_FOOD",
        message: "Study this food before using it",
      };
    }

    const autoFood = getFoodMacroState(rt);
    if (autoFood.activeConsumption && !options.force) {
      return {
        ok: false,
        code: "FOOD_ALREADY_CONSUMING",
        message: "Already consuming food",
      };
    }

    const consumeResult = await consumeFoodInstanceUnlocked(userId, itemInstanceId);
    if (!consumeResult?.ok) {
      return consumeResult;
    }

    const now = Math.max(0, toFiniteNumber(options.nowMs, Date.now()));
    autoFood.activeConsumption = {
      itemInstanceId: String(itemInstanceId),
      startedAtMs: now,
      consumeTimeMs: foodSpec.consumeTimeMs,
      cooldownMs: foodSpec.cooldownMs,
      restoreHunger: foodSpec.restoreHunger,
      appliedRestore: 0,
    };

    const inventory = buildInventoryFull(consumeResult.invRt, consumeResult.eqRt);
    inventory.macro = {
      autoFood: buildAutoFoodPayload(rt),
    };

    markStatsDirty(userId, now);
    markRuntimeDirty(userId, now);
    return {
      ok: true,
      inventory,
      autoFood: buildAutoFoodPayload(rt),
      foodSpec,
    };
  };

  if (options.skipLock) {
    return run();
  }

  return withInventoryLock(userId, run);
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

  if (nextItemInstanceId) {
    const eqRt = await ensureEquipmentLoaded(userId);
    if (DEBUG_AUTO_FOOD) {
      console.debug("[AUTO_FOOD][server][set:start]", {
        userId,
        itemInstanceId: nextItemInstanceId,
        hungerThreshold: nextThreshold,
      });
    }
    const capabilityItem = await resolveFoodCapabilityCode(invRt, eqRt, nextItemInstanceId);
    if (!capabilityItem?.itemCode) {
      if (DEBUG_AUTO_FOOD) {
        console.debug("[AUTO_FOOD][server][set:invalid-item]", {
          userId,
          itemInstanceId: nextItemInstanceId,
        });
      }
      return {
        ok: false,
        code: "AUTO_FOOD_INVALID_ITEM",
        message: "Selected item is not a valid FOOD consumable",
      };
    }

    if (DEBUG_AUTO_FOOD) {
      console.debug("[AUTO_FOOD][server][set:resolved-item]", {
        userId,
        itemInstanceId: nextItemInstanceId,
        itemDefId: String(capabilityItem.itemDef?.id ?? ""),
        itemCode: capabilityItem.itemCode,
        category: String(capabilityItem.itemDef?.category ?? "").toUpperCase(),
      });
    }

    await ensureResearchLoaded(userId, rt);
    const autoFoodUnlockCode = `macro.auto_food:${capabilityItem.itemCode}`;
    const autoFoodUnlocked = hasCapability(rt, autoFoodUnlockCode);
    if (DEBUG_AUTO_FOOD) {
      console.debug("[AUTO_FOOD][server][set:research-check]", {
        userId,
        itemCode: capabilityItem.itemCode,
        autoFoodUnlockCode,
        autoFoodUnlocked,
      });
    }
    if (!autoFoodUnlocked) {
      return {
        ok: false,
        code: "RESEARCH_REQUIRED_FOR_AUTO_FOOD",
        message: "Study this food before using it in auto food",
      };
    }

    const foodSpec = await getFoodSpec(invRt, eqRt, nextItemInstanceId, {
      requireSlotRef: false,
    });
    if (!foodSpec) {
      if (DEBUG_AUTO_FOOD) {
        console.debug("[AUTO_FOOD][server][set:invalid-spec]", {
          userId,
          itemInstanceId: nextItemInstanceId,
          itemCode: capabilityItem.itemCode,
        });
      }
      return {
        ok: false,
        code: "AUTO_FOOD_INVALID_ITEM",
        message: "Selected item is not a valid FOOD consumable",
      };
    }
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
  if (DEBUG_AUTO_FOOD) {
    console.debug("[AUTO_FOOD][server][set:ok]", {
      userId,
      itemInstanceId: nextItemInstanceId,
      hungerThreshold: nextThreshold,
      activeConsumption: Boolean(autoFood.activeConsumption),
    });
  }

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

module.exports = {
  consumeOneConfiguredFood,
  startFoodConsumption,
  setAutoFoodConfig,
};
