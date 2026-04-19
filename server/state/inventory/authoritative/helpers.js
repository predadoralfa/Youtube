"use strict";

const db = require("../../../models");
const { INV_ERR, invError } = require("../validate/errors");
const { assertContainerActive, assertSlotIndex } = require("../validate/rules");

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getContainerById(invRt, containerId) {
  const key = String(containerId);
  return (
    invRt?.containersById?.get(key) ||
    invRt?.containersByRole?.get(key) ||
    null
  );
}

function getSlot(invRt, containerId, slotIndex) {
  const container = getContainerById(invRt, containerId);
  assertContainerActive(container);
  assertSlotIndex(container, slotIndex);
  return { container, slot: container.slots[slotIndex] };
}

function getItemInstance(invRt, itemInstanceId) {
  if (itemInstanceId == null) return null;
  return invRt?.itemInstanceById?.get(String(itemInstanceId)) || null;
}

function getItemDef(invRt, itemDefId) {
  if (itemDefId == null) return null;
  return invRt?.itemDefsById?.get(String(itemDefId)) || null;
}

function normalizeHeldState(heldState) {
  if (!heldState) return null;
  return {
    mode: heldState.mode ?? "PICK",
    sourceContainerId: String(heldState.sourceContainerId),
    sourceSlotIndex: Number(heldState.sourceSlotIndex),
    sourceItemInstanceId:
      heldState.sourceItemInstanceId != null ? String(heldState.sourceItemInstanceId) : null,
    sourceQtyBefore: Number(heldState.sourceQtyBefore ?? 0),
    sourceQtyAfter: Number(heldState.sourceQtyAfter ?? 0),
    itemInstanceId: String(heldState.itemInstanceId),
    itemDefId: String(heldState.itemDefId),
    qty: Number(heldState.qty ?? 0),
    createdAtMs: heldState.createdAtMs ?? Date.now(),
  };
}

function assertNoHeldState(invRt) {
  if (invRt?.heldState) {
    throw invError(INV_ERR.HELD_STATE_ACTIVE, "held state already active");
  }
}

function assertHeldState(invRt) {
  if (!invRt?.heldState) {
    throw invError(INV_ERR.NO_HELD_STATE, "no held state active");
  }
  return normalizeHeldState(invRt.heldState);
}

function assertSourceStillMatches(invRt, heldState) {
  const { container, slot } = getSlot(invRt, heldState.sourceContainerId, heldState.sourceSlotIndex);

  if (heldState.mode === "PICK") {
    if (slot.itemInstanceId != null || Number(slot.qty ?? 0) !== 0) {
      throw invError(INV_ERR.CONCURRENT_STATE_CHANGED, "source slot changed while item was held");
    }
  } else if (heldState.mode === "SPLIT") {
    if (String(slot.itemInstanceId ?? "") !== String(heldState.sourceItemInstanceId ?? "")) {
      throw invError(INV_ERR.CONCURRENT_STATE_CHANGED, "split source instance changed");
    }

    const expectedQty = Number(heldState.sourceQtyAfter ?? 0);
    if (Number(slot.qty ?? 0) !== expectedQty) {
      throw invError(INV_ERR.CONCURRENT_STATE_CHANGED, "split source quantity changed");
    }
  }

  return { container, slot };
}

async function persistSlot(tx, containerId, slotIndex, itemInstanceId, qty) {
  await db.GaContainerSlot.upsert(
    {
      container_id: Number(containerId),
      slot_index: Number(slotIndex),
      item_instance_id: itemInstanceId != null ? Number(itemInstanceId) : null,
      qty: Number(qty ?? 0),
    },
    { transaction: tx }
  );
}

async function loadHeldInstanceForCreate(invRt, sourceItemInstanceId, tx) {
  const srcII = getItemInstance(invRt, sourceItemInstanceId);
  if (!srcII) {
    throw invError(INV_ERR.ITEM_INSTANCE_NOT_FOUND, "source item instance not found");
  }

  const created = await db.GaItemInstance.create(
    {
      owner_user_id: Number(invRt.userId),
      item_def_id: Number(srcII.itemDefId),
      bind_state: srcII.bindState || srcII.bind_state || "NONE",
      durability: srcII.durability ?? null,
      props_json: srcII.props ?? srcII.props_json ?? null,
    },
    { transaction: tx }
  );

  const newInstance = {
    id: String(created.id),
    userId: String(invRt.userId),
    itemDefId: String(srcII.itemDefId),
    props: srcII.props ?? srcII.props_json ?? null,
    durability: srcII.durability ?? null,
  };

  invRt.itemInstanceById.set(String(newInstance.id), newInstance);
  return newInstance;
}

module.exports = {
  toNum,
  getContainerById,
  getSlot,
  getItemInstance,
  getItemDef,
  normalizeHeldState,
  assertNoHeldState,
  assertHeldState,
  assertSourceStillMatches,
  persistSlot,
  loadHeldInstanceForCreate,
};
