"use strict";

const db = require("../models");
const { getRuntime } = require("../state/runtimeStore");
const { createActorWithContainer } = require("./actorService");
function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveDropVisualHint(itemDef, effectiveItemInstance) {
  const code = String(itemDef?.code ?? effectiveItemInstance?.code ?? "").trim().toUpperCase();
  const name = String(itemDef?.name ?? effectiveItemInstance?.name ?? "").trim().toUpperCase();
  const token = `${code} ${name}`;

  if (token.includes("APPLE") || token.includes("MACA")) return "APPLE";
  if (token.includes("STONE") || token.includes("ROCK") || token.includes("PEDRA")) return "ROCK";
  return "DEFAULT";
}

function findInventorySourceSlot(invRt, itemInstanceId) {
  const targetId = String(itemInstanceId);

  for (const container of invRt?.containers ?? []) {
    for (const slot of container?.slots ?? []) {
      if (String(slot?.itemInstanceId ?? "") !== targetId) continue;
      return { container, slot };
    }
  }

  return null;
}

function findEquipmentSourceSlot(eqRt, itemInstanceId) {
  const targetId = String(itemInstanceId);

  for (const [slotCode, equipped] of Object.entries(eqRt?.equipmentBySlotCode ?? {})) {
    if (!equipped) continue;

    const equippedItemInstanceId = String(
      equipped.itemInstanceId ?? equipped.itemInstance?.id ?? ""
    );
    if (equippedItemInstanceId !== targetId) continue;

    return {
      slotCode,
      equipped,
      qty: Number(equipped.qty ?? 1) || 1,
    };
  }

  return null;
}

async function findFirstEmptyLootSlot(containerId, tx) {
  return db.GaContainerSlot.findOne({
    where: {
      container_id: containerId,
      item_instance_id: null,
    },
    order: [["slot_index", "ASC"]],
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });
}

async function resolveLootContainerDef(tx) {
  const preferredCodes = ["Stone Container", "LOOT_CONTAINER", "CHEST_10"];

  for (const code of preferredCodes) {
    const containerDef = await db.GaContainerDef.findOne({
      where: { code },
      transaction: tx,
      lock: tx?.LOCK?.UPDATE,
    });

    if (containerDef) {
      if (code !== "LOOT_CONTAINER") {
        console.warn("[DROP] loot container def fallback", {
          preferred: "LOOT_CONTAINER",
          fallback: code,
          containerDefId: containerDef.id,
          slotCount: containerDef.slot_count,
        });
      }

      return containerDef;
    }
  }

  return null;
}

async function dropInventoryItemToGround(userIdRaw, itemInstanceIdRaw, opts = {}) {
  const userId = Number(userIdRaw);
  const itemInstanceId = Number(itemInstanceIdRaw);

  console.log("[DROP] service:start", {
    userId,
    itemInstanceId,
    hasRuntime: !!opts.runtime,
    hasInventory: !!opts.invRt,
    hasEquipment: !!opts.eqRt,
  });

  if (!Number.isInteger(userId) || userId <= 0) {
    console.warn("[DROP] invalid userId", { userId, itemInstanceId });
    return { ok: false, code: "INVALID_USER_ID", message: "Invalid userId" };
  }

  if (!Number.isInteger(itemInstanceId) || itemInstanceId <= 0) {
    console.warn("[DROP] invalid itemInstanceId", { userId, itemInstanceId });
    return { ok: false, code: "INVALID_ITEM_INSTANCE", message: "Invalid itemInstanceId" };
  }

  const runtime = opts.runtime || getRuntime(userId);
  if (!runtime) {
    console.warn("[DROP] runtime missing", { userId, itemInstanceId });
    return { ok: false, code: "RUNTIME_NOT_LOADED", message: "Player runtime not loaded" };
  }

  const invRt = opts.invRt;
  if (!invRt) {
    console.warn("[DROP] inventory runtime missing", { userId, itemInstanceId });
    return { ok: false, code: "INVENTORY_NOT_LOADED", message: "Inventory runtime not loaded" };
  }

  if (invRt.heldState) {
    console.warn("[DROP] held state active", { userId, itemInstanceId });
    return { ok: false, code: "HELD_STATE_ACTIVE", message: "Finish or cancel the held item first" };
  }

  const itemInstance = invRt.itemInstanceById.get(String(itemInstanceId));
  const eqRt = opts.eqRt ?? null;

  console.log("[DROP] service:runtime", {
    userId,
    itemInstanceId,
    runtimePos: runtime.pos ?? null,
    runtimeInstanceId: runtime.instanceId ?? null,
    inventoryContainers: Array.isArray(invRt.containers) ? invRt.containers.length : null,
    equipmentSlots: eqRt?.slotDefs?.length ?? null,
    itemInstanceFoundInInventory: !!itemInstance,
  });

  const inventorySource = findInventorySourceSlot(invRt, itemInstanceId);
  const equipmentSource = inventorySource ? null : findEquipmentSourceSlot(eqRt, itemInstanceId);

  console.log("[DROP] service:source", {
    userId,
    itemInstanceId,
    inventoryFound: !!inventorySource,
    equipmentFound: !!equipmentSource,
    inventorySlotRole: inventorySource?.container?.slotRole ?? null,
    equipmentSlotCode: equipmentSource?.slotCode ?? null,
  });

  if (!inventorySource && !equipmentSource) {
    console.warn("[DROP] item not found in runtime sources", { userId, itemInstanceId });
    return { ok: false, code: "ITEM_NOT_FOUND", message: "Item not found in inventory or equipment" };
  }

  const effectiveItemInstance =
    itemInstance ||
    equipmentSource?.equipped?.itemInstance ||
    null;

  if (!effectiveItemInstance) {
    return { ok: false, code: "ITEM_INSTANCE_NOT_FOUND", message: "Item instance not found" };
  }

  const itemDef =
    invRt.itemDefById?.get?.(String(effectiveItemInstance.itemDefId)) ||
    eqRt?.itemDefsById?.get?.(String(effectiveItemInstance.itemDefId)) ||
    effectiveItemInstance.def ||
    null;
  const nowPos = runtime.pos || { x: 0, y: 0, z: 0 };
  const dropPos = {
    x: Math.round(toNum(nowPos.x, 0) + 1.5),
    y: Math.round(toNum(nowPos.y, 0)),
    z: Math.round(toNum(nowPos.z, 0)),
  };
  const sourceQty = Number(
    inventorySource?.slot?.qty ??
      equipmentSource?.qty ??
      (effectiveItemInstance ? 1 : 0)
  ) || 1;
  const visualHint = resolveDropVisualHint(itemDef, effectiveItemInstance);

    console.log("[DROP] service:resolved", {
      userId,
      itemInstanceId,
      itemDefId: effectiveItemInstance?.itemDefId ?? null,
      itemCode: itemDef?.code ?? null,
      itemName: itemDef?.name ?? itemDef?.code ?? null,
      sourceQty,
      dropPos,
      sourceKind: inventorySource ? "INVENTORY" : "EQUIPMENT",
  });

  const run = async (tx) => {
    console.log("[DROP] service:tx-start", {
      userId,
      itemInstanceId,
      hasTx: !!tx,
    });

    const lootContainerDef = await resolveLootContainerDef(tx);

    if (!lootContainerDef) {
      console.warn("[DROP] loot container def missing", { userId, itemInstanceId });
      return {
        ok: false,
        code: "LOOT_CONTAINER_DEF_MISSING",
        message: "Loot container def missing",
      };
    }

    console.log("[DROP] service:loot-def", {
      userId,
      itemInstanceId,
      lootContainerDefId: lootContainerDef.id,
      slotCount: lootContainerDef.slot_count,
    });

    const created = await createActorWithContainer({
      actorType: "GROUND_LOOT",
      instanceId: Number(runtime.instanceId),
      posX: dropPos.x,
      posY: dropPos.z,
      stateJson: {
        dropSource: inventorySource ? "inventory" : "equipment",
        userId,
        itemInstanceId,
        itemDefId: Number(effectiveItemInstance.itemDefId),
        itemCode: itemDef?.code ?? null,
        itemName: itemDef?.name ?? itemDef?.code ?? null,
        qty: sourceQty,
        visualHint,
        sourceKind: inventorySource ? "INVENTORY" : "EQUIPMENT",
      },
      status: "ACTIVE",
      containerDefId: Number(lootContainerDef.id),
      slotRole: "LOOT",
      transaction: tx,
    });

    console.log("[DROP] service:actor-created", {
      userId,
      itemInstanceId,
      actorId: created?.actor?.id ?? null,
      containerId: created?.container?.id ?? null,
      ownerId: created?.owner?.id ?? null,
    });

    const actorId = Number(created.actor.id);
    const containerId = Number(created.container.id);

    if (inventorySource) {
      const sourceContainer = inventorySource.container;
      const sourceSlot = inventorySource.slot;
      sourceSlot.itemInstanceId = null;
      sourceSlot.qty = 0;

      await db.GaContainerSlot.upsert(
        {
          container_id: sourceContainer.id,
          slot_index: Number(sourceSlot.slotIndex),
          item_instance_id: null,
          qty: 0,
        },
        { transaction: tx }
      );

      console.log("[DROP] service:inventory-source-cleared", {
        userId,
        itemInstanceId,
        containerId: sourceContainer.id,
        slotIndex: sourceSlot.slotIndex,
      });

      await db.GaContainer.increment(
        { rev: 1 },
        {
          where: { id: sourceContainer.id },
          transaction: tx,
        }
      );
    } else if (equipmentSource) {
      const equipped = equipmentSource.equipped;
      await db.GaEquippedItem.destroy({
        where: {
          owner_kind: "PLAYER",
          owner_id: userId,
          item_instance_id: itemInstanceId,
        },
        transaction: tx,
      });

      console.log("[DROP] service:equipment-source-cleared", {
        userId,
        itemInstanceId,
        slotCode: equipped.slotCode,
      });

      if (eqRt?.equipmentBySlotCode && equipped.slotCode) {
        eqRt.equipmentBySlotCode[equipped.slotCode] = null;
      }
    }

    const lootSlot = await findFirstEmptyLootSlot(containerId, tx);
    if (!lootSlot) {
      console.warn("[DROP] no empty loot slot available", {
        userId,
        itemInstanceId,
        containerId,
      });
      return {
        ok: false,
        code: "NO_LOOT_SLOT_AVAILABLE",
        message: "No empty loot slot available",
      };
    }

    console.log("[DROP] service:loot-slot-target", {
      userId,
      itemInstanceId,
      containerId,
      slotIndex: lootSlot.slot_index,
    });

    try {
      lootSlot.item_instance_id = itemInstanceId;
      lootSlot.qty = sourceQty;
      await lootSlot.save({ transaction: tx });
    } catch (err) {
      console.error("[DROP] loot-slot-save failed", {
        userId,
        itemInstanceId,
        containerId,
        slotIndex: lootSlot?.slot_index ?? null,
        qty: sourceQty,
        errorName: err?.name ?? null,
        errorMessage: err?.message ?? null,
        validationErrors: Array.isArray(err?.errors)
          ? err.errors.map((e) => ({
              message: e?.message ?? null,
              path: e?.path ?? null,
              value: e?.value ?? null,
              type: e?.type ?? null,
            }))
          : null,
        parentCode: err?.parent?.code ?? null,
        parentMessage: err?.parent?.message ?? null,
      });
      throw err;
    }

    console.log("[DROP] service:loot-slot-created", {
      userId,
      itemInstanceId,
      containerId,
      slotIndex: lootSlot.slot_index,
      qty: sourceQty,
    });

    await db.GaContainer.increment(
      { rev: 1 },
      {
        where: { id: containerId },
        transaction: tx,
      }
    );

    console.log("[DROP] service:success", {
      userId,
      itemInstanceId,
      actorId,
      containerId,
      dropPos,
      sourceKind: inventorySource ? "INVENTORY" : "EQUIPMENT",
    });

    return {
      ok: true,
      actor: {
        id: actorId,
        actorType: "GROUND_LOOT",
        instanceId: Number(runtime.instanceId),
        pos: dropPos,
        status: "ACTIVE",
        state: {
          dropSource: inventorySource ? "inventory" : "equipment",
          userId,
          itemInstanceId,
          itemDefId: Number(effectiveItemInstance.itemDefId),
          itemCode: itemDef?.code ?? null,
          itemName: itemDef?.name ?? itemDef?.code ?? null,
          qty: sourceQty,
          visualHint,
          sourceKind: inventorySource ? "INVENTORY" : "EQUIPMENT",
        },
        containers: [
          {
            slotRole: "LOOT",
            containerId,
            containerDefId: Number(lootContainerDef.id),
            state: "ACTIVE",
            rev: 1,
          },
        ],
      },
      droppedItem: {
        itemInstanceId,
        qty: sourceQty,
      },
    };
  };

  if (opts.transaction) {
    console.log("[DROP] service:using-external-tx", { userId, itemInstanceId });
    return await run(opts.transaction);
  }

  console.log("[DROP] service:creating-own-tx", { userId, itemInstanceId });
  return await db.sequelize.transaction(async (tx) => run(tx));
}

module.exports = { dropInventoryItemToGround };
