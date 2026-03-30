"use strict";

const db = require("../models");
const { withEquipmentLock, clearEquipment } = require("../state/equipment/store");
const { ensureEquipmentLoaded } = require("../state/equipment/loader");
const { buildEquipmentFull } = require("../state/equipment/fullPayload");

const EQUIPPABLE_COMPONENT = "EQUIPPABLE";

function normalizeAllowedSlots(componentData) {
  const allowedSlots = componentData?.allowedSlots;
  if (!Array.isArray(allowedSlots)) return [];
  return allowedSlots.map((slot) => String(slot)).filter(Boolean);
}

function pickEquippableComponent(itemDef) {
  const components = Array.isArray(itemDef?.components) ? itemDef.components : [];
  return components.find((component) => component.component_type === EQUIPPABLE_COMPONENT || component.componentType === EQUIPPABLE_COMPONENT) || null;
}

function extractEquipData(component) {
  const data = component?.data_json ?? component?.dataJson ?? null;
  return data && typeof data === "object" ? data : null;
}

function isItemAllowedInSlot(itemDef, slotCode) {
  const equippable = pickEquippableComponent(itemDef);
  if (!equippable) return false;

  const data = extractEquipData(equippable);
  const allowedSlots = normalizeAllowedSlots(data);
  return allowedSlots.includes(String(slotCode));
}

async function loadItemForEquip(itemInstanceId, tx) {
  return db.GaItemInstance.findByPk(itemInstanceId, {
    transaction: tx,
    include: [
      {
        model: db.GaItemDef,
        as: "def",
        include: [
          {
            model: db.GaItemDefComponent,
            as: "components",
          },
        ],
      },
    ],
    lock: tx.LOCK.UPDATE,
  });
}

async function loadSlotDefByCode(slotCode, tx) {
  return db.GaEquipmentSlotDef.findOne({
    where: {
      code: String(slotCode),
      is_active: true,
    },
    transaction: tx,
    lock: tx.LOCK.UPDATE,
  });
}

async function loadEquippedRow(playerId, slotDefId, tx) {
  return db.GaEquippedItem.findOne({
    where: {
      owner_kind: "PLAYER",
      owner_id: playerId,
      slot_def_id: slotDefId,
    },
    transaction: tx,
    lock: tx.LOCK.UPDATE,
  });
}

async function loadEquippedByItemInstance(itemInstanceId, tx) {
  return db.GaEquippedItem.findOne({
    where: {
      item_instance_id: itemInstanceId,
    },
    transaction: tx,
    lock: tx.LOCK.UPDATE,
  });
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

      await tx.commit();

      clearEquipment(playerId);
      const eqRt = await ensureEquipmentLoaded(playerId);
      return {
        ok: true,
        equipment: buildEquipmentFull(eqRt),
      };
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

      await tx.commit();

      clearEquipment(playerId);
      const eqRt = await ensureEquipmentLoaded(playerId);
      return {
        ok: true,
        equipment: buildEquipmentFull(eqRt),
      };
    } catch (error) {
      await tx.rollback().catch(() => {});
      return {
        ok: false,
        code: error.message || "EQUIP_SWAP_ERR",
        message: error.message || "EQUIP_SWAP_ERR",
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

      const equippedRow = await loadEquippedRow(playerId, slotDef.id, tx);
      if (!equippedRow) {
        throw new Error("SLOT_EMPTY");
      }

      await equippedRow.destroy({ transaction: tx });
      await tx.commit();

      clearEquipment(playerId);
      const eqRt = await ensureEquipmentLoaded(playerId);
      return {
        ok: true,
        equipment: buildEquipmentFull(eqRt),
      };
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
