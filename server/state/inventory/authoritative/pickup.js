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

async function pickup(invRt, intent, tx) {
  assertNoHeldState(invRt);

  const containerId = intent?.containerId ?? intent?.from?.containerId ?? intent?.from?.container_id;
  const slotIndexRaw = intent?.slotIndex ?? intent?.from?.slotIndex ?? intent?.from?.slot;
  const slotIndex = Number(slotIndexRaw);

  const { container, slot } = getSlot(invRt, containerId, slotIndex);
  const itemInstanceId = slot.itemInstanceId;
  if (!itemInstanceId) throw invError(INV_ERR.EMPTY_SOURCE);

  const itemInstance = getItemInstance(invRt, itemInstanceId);
  if (!itemInstance) {
    throw invError(INV_ERR.ITEM_INSTANCE_NOT_FOUND, "source item instance not loaded");
  }

  const qty = Number(slot.qty ?? 0);
  if (!Number.isInteger(qty) || qty <= 0) {
    throw invError(INV_ERR.INVALID_QTY, "source qty invalid", { qty });
  }

  const itemDef = getItemDef(invRt, itemInstance.itemDefId);
  if (!itemDef) {
    throw invError(INV_ERR.ITEM_INSTANCE_NOT_FOUND, "item def not loaded");
  }

  const heldState = normalizeHeldState({
    mode: "PICK",
    sourceContainerId: container.id,
    sourceSlotIndex: slotIndex,
    sourceItemInstanceId: itemInstanceId,
    sourceQtyBefore: qty,
    sourceQtyAfter: 0,
    itemInstanceId,
    itemDefId: itemInstance.itemDefId,
    qty,
    createdAtMs: Date.now(),
  });

  slot.itemInstanceId = null;
  slot.qty = 0;
  invRt.heldState = heldState;
  container.rev = Number(container.rev ?? 0) + 1;

  await persistSlot(tx, container.id, slotIndex, null, 0);
  await db.GaContainer.increment({ rev: 1 }, { where: { id: container.id }, transaction: tx });
  markDirty(invRt.userId, container.id);

  return {
    touchedContainers: [container.id],
    touchedSlots: [
      {
        containerId: container.id,
        slotIndex,
        slot,
      },
    ],
    heldState,
  };
}

module.exports = {
  pickup,
};
