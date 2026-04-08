"use strict";

const db = require("../../../models");
const { markDirty } = require("../store");
const { INV_ERR, invError } = require("../validate/errors");
const { assertHeldState, assertSourceStillMatches } = require("./helpers");

async function cancel(invRt, tx) {
  const heldState = assertHeldState(invRt);
  const { container, slot } = assertSourceStillMatches(invRt, heldState);

  if (heldState.mode === "PICK") {
    slot.itemInstanceId = heldState.itemInstanceId;
    slot.qty = heldState.sourceQtyBefore;
    invRt.heldState = null;

    await db.GaContainerSlot.upsert(
      {
        container_id: Number(container.id),
        slot_index: Number(heldState.sourceSlotIndex),
        item_instance_id: slot.itemInstanceId,
        qty: slot.qty,
      },
      { transaction: tx }
    );
    await db.GaContainer.increment({ rev: 1 }, { where: { id: container.id }, transaction: tx });
    markDirty(invRt.userId, container.id);

    return {
      touchedContainers: [container.id],
      touchedSlots: [
        {
          containerId: container.id,
          slotIndex: heldState.sourceSlotIndex,
          slot,
        },
      ],
      heldState: null,
    };
  }

  if (heldState.mode === "SPLIT") {
    const heldInstanceId = heldState.itemInstanceId;
    const heldQty = Number(heldState.qty ?? 0);
    slot.qty = Number(heldState.sourceQtyBefore ?? 0);
    invRt.heldState = null;
    invRt.itemInstanceById.delete(String(heldInstanceId));
    container.rev = Number(container.rev ?? 0) + 1;

    await db.GaItemInstance.destroy({
      where: { id: Number(heldInstanceId) },
      transaction: tx,
    });

    await db.GaContainerSlot.upsert(
      {
        container_id: Number(container.id),
        slot_index: Number(heldState.sourceSlotIndex),
        item_instance_id: slot.itemInstanceId,
        qty: slot.qty,
      },
      { transaction: tx }
    );
    await db.GaContainer.increment({ rev: 1 }, { where: { id: container.id }, transaction: tx });
    markDirty(invRt.userId, container.id);

    return {
      touchedContainers: [container.id],
      touchedSlots: [
        {
          containerId: container.id,
          slotIndex: heldState.sourceSlotIndex,
          slot,
        },
      ],
      heldState: null,
      revertedQty: heldQty,
    };
  }

  throw invError(INV_ERR.NO_HELD_STATE, "unsupported held mode");
}

module.exports = {
  cancel,
};
