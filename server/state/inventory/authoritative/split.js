"use strict";

const db = require("../../../models");
const { markDirty } = require("../store");
const { INV_ERR, invError } = require("../validate/errors");
const {
  assertNoHeldState,
  getItemDef,
  getItemInstance,
  getSlot,
  normalizeHeldState,
  persistSlot,
} = require("./helpers");

async function split(invRt, intent, tx) {
  assertNoHeldState(invRt);

  const containerId = intent?.containerId ?? intent?.from?.containerId ?? intent?.from?.container_id;
  const slotIndexRaw = intent?.slotIndex ?? intent?.from?.slotIndex ?? intent?.from?.slot;
  const slotIndex = Number(slotIndexRaw);
  const qty = Number(intent?.qty);

  if (!Number.isInteger(qty) || qty <= 0) {
    throw invError(INV_ERR.INVALID_QTY, "qty must be positive int", { qty });
  }

  const { container, slot } = getSlot(invRt, containerId, slotIndex);
  const sourceInstanceId = slot.itemInstanceId;
  if (!sourceInstanceId) throw invError(INV_ERR.EMPTY_SOURCE);

  const sourceInstance = getItemInstance(invRt, sourceInstanceId);
  if (!sourceInstance) {
    throw invError(INV_ERR.ITEM_INSTANCE_NOT_FOUND, "source item instance not loaded");
  }

  const itemDef = getItemDef(invRt, sourceInstance.itemDefId);
  const stackMax = Number(itemDef?.stackMax ?? 1);
  if (stackMax <= 1) throw invError(INV_ERR.NOT_STACKABLE, "item is not stackable");

  const sourceQty = Number(slot.qty ?? 0);
  if (sourceQty <= 1) throw invError(INV_ERR.INVALID_QTY, "cannot split qty<2");
  if (qty >= sourceQty) throw invError(INV_ERR.INVALID_QTY, "split qty must be less than source qty");

  const created = await db.GaItemInstance.create(
    {
      owner_user_id: Number(invRt.userId),
      item_def_id: Number(sourceInstance.itemDefId),
      bind_state: sourceInstance.bindState || sourceInstance.bind_state || "NONE",
      durability: sourceInstance.durability ?? null,
      props_json: sourceInstance.props ?? sourceInstance.props_json ?? null,
    },
    { transaction: tx }
  );

  const newItemInstanceId = String(created.id);
  const newInstance = {
    id: newItemInstanceId,
    userId: String(invRt.userId),
    itemDefId: String(sourceInstance.itemDefId),
    props: sourceInstance.props ?? sourceInstance.props_json ?? null,
    durability: sourceInstance.durability ?? null,
  };
  invRt.itemInstanceById.set(newItemInstanceId, newInstance);

  slot.qty = sourceQty - qty;
  const heldState = normalizeHeldState({
    mode: "SPLIT",
    sourceContainerId: container.id,
    sourceSlotIndex: slotIndex,
    sourceItemInstanceId: sourceInstanceId,
    sourceQtyBefore: sourceQty,
    sourceQtyAfter: slot.qty,
    itemInstanceId: newItemInstanceId,
    itemDefId: sourceInstance.itemDefId,
    qty,
    createdAtMs: Date.now(),
  });

  invRt.heldState = heldState;
  container.rev = Number(container.rev ?? 0) + 1;

  await persistSlot(tx, container.id, slotIndex, sourceInstanceId, slot.qty);
  await db.GaContainer.increment({ rev: 1 }, { where: { id: container.id }, transaction: tx });
  markDirty(invRt.userId, container.id);

  return {
    needsNewInstance: {
      placeholder: "__NEW__",
      fromInstanceId: sourceInstanceId,
    },
    touchedContainers: [container.id],
    touchedSlots: [
      { containerId: container.id, slotIndex, slot },
    ],
    heldState,
    newItemInstanceId,
  };
}

module.exports = {
  split,
};
