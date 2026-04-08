"use strict";

const db = require("../../../models");

async function loadOwnersForPlayer(userId) {
  const GaContainerOwner = db.GaContainerOwner;
  return GaContainerOwner.findAll({
    where: { owner_kind: "PLAYER", owner_id: userId },
    order: [
      ["container_id", "ASC"],
      ["slot_role", "ASC"],
    ],
  });
}

async function loadContainersByIds(containerIds) {
  if (!containerIds.length) return [];
  const GaContainer = db.GaContainer;

  return GaContainer.findAll({
    where: { id: containerIds },
    order: [["id", "ASC"]],
  });
}

async function loadContainerDefsByIds(defIds) {
  if (!defIds.length) return [];
  const GaContainerDef = db.GaContainerDef;

  return GaContainerDef.findAll({
    where: { id: defIds },
    order: [["id", "ASC"]],
  });
}

async function loadSlotsByContainerIds(containerIds) {
  if (!containerIds.length) return [];
  const GaContainerSlot = db.GaContainerSlot;

  return GaContainerSlot.findAll({
    where: { container_id: containerIds },
    order: [
      ["container_id", "ASC"],
      ["slot_index", "ASC"],
    ],
  });
}

async function loadItemInstances(itemInstanceIds) {
  if (!itemInstanceIds.length) return [];
  const GaItemInstance = db.GaItemInstance;

  return GaItemInstance.findAll({
    where: { id: itemInstanceIds },
    order: [["id", "ASC"]],
  });
}

async function loadItemDefs(itemDefIds) {
  if (!itemDefIds.length) return [];
  const GaItemDef = db.GaItemDef;

  return GaItemDef.findAll({
    where: { id: itemDefIds },
    order: [["id", "ASC"]],
  });
}

async function loadItemDefComponents(itemDefIds) {
  if (!itemDefIds.length) return [];
  const GaItemDefComponent = db.GaItemDefComponent;

  return GaItemDefComponent.findAll({
    where: { item_def_id: itemDefIds },
    order: [
      ["item_def_id", "ASC"],
      ["id", "ASC"],
    ],
  });
}

module.exports = {
  loadOwnersForPlayer,
  loadContainersByIds,
  loadContainerDefsByIds,
  loadSlotsByContainerIds,
  loadItemInstances,
  loadItemDefs,
  loadItemDefComponents,
};
