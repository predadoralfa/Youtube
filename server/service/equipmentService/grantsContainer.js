"use strict";

const db = require("../../models");

const GRANTS_CONTAINER_COMPONENT = "GRANTS_CONTAINER";

function normalizeKeyPart(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function getItemCode(itemDef) {
  return normalizeKeyPart(itemDef?.code ?? "");
}

function getGrantedContainerSlotRole(itemDef, slotCode) {
  return `GRANTED:${getItemCode(itemDef)}:${normalizeKeyPart(slotCode)}`;
}

function pickGrantsContainerComponent(itemDef) {
  const components = Array.isArray(itemDef?.components) ? itemDef.components : [];
  return (
    components.find(
      (component) =>
        component?.component_type === GRANTS_CONTAINER_COMPONENT ||
        component?.componentType === GRANTS_CONTAINER_COMPONENT
    ) ?? null
  );
}

function resolveContainerDefCode(itemDef, component) {
  const data = component?.data_json ?? component?.dataJson ?? null;
  const fromComponent = data?.containerDefCode ?? data?.container_def_code ?? null;
  return String(fromComponent ?? itemDef?.code ?? "").trim();
}

async function loadContainerDefByCode(containerCode, tx) {
  if (!containerCode) return null;
  return db.GaContainerDef.findOne({
    where: { code: String(containerCode), is_active: true },
    transaction: tx,
    lock: tx ? tx.LOCK.UPDATE : undefined,
  });
}

async function ensureGrantedContainerForItem({ playerId, slotCode, itemDef, tx }) {
  const component = pickGrantsContainerComponent(itemDef);
  if (!component) return { changed: false, container: null, owner: null };

  const containerCode = resolveContainerDefCode(itemDef, component);
  const containerDef = await loadContainerDefByCode(containerCode, tx);
  if (!containerDef) {
    throw Object.assign(new Error(`GRANTED_CONTAINER_DEF_NOT_FOUND:${containerCode}`), {
      code: "GRANTED_CONTAINER_DEF_NOT_FOUND",
    });
  }

  const role = getGrantedContainerSlotRole(itemDef, slotCode);
  let created = false;
  const now = new Date();
  let owner = await db.GaContainerOwner.findOne({
    where: {
      owner_kind: "PLAYER",
      owner_id: String(playerId),
      slot_role: role,
    },
    transaction: tx,
    lock: tx ? tx.LOCK.UPDATE : undefined,
  });

  let container = null;
  if (!owner) {
    created = true;
    container = await db.GaContainer.create(
      {
        container_def_id: Number(containerDef.id),
        slot_role: role,
        state: "ACTIVE",
        rev: 1,
        created_at: now,
        updated_at: now,
      },
      { transaction: tx }
    );

    owner = await db.GaContainerOwner.create(
      {
        container_id: container.id,
        owner_kind: "PLAYER",
        owner_id: String(playerId),
        slot_role: role,
      },
      { transaction: tx }
    );
  } else {
    container = await db.GaContainer.findByPk(owner.container_id, {
      transaction: tx,
      lock: tx ? tx.LOCK.UPDATE : undefined,
    });

    if (!container) {
      throw Object.assign(new Error(`GRANTED_CONTAINER_NOT_FOUND:${role}`), {
        code: "GRANTED_CONTAINER_NOT_FOUND",
      });
    }

    if (Number(container.container_def_id) !== Number(containerDef.id)) {
      await container.update(
        {
          container_def_id: Number(containerDef.id),
          slot_role: role,
          state: "ACTIVE",
        },
        { transaction: tx }
      );
    }
  }

  const slotCount = Math.max(0, Number(containerDef.slot_count ?? 0));
  for (let i = 0; i < slotCount; i++) {
    await db.GaContainerSlot.findOrCreate({
      where: { container_id: container.id, slot_index: i },
      defaults: {
        container_id: container.id,
        slot_index: i,
        item_instance_id: null,
        qty: 0,
      },
      transaction: tx,
    });
  }

  return { changed: true, created, container, owner };
}

async function removeGrantedContainerForItem({
  playerId,
  slotCode,
  itemDef,
  tx,
  destinationContainerId = null,
}) {
  const component = pickGrantsContainerComponent(itemDef);
  if (!component) return { changed: false, removed: false };

  const role = getGrantedContainerSlotRole(itemDef, slotCode);
  const owner = await db.GaContainerOwner.findOne({
    where: {
      owner_kind: "PLAYER",
      owner_id: String(playerId),
      slot_role: role,
    },
    transaction: tx,
    lock: tx ? tx.LOCK.UPDATE : undefined,
  });

  if (!owner) return { changed: false, removed: false };

  const container = await db.GaContainer.findByPk(owner.container_id, {
    transaction: tx,
    lock: tx ? tx.LOCK.UPDATE : undefined,
  });
  if (!container) {
    await owner.destroy({ transaction: tx });
    return { changed: true, removed: true };
  }

  const slots = await db.GaContainerSlot.findAll({
    where: { container_id: container.id },
    transaction: tx,
    lock: tx ? tx.LOCK.UPDATE : undefined,
  });

  const hasItems = slots.some((slot) => Number(slot.qty ?? 0) > 0 || slot.item_instance_id != null);

  if (hasItems && destinationContainerId == null) {
    throw Object.assign(new Error(`GRANTED_CONTAINER_NOT_EMPTY:${role}`), {
      code: "GRANTED_CONTAINER_NOT_EMPTY",
    });
  }

  const movedSlots = [];
  if (hasItems && destinationContainerId != null) {
    const destination = await db.GaContainer.findByPk(destinationContainerId, {
      transaction: tx,
      lock: tx ? tx.LOCK.UPDATE : undefined,
    });
    if (!destination) {
      throw Object.assign(new Error(`GRANTED_CONTAINER_DESTINATION_NOT_FOUND:${destinationContainerId}`), {
        code: "GRANTED_CONTAINER_DESTINATION_NOT_FOUND",
      });
    }

    const destinationSlots = await db.GaContainerSlot.findAll({
      where: { container_id: destination.id },
      transaction: tx,
      lock: tx ? tx.LOCK.UPDATE : undefined,
      order: [["slot_index", "ASC"]],
    });

    const emptyDestinationSlots = destinationSlots.filter(
      (slot) => slot.item_instance_id == null || Number(slot.qty ?? 0) <= 0
    );
    const occupiedSourceSlots = slots.filter(
      (slot) => slot.item_instance_id != null && Number(slot.qty ?? 0) > 0
    );

    if (emptyDestinationSlots.length < occupiedSourceSlots.length) {
      throw Object.assign(new Error(`GRANTED_CONTAINER_DESTINATION_FULL:${destinationContainerId}`), {
        code: "GRANTED_CONTAINER_DESTINATION_FULL",
      });
    }

    for (let i = 0; i < occupiedSourceSlots.length; i++) {
      const srcSlot = occupiedSourceSlots[i];
      const dstSlot = emptyDestinationSlots[i];

      await db.GaContainerSlot.update(
        {
          item_instance_id: srcSlot.item_instance_id,
          qty: Number(srcSlot.qty ?? 0),
        },
        {
          where: {
            container_id: destination.id,
            slot_index: dstSlot.slot_index,
          },
          transaction: tx,
        }
      );

      await db.GaContainerSlot.update(
        {
          item_instance_id: null,
          qty: 0,
        },
        {
          where: {
            container_id: container.id,
            slot_index: srcSlot.slot_index,
          },
          transaction: tx,
        }
      );

      movedSlots.push({
        fromSlotIndex: Number(srcSlot.slot_index),
        toContainerId: String(destination.id),
        toSlotIndex: Number(dstSlot.slot_index),
        itemInstanceId: String(srcSlot.item_instance_id),
        qty: Number(srcSlot.qty ?? 0),
      });
    }
  }

  await container.destroy({ transaction: tx });
  await owner.destroy({ transaction: tx });
  return { changed: true, removed: true, movedSlots };
}

module.exports = {
  ensureGrantedContainerForItem,
  removeGrantedContainerForItem,
  getGrantedContainerSlotRole,
};
