"use strict";

const db = require("../../models");

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

module.exports = {
  loadItemForEquip,
  loadSlotDefByCode,
  loadEquippedRow,
  loadEquippedByItemInstance,
};
