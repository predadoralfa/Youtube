"use strict";

const db = require("../../models");
const { getRuntime } = require("../../state/runtimeStore");
const { createActorWithContainer, resolveActorDef } = require("../actorService");
const { toNum, resolveDropVisualHint } = require("./shared");
const { findInventorySourceSlot, findEquipmentSourceSlot } = require("./sources");
const { findFirstEmptyLootSlot, resolveLootContainerDef } = require("./containers");

async function dropInventoryItemToGround(userIdRaw, itemInstanceIdRaw, opts = {}) {
  const userId = Number(userIdRaw);
  const itemInstanceId = Number(itemInstanceIdRaw);

  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, code: "INVALID_USER_ID", message: "Invalid userId" };
  }

  if (!Number.isInteger(itemInstanceId) || itemInstanceId <= 0) {
    return { ok: false, code: "INVALID_ITEM_INSTANCE", message: "Invalid itemInstanceId" };
  }

  const runtime = opts.runtime || getRuntime(userId);
  if (!runtime) {
    return { ok: false, code: "RUNTIME_NOT_LOADED", message: "Player runtime not loaded" };
  }

  const invRt = opts.invRt;
  if (!invRt) {
    return { ok: false, code: "INVENTORY_NOT_LOADED", message: "Inventory runtime not loaded" };
  }

  if (invRt.heldState) {
    return { ok: false, code: "HELD_STATE_ACTIVE", message: "Finish or cancel the held item first" };
  }

  const itemInstance = invRt.itemInstanceById.get(String(itemInstanceId));
  const eqRt = opts.eqRt ?? null;
  const inventorySource = findInventorySourceSlot(invRt, itemInstanceId);
  const equipmentSource = inventorySource ? null : findEquipmentSourceSlot(eqRt, itemInstanceId);

  if (!inventorySource && !equipmentSource) {
    return { ok: false, code: "ITEM_NOT_FOUND", message: "Item not found in inventory or equipment" };
  }

  const effectiveItemInstance = itemInstance || equipmentSource?.equipped?.itemInstance || null;
  if (!effectiveItemInstance) {
    return { ok: false, code: "ITEM_INSTANCE_NOT_FOUND", message: "Item instance not found" };
  }

  const itemDef =
    invRt.itemDefsById?.get?.(String(effectiveItemInstance.itemDefId)) ||
    eqRt?.itemDefsById?.get?.(String(effectiveItemInstance.itemDefId)) ||
    effectiveItemInstance.def ||
    null;
  const nowPos = runtime.pos || { x: 0, y: 0, z: 0 };
  const dropPos = {
    x: Math.round(toNum(nowPos.x, 0) + 1.5),
    y: 0,
    z: Math.round(toNum(nowPos.z, 0)),
  };
  const sourceQty = Number(
    inventorySource?.slot?.qty ??
      equipmentSource?.qty ??
      (effectiveItemInstance ? 1 : 0)
  ) || 1;
  const visualHint = resolveDropVisualHint(itemDef, effectiveItemInstance);

  const run = async (tx) => {
    const actorDef = await resolveActorDef({ actorDefCode: "GROUND_LOOT" }, tx);
    const lootContainerDef = Number(actorDef?.default_container_def_id ?? 0) > 0
      ? await db.GaContainerDef.findByPk(Number(actorDef.default_container_def_id), { transaction: tx })
      : await resolveLootContainerDef(tx);

    if (!lootContainerDef) {
      return {
        ok: false,
        code: "LOOT_CONTAINER_DEF_MISSING",
        message: "Loot container def missing",
      };
    }

    const created = await createActorWithContainer({
      actorDefCode: "GROUND_LOOT",
      instanceId: Number(runtime.instanceId),
      posX: dropPos.x,
      posY: dropPos.y,
      posZ: dropPos.z,
      stateJson: {
        dropSource: inventorySource ? "inventory" : "equipment",
        userId,
        itemInstanceId,
        itemDefId: Number(effectiveItemInstance.itemDefId),
        itemCode: itemDef?.code ?? null,
        itemName: itemDef?.name ?? itemDef?.code ?? null,
        qty: sourceQty,
        sourceKind: inventorySource ? "INVENTORY" : "EQUIPMENT",
      },
      status: "ACTIVE",
      containerDefId: Number(lootContainerDef.id),
      slotRole: "LOOT",
      transaction: tx,
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

      if (eqRt?.equipmentBySlotCode && equipped.slotCode) {
        eqRt.equipmentBySlotCode[equipped.slotCode] = null;
      }
    }

    const lootSlot = await findFirstEmptyLootSlot(containerId, tx);
    if (!lootSlot) {
      return {
        ok: false,
        code: "NO_LOOT_SLOT_AVAILABLE",
        message: "No empty loot slot available",
      };
    }

    lootSlot.item_instance_id = itemInstanceId;
    lootSlot.qty = sourceQty;
    await lootSlot.save({ transaction: tx });

    await db.GaContainer.increment(
      { rev: 1 },
      {
        where: { id: containerId },
        transaction: tx,
      }
    );

    return {
      ok: true,
      actor: {
        id: actorId,
        actorType: "GROUND_LOOT",
        actorDefCode: "GROUND_LOOT",
        actorKind: "LOOT",
        displayName: actorDef?.name ?? "Ground Loot",
        visualHint,
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
    return await run(opts.transaction);
  }

  return await db.sequelize.transaction(async (tx) => run(tx));
}

module.exports = {
  dropInventoryItemToGround,
};
