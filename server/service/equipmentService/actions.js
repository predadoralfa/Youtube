"use strict";

const db = require("../../models");
const { ensureInventoryLoaded } = require("../../state/inventory/loader");
const { withEquipmentLock } = require("../../state/equipment/store");
const { isItemAllowedInSlot } = require("./shared");
const {
  ensureGrantedContainerForItem,
  removeGrantedContainerForItem,
  getGrantedContainerSlotRole,
} = require("./grantsContainer");
const {
  loadItemForEquip,
  loadSlotDefByCode,
  loadEquippedRow,
  loadEquippedByItemInstance,
} = require("./queries");
const { rebuildEquipmentPayload } = require("./refresh");

function hasGrantedContainerComponent(itemDef) {
  const components = Array.isArray(itemDef?.components) ? itemDef.components : [];
  return components.some((component) => {
    const type = String(component?.component_type ?? component?.componentType ?? "").toUpperCase();
    return type === "GRANTS_CONTAINER";
  });
}

function grantedContainerIsEmpty(invRt, itemDef, slotCode) {
  if (!itemDef || !slotCode || !hasGrantedContainerComponent(itemDef)) return true;
  const role = getGrantedContainerSlotRole(itemDef, slotCode);
  const container = invRt?.containersByRole?.get?.(role) ?? null;
  if (!container) return true;
  return !Array.isArray(container.slots)
    ? true
    : !container.slots.some((slot) => Number(slot?.qty ?? 0) > 0 || slot?.itemInstanceId != null);
}

async function equipItemToSlot(playerIdRaw, itemInstanceIdRaw, slotCode) {
  const playerId = String(playerIdRaw);
  const itemInstanceId = String(itemInstanceIdRaw);
  const targetSlotCode = String(slotCode);

  return withEquipmentLock(playerId, async () => {
    const tx = await db.sequelize.transaction();
    try {
      const slotDef = await loadSlotDefByCode(targetSlotCode, tx);
      if (!slotDef) {
        throw new Error("EQUIPMENT_SLOT_NOT_FOUND");
      }

      const itemInstance = await loadItemForEquip(itemInstanceId, tx);
      if (!itemInstance) {
        throw new Error("ITEM_INSTANCE_NOT_FOUND");
      }

      if (String(itemInstance.owner_user_id) !== playerId) {
        throw new Error("NOT_ITEM_OWNER");
      }

      const itemDef = itemInstance.def ?? null;
      if (!itemDef) {
        throw new Error("ITEM_DEF_NOT_FOUND");
      }

      if (!isItemAllowedInSlot(itemDef, targetSlotCode)) {
        throw new Error("ITEM_NOT_EQUIPPABLE");
      }

      const existingSlotRow = await loadEquippedRow(playerId, slotDef.id, tx);
      if (existingSlotRow) {
        throw new Error("SLOT_ALREADY_OCCUPIED");
      }

      const existingItemRow = await loadEquippedByItemInstance(itemInstanceId, tx);
      if (existingItemRow) {
        throw new Error("ITEM_ALREADY_EQUIPPED");
      }

      await db.GaEquippedItem.create(
        {
          owner_kind: "PLAYER",
          owner_id: playerId,
          slot_def_id: slotDef.id,
          item_instance_id: itemInstance.id,
        },
        { transaction: tx }
      );

      await ensureGrantedContainerForItem({
        playerId,
        slotCode: targetSlotCode,
        itemDef,
        tx,
      });

      await tx.commit();
      return rebuildEquipmentPayload(playerId);
    } catch (error) {
      await tx.rollback().catch(() => {});
      return {
        ok: false,
        code: error.message || "EQUIP_ERR",
        message: error.message || "EQUIP_ERR",
      };
    }
  });
}

async function swapEquipmentSlots(playerIdRaw, fromSlotCode, toSlotCode) {
  const playerId = String(playerIdRaw);
  const sourceSlotCode = String(fromSlotCode);
  const targetSlotCode = String(toSlotCode);

  return withEquipmentLock(playerId, async () => {
    const tx = await db.sequelize.transaction();
    try {
      if (!sourceSlotCode || !targetSlotCode || sourceSlotCode === targetSlotCode) {
        throw new Error("EQUIPMENT_SLOT_INVALID");
      }

      const sourceSlotDef = await loadSlotDefByCode(sourceSlotCode, tx);
      const targetSlotDef = await loadSlotDefByCode(targetSlotCode, tx);
      if (!sourceSlotDef || !targetSlotDef) {
        throw new Error("EQUIPMENT_SLOT_NOT_FOUND");
      }

      const sourceRow = await loadEquippedRow(playerId, sourceSlotDef.id, tx);
      if (!sourceRow) {
        throw new Error("SOURCE_SLOT_EMPTY");
      }

      const targetRow = await loadEquippedRow(playerId, targetSlotDef.id, tx);
      const sourceItem = await loadItemForEquip(sourceRow.item_instance_id, tx);
      if (!sourceItem) {
        throw new Error("SOURCE_ITEM_NOT_FOUND");
      }

      const invRt = await ensureInventoryLoaded(playerId);
      if (!grantedContainerIsEmpty(invRt, sourceItem.def, sourceSlotCode)) {
        throw new Error("GRANTED_CONTAINER_NOT_EMPTY");
      }

      if (!isItemAllowedInSlot(sourceItem.def, targetSlotCode)) {
        throw new Error("TARGET_SLOT_NOT_ALLOWED");
      }

      let targetItem = null;
      if (targetRow) {
        targetItem = await loadItemForEquip(targetRow.item_instance_id, tx);
        if (!targetItem) {
          throw new Error("TARGET_ITEM_NOT_FOUND");
        }

        if (!isItemAllowedInSlot(targetItem.def, sourceSlotCode)) {
          throw new Error("SOURCE_SLOT_NOT_ALLOWED");
        }
      }

      if (targetItem?.def && !grantedContainerIsEmpty(invRt, targetItem.def, targetSlotCode)) {
        throw new Error("GRANTED_CONTAINER_NOT_EMPTY");
      }

      if (sourceItem?.def) {
        await removeGrantedContainerForItem({
          playerId,
          slotCode: sourceSlotCode,
          itemDef: sourceItem.def,
          tx,
        });
      }

      if (targetItem?.def) {
        await removeGrantedContainerForItem({
          playerId,
          slotCode: targetSlotCode,
          itemDef: targetItem.def,
          tx,
        });
      }

      await sourceRow.destroy({ transaction: tx });
      if (targetRow) {
        await targetRow.destroy({ transaction: tx });
      }

      await db.GaEquippedItem.create(
        {
          owner_kind: "PLAYER",
          owner_id: playerId,
          slot_def_id: targetSlotDef.id,
          item_instance_id: sourceRow.item_instance_id,
        },
        { transaction: tx }
      );

      if (targetRow) {
        await db.GaEquippedItem.create(
          {
            owner_kind: "PLAYER",
            owner_id: playerId,
            slot_def_id: sourceSlotDef.id,
            item_instance_id: targetRow.item_instance_id,
          },
          { transaction: tx }
        );
      }

      await ensureGrantedContainerForItem({
        playerId,
        slotCode: targetSlotCode,
        itemDef: sourceItem.def,
        tx,
      });

      if (targetItem?.def) {
        await ensureGrantedContainerForItem({
          playerId,
          slotCode: sourceSlotCode,
          itemDef: targetItem.def,
          tx,
        });
      }

      await tx.commit();
      return rebuildEquipmentPayload(playerId);
    } catch (error) {
      await tx.rollback().catch(() => {});
      return {
        ok: false,
        code: error.message || "SWAP_EQUIP_ERR",
        message: error.message || "SWAP_EQUIP_ERR",
      };
    }
  });
}

async function unequipItemFromSlot(playerIdRaw, slotCode) {
  const playerId = String(playerIdRaw);
  const targetSlotCode = String(slotCode);

  return withEquipmentLock(playerId, async () => {
    const tx = await db.sequelize.transaction();
    try {
      const slotDef = await loadSlotDefByCode(targetSlotCode, tx);
      if (!slotDef) {
        throw new Error("EQUIPMENT_SLOT_NOT_FOUND");
      }

      const row = await loadEquippedRow(playerId, slotDef.id, tx);
      if (!row) {
        throw new Error("SLOT_ALREADY_EMPTY");
      }

      const equippedItem = await loadItemForEquip(row.item_instance_id, tx);
      const invRt = await ensureInventoryLoaded(playerId);
      if (!grantedContainerIsEmpty(invRt, equippedItem?.def, targetSlotCode)) {
        throw new Error("GRANTED_CONTAINER_NOT_EMPTY");
      }
      if (equippedItem?.def) {
        await removeGrantedContainerForItem({
          playerId,
          slotCode: targetSlotCode,
          itemDef: equippedItem.def,
          tx,
        });
      }

      await row.destroy({ transaction: tx });
      await tx.commit();
      return rebuildEquipmentPayload(playerId);
    } catch (error) {
      await tx.rollback().catch(() => {});
      return {
        ok: false,
        code: error.message || "UNEQUIP_ERR",
        message: error.message || "UNEQUIP_ERR",
      };
    }
  });
}

module.exports = {
  equipItemToSlot,
  swapEquipmentSlots,
  unequipItemFromSlot,
};
