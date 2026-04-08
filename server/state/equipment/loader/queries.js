"use strict";

const db = require("../../../models");

async function loadSlotDefs() {
  return db.GaEquipmentSlotDef.findAll({
    where: { is_active: true },
    order: [["id", "ASC"]],
  });
}

async function loadEquippedItems(userId) {
  return db.GaEquippedItem.findAll({
    where: { owner_kind: "PLAYER", owner_id: userId },
    include: [
      {
        model: db.GaEquipmentSlotDef,
        as: "slotDef",
      },
      {
        model: db.GaItemInstance,
        as: "itemInstance",
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
      },
    ],
    order: [["slot_def_id", "ASC"]],
  });
}

module.exports = {
  loadSlotDefs,
  loadEquippedItems,
};
