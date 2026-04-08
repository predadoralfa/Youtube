"use strict";

const db = require("../../models");

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
      return containerDef;
    }
  }

  return null;
}

module.exports = {
  findFirstEmptyLootSlot,
  resolveLootContainerDef,
};
