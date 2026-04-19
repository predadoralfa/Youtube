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
const { getGrantedContainerSlotRole } = require("../../../service/equipmentService/grantsContainer");

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

  const sourceContainer = invRt?.containersById?.get(String(heldState.sourceContainerId)) ?? null;
  const sourceRole = sourceContainer?.slotRole ?? null;
  const ownGrantedRole =
    heldDef && sourceRole ? getGrantedContainerSlotRole(heldDef, sourceRole) : null;

  if (ownGrantedRole && String(container?.slotRole ?? "") === String(ownGrantedRole)) {
    throw invError(
      INV_ERR.INVALID_TARGET,
      "cannot place an item inside the container it grants",
      {
        itemDefId: heldState.itemDefId,
        sourceRole,
        targetRole: container?.slotRole ?? null,
      }
    );
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

  const dstQty = Number(slot.qty ?? 0);

  if (String(dstInstance.itemDefId) !== String(heldState.itemDefId)) {
    if (String(heldState.mode ?? "PICK").toUpperCase() === "PICK") {
      const sourceSlot = sourceContainer?.slots?.[Number(heldState.sourceSlotIndex)] ?? null;
      if (!sourceSlot) {
        throw invError(INV_ERR.INVALID_TARGET, "source slot not found for swap");
      }

      const previousDstId = slot.itemInstanceId;
      const previousDstQty = dstQty;

      await persistSlot(tx, container.id, slotIndex, null, 0);

      sourceSlot.itemInstanceId = previousDstId;
      sourceSlot.qty = previousDstQty;
      await persistSlot(
        tx,
        sourceContainer.id,
        Number(heldState.sourceSlotIndex),
        sourceSlot.itemInstanceId,
        sourceSlot.qty
      );

      slot.itemInstanceId = heldState.itemInstanceId;
      slot.qty = heldQty;
      invRt.heldState = null;
      const sameContainer = String(sourceContainer.id) === String(container.id);
      sourceContainer.rev = Number(sourceContainer.rev ?? 0) + 1;
      if (!sameContainer) {
        container.rev = Number(container.rev ?? 0) + 1;
      }

      await persistSlot(tx, container.id, slotIndex, slot.itemInstanceId, slot.qty);

      await db.GaContainer.increment({ rev: 1 }, { where: { id: sourceContainer.id }, transaction: tx });
      if (!sameContainer) {
        await db.GaContainer.increment({ rev: 1 }, { where: { id: container.id }, transaction: tx });
      }
      markDirty(invRt.userId, sourceContainer.id);
      markDirty(invRt.userId, container.id);

      return {
        touchedContainers: Array.from(new Set([sourceContainer.id, container.id])),
        touchedSlots: [
          {
            containerId: sourceContainer.id,
            slotIndex: Number(heldState.sourceSlotIndex),
            slot: sourceSlot,
          },
          {
            containerId: container.id,
            slotIndex,
            slot,
          },
        ],
        heldState: null,
      };
    }

    throw invError(INV_ERR.NOT_SAME_ITEM);
  }

  const stackMax = Number(heldDef?.stackMax ?? 1);
  if (stackMax <= 1) throw invError(INV_ERR.NOT_STACKABLE, "held item is not stackable");
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
