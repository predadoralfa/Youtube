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

      const equippable = pickEquippableComponent(itemDef);
      if (!equippable) {
        throw new Error("ITEM_NOT_EQUIPPABLE");
      }

      const data = extractEquipData(equippable);
      const allowedSlots = normalizeAllowedSlots(data);
      if (!allowedSlots.includes(targetSlotCode)) {
        throw new Error("SLOT_NOT_ALLOWED");
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
  unequipItemFromSlot,
};
