"use strict";

const db = require("../../models");
const { markDirty } = require("./store");
const { INV_ERR, invError } = require("./validate/errors");
const { assertContainerActive, assertSlotIndex } = require("./validate/rules");

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getContainerById(invRt, containerId) {
  return invRt?.containersById?.get(String(containerId)) || null;
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

function logInvAuth(level, message, data) {
  const logger = level === "warn" ? console.warn : level === "error" ? console.error : console.log;
  logger(`[INV][AUTH] ${message}`, data || {});
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

  logInvAuth("log", "pickup ok", {
    userId: invRt.userId,
    containerId: container.id,
    slotIndex,
    itemInstanceId,
    qty,
    heldState,
  });

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

  logInvAuth("log", "split ok", {
    userId: invRt.userId,
    containerId: container.id,
    slotIndex,
    sourceInstanceId,
    sourceQty,
    splitQty: qty,
    heldState,
    newItemInstanceId,
  });

  await persistSlot(tx, container.id, slotIndex, sourceInstanceId, slot.qty);
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
    newItemInstanceId,
  };
}

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

    logInvAuth("log", "place ok empty-slot", {
      userId: invRt.userId,
      containerId: container.id,
      slotIndex,
      heldState,
    });

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

  logInvAuth("log", "place ok merge-stack", {
    userId: invRt.userId,
    containerId: container.id,
    slotIndex,
    heldState,
    dstQtyBefore: dstQty,
    heldQty,
    stackMax,
  });

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

async function cancel(invRt, tx) {
  const heldState = assertHeldState(invRt);
  const { container, slot } = assertSourceStillMatches(invRt, heldState);

  if (heldState.mode === "PICK") {
    slot.itemInstanceId = heldState.itemInstanceId;
    slot.qty = heldState.sourceQtyBefore;
    invRt.heldState = null;

    await persistSlot(tx, container.id, heldState.sourceSlotIndex, slot.itemInstanceId, slot.qty);
    await db.GaContainer.increment({ rev: 1 }, { where: { id: container.id }, transaction: tx });
    markDirty(invRt.userId, container.id);

    logInvAuth("log", "cancel ok pick", {
      userId: invRt.userId,
      containerId: container.id,
      slotIndex: heldState.sourceSlotIndex,
      heldState,
    });

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

    await persistSlot(tx, container.id, heldState.sourceSlotIndex, slot.itemInstanceId, slot.qty);
    await db.GaContainer.increment({ rev: 1 }, { where: { id: container.id }, transaction: tx });
    markDirty(invRt.userId, container.id);

    logInvAuth("log", "cancel ok split", {
      userId: invRt.userId,
      containerId: container.id,
      slotIndex: heldState.sourceSlotIndex,
      heldState,
      revertedQty: heldQty,
    });

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
  assertNoHeldState,
  assertHeldState,
  pickup,
  split,
  place,
  cancel,
  getContainerById,
  getItemInstance,
  getItemDef,
};
