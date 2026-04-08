"use strict";

const db = require("../../../models");
const { markDirty } = require("../store");
const { INV_ERR, invError } = require("../validate/errors");
const {
  assertHeldState,
  assertSourceStillMatches,
  getItemDef,
  getItemInstance,
  getSlot,
  persistSlot,
} = require("./helpers");

async function place(invRt, intent, tx) {
  const heldState = assertHeldState(invRt);
  assertSourceStillMatches(invRt, heldState);

  const containerId = intent?.containerId ?? intent?.to?.containerId ?? intent?.to?.container_id;
  const slotIndexRaw = intent?.slotIndex ?? intent?.to?.slotIndex ?? intent?.to?.slot;
  const slotIndex = Number(slotIndexRaw);

  const { container, slot } = getSlot(invRt, containerId, slotIndex);
  const heldInstance = getItemInstance(invRt, heldState.itemInstanceId);
  if (!heldInstance) {
    throw invError(INV_ERR.ITEM_INSTANCE_NOT_FOUND, "held item instance not loaded");
  }

  const heldDef = getItemDef(invRt, heldState.itemDefId);
  const heldQty = Number(heldState.qty ?? 0);
  if (!Number.isInteger(heldQty) || heldQty <= 0) {
    throw invError(INV_ERR.INVALID_QTY, "held qty invalid", { qty: heldQty });
  }

  if (!slot.itemInstanceId) {
    slot.itemInstanceId = heldState.itemInstanceId;
    slot.qty = heldQty;
    invRt.heldState = null;
    container.rev = Number(container.rev ?? 0) + 1;

    await persistSlot(tx, container.id, slotIndex, slot.itemInstanceId, slot.qty);
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
      heldState: null,
    };
  }

  const dstInstance = getItemInstance(invRt, slot.itemInstanceId);
  if (!dstInstance) {
    throw invError(INV_ERR.ITEM_INSTANCE_NOT_FOUND, "destination item instance not loaded");
  }

  if (String(dstInstance.itemDefId) !== String(heldState.itemDefId)) {
    throw invError(INV_ERR.NOT_SAME_ITEM);
  }

  const stackMax = Number(heldDef?.stackMax ?? 1);
  if (stackMax <= 1) throw invError(INV_ERR.NOT_STACKABLE, "held item is not stackable");

  const dstQty = Number(slot.qty ?? 0);
  if (dstQty + heldQty > stackMax) {
    throw invError(INV_ERR.STACK_OVERFLOW, "destination stack overflow", {
      dstQty,
      heldQty,
      stackMax,
    });
  }

  slot.qty = dstQty + heldQty;
  invRt.heldState = null;
  invRt.itemInstanceById.delete(String(heldState.itemInstanceId));
  container.rev = Number(container.rev ?? 0) + 1;
  await db.GaItemInstance.destroy({
    where: { id: Number(heldState.itemInstanceId) },
    transaction: tx,
  });

  await persistSlot(tx, container.id, slotIndex, slot.itemInstanceId, slot.qty);
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
    heldState: null,
  };
}

module.exports = {
  place,
};
