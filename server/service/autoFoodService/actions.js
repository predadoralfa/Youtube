"use strict";

const db = require("../../models");
const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { withInventoryLock } = require("../../state/inventory/store");
const { buildInventoryFull } = require("../../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../../state/equipment/loader");
const { clearEquipment } = require("../../state/equipment/store");
const { markRuntimeDirty } = require("../../state/runtime/dirty");
const { readRuntimeHungerMax } = require("../../state/movement/stamina");
const { ensureResearchLoaded, hasCapability } = require("../researchService");
const { buildAutoFoodPayload, clamp, getFoodMacroState, toFiniteNumber } = require("./shared");
const { persistAutoFoodConfig } = require("./config");
const { findFoodLocation, getFoodSpec } = require("./foodSpec");

async function consumeOneConfiguredFood(userId, itemInstanceId) {
  return withInventoryLock(userId, async () => {
    const invRt = await ensureInventoryLoaded(userId);
    const eqRt = await ensureEquipmentLoaded(userId);
    const slotRef = findFoodLocation(invRt, eqRt, itemInstanceId);
    if (!slotRef) {
      return { ok: false, code: "AUTO_FOOD_ITEM_MISSING", invRt };
    }

    const tx = await db.sequelize.transaction();
    try {
      if (slotRef.kind === "INVENTORY") {
        const { container, slot } = slotRef;
        const currentQty = Number(slot.qty ?? 0);
        if (currentQty <= 0) {
          return { ok: false, code: "AUTO_FOOD_QTY_EMPTY", invRt };
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
          return { ok: false, code: "AUTO_FOOD_ITEM_MISSING", invRt };
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

  if (nextItemInstanceId) {
    await ensureResearchLoaded(userId, rt);
    const eqRt = await ensureEquipmentLoaded(userId);
    const foodSpec = getFoodSpec(invRt, eqRt, nextItemInstanceId);
    if (!foodSpec) {
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
  setAutoFoodConfig,
};
