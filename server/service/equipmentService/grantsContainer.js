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
    container = await db.GaContainer.create(
      {
        container_def_id: Number(containerDef.id),
        slot_role: role,
        state: "ACTIVE",
        rev: 1,
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

  return { changed: true, container, owner };
}

async function removeGrantedContainerForItem({ playerId, slotCode, itemDef, tx }) {
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
  if (hasItems) {
    throw Object.assign(new Error(`GRANTED_CONTAINER_NOT_EMPTY:${role}`), {
      code: "GRANTED_CONTAINER_NOT_EMPTY",
    });
  }

  await container.destroy({ transaction: tx });
  return { changed: true, removed: true };
}

module.exports = {
  ensureGrantedContainerForItem,
  removeGrantedContainerForItem,
  getGrantedContainerSlotRole,
};
