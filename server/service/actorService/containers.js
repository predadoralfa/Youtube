"use strict";

const db = require("../../models");

async function ensureActorContainer(params, tx) {
  const actorId = Number(params?.actorId);
  const slotRole = String(params?.slotRole || "LOOT").trim();
  const containerDefId = Number(params?.containerDefId);

  if (!Number.isInteger(actorId) || actorId <= 0) {
    throw new Error("ensureActorContainer: actorId invalid");
  }

  if (!Number.isInteger(containerDefId) || containerDefId <= 0) {
    throw new Error("ensureActorContainer: containerDefId invalid");
  }

  const existingOwner = await db.GaContainerOwner.findOne({
    where: {
      owner_kind: "ACTOR",
      owner_id: actorId,
      slot_role: slotRole,
    },
    include: {
      association: "container",
      required: false,
    },
    transaction: tx,
  });

  if (existingOwner?.container) {
    return {
      owner: existingOwner,
      container: existingOwner.container,
      created: false,
    };
  }

  const containerDef = await db.GaContainerDef.findByPk(containerDefId, { transaction: tx });
  if (!containerDef) {
    throw new Error(`ensureActorContainer: ga_container_def not found id=${containerDefId}`);
  }

  const slotCount = Number(containerDef.slot_count);
  if (!Number.isInteger(slotCount) || slotCount < 1) {
    throw new Error(`ensureActorContainer: invalid slot_count=${containerDef.slot_count} for def=${containerDefId}`);
  }

  const now = new Date();

  const container = await db.GaContainer.create(
    {
      container_def_id: containerDefId,
      slot_role: slotRole,
      state: "ACTIVE",
      rev: 1,
      created_at: now,
      updated_at: now,
    },
    { transaction: tx }
  );

  const owner = await db.GaContainerOwner.create(
    {
      container_id: container.id,
      owner_kind: "ACTOR",
      owner_id: actorId,
      slot_role: slotRole,
    },
    { transaction: tx }
  );

  const slots = Array.from({ length: slotCount }, (_, i) => ({
    container_id: container.id,
    slot_index: i,
    item_instance_id: null,
    qty: 0,
  }));

  await db.GaContainerSlot.bulkCreate(slots, { transaction: tx });

  return {
    owner,
    container,
    created: true,
  };
}

module.exports = {
  ensureActorContainer,
};
