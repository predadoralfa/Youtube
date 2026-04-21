"use strict";

const db = require("../models");
const { move } = require("../state/inventory/ops/move");
const { flush } = require("../state/inventory/persist/flush");
const { findInventorySourceSlot, findEquipmentSourceSlot } = require("./inventoryDropService/sources");

const BUILD_MATERIALS_CONTAINER_CODE = "BUILD_MATERIALS";

function getPrimitiveShelterMaterialsSlotRole(actorId) {
  const id = Number(actorId);
  return `BUILD_MATERIALS:${Number.isInteger(id) && id > 0 ? id : 0}`;
}

async function loadBuildMaterialsContainerDef(tx) {
  const existing = await db.GaContainerDef.findOne({
    where: { code: BUILD_MATERIALS_CONTAINER_CODE },
    transaction: tx,
    lock: tx?.LOCK?.SHARE,
  });

  if (existing) return existing;

  try {
    await db.GaContainerDef.create(
      {
        code: BUILD_MATERIALS_CONTAINER_CODE,
        name: "Build Materials",
        slot_count: 1,
        max_weight: null,
        allowed_categories_mask: null,
        is_active: true,
      },
      { transaction: tx }
    );
  } catch (error) {
    const code = String(error?.original?.code ?? error?.parent?.code ?? error?.code ?? "").toUpperCase();
    if (!code.includes("DUP") && code !== "ER_DUP_ENTRY") {
      throw error;
    }
  }

  return db.GaContainerDef.findOne({
    where: { code: BUILD_MATERIALS_CONTAINER_CODE },
    transaction: tx,
    lock: tx?.LOCK?.SHARE,
  });
}

function ensureSlotsArray(container, requiredSlotCount) {
  const current = Array.isArray(container?.slots) ? container.slots : [];
  const target = Math.max(1, Number(requiredSlotCount ?? 1));
  while (current.length < target) {
    current.push({
      slotIndex: current.length,
      itemInstanceId: null,
      qty: 0,
    });
  }
  container.slots = current;
  container.slotCount = current.length;
  if (container.def) {
    container.def.slotCount = current.length;
  }
  return container;
}

async function ensurePrimitiveShelterMaterialsContainer({ userId, actorId, slotCount = 1, tx }) {
  const ownerUserId = Number(userId);
  const runtimeActorId = Number(actorId);
  const slotRole = getPrimitiveShelterMaterialsSlotRole(runtimeActorId);
  const requiredSlotCount = Math.max(1, Number(slotCount ?? 1));

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
    throw new Error("ensurePrimitiveShelterMaterialsContainer: invalid userId");
  }
  if (!Number.isInteger(runtimeActorId) || runtimeActorId <= 0) {
    throw new Error("ensurePrimitiveShelterMaterialsContainer: invalid actorId");
  }

  const containerDef = await loadBuildMaterialsContainerDef(tx);
  if (!containerDef) {
    throw new Error("Missing seed: ga_container_def code=BUILD_MATERIALS");
  }

  let owner = await db.GaContainerOwner.findOne({
    where: {
      owner_kind: "PLAYER",
      owner_id: ownerUserId,
      slot_role: slotRole,
    },
    include: {
      association: "container",
      required: false,
    },
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });

  const hadOwner = Boolean(owner);
  let container = owner?.container ?? null;
  const now = new Date();

  if (!owner || !container) {
    container = await db.GaContainer.create(
      {
        container_def_id: Number(containerDef.id),
        slot_role: slotRole,
        state: "ACTIVE",
        rev: 1,
        created_at: now,
        updated_at: now,
      },
      { transaction: tx }
    );

    if (owner) {
      await owner.update({ container_id: container.id }, { transaction: tx });
    } else {
      owner = await db.GaContainerOwner.create(
        {
          container_id: container.id,
          owner_kind: "PLAYER",
          owner_id: ownerUserId,
          slot_role: slotRole,
        },
        { transaction: tx }
      );
    }
  } else {
    await container.update(
      {
        container_def_id: Number(containerDef.id),
        slot_role: slotRole,
        state: "ACTIVE",
      },
      { transaction: tx }
    );
  }

  const existingSlots = await db.GaContainerSlot.findAll({
    where: { container_id: Number(container.id) },
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
    order: [["slot_index", "ASC"]],
  });

  const existingSlotIndexes = new Set(existingSlots.map((row) => Number(row.slot_index)));
  const finalSlotCount = Math.max(requiredSlotCount, existingSlots.length, 1);
  const missingSlots = [];
  for (let i = 0; i < finalSlotCount; i++) {
    if (existingSlotIndexes.has(i)) continue;
    missingSlots.push({
      container_id: Number(container.id),
      slot_index: i,
      item_instance_id: null,
      qty: 0,
    });
  }

  if (missingSlots.length > 0) {
    await db.GaContainerSlot.bulkCreate(missingSlots, { transaction: tx });
  }

  const normalizedContainer = {
    id: String(container.id),
    containerDefId: Number(container.container_def_id),
    slotRole,
    state: container.state ?? "ACTIVE",
    rev: Number(container.rev ?? 0),
    def: {
      id: String(containerDef.id),
      code: containerDef.code,
      name: containerDef.name,
      slotCount: finalSlotCount,
      maxWeight: containerDef.max_weight == null ? null : Number(containerDef.max_weight),
      allowedCategoriesMask:
        containerDef.allowed_categories_mask == null
          ? null
          : Number(containerDef.allowed_categories_mask),
    },
    slots: existingSlots
      .map((row) => ({
        slotIndex: Number(row.slot_index),
        itemInstanceId: row.item_instance_id == null ? null : String(row.item_instance_id),
        qty: Number(row.qty ?? 0),
      }))
      .sort((a, b) => a.slotIndex - b.slotIndex),
  };

  ensureSlotsArray(normalizedContainer, finalSlotCount);

  return {
    owner,
    container: normalizedContainer,
    slotRole,
    slotCount: finalSlotCount,
    created: !hadOwner,
  };
}

function countItemDefIdInContainer(invRt, slotRole, itemDefId) {
  const container = invRt?.containersByRole?.get?.(String(slotRole)) ?? null;
  if (!container) return 0;

  let total = 0;
  for (const slot of Array.isArray(container.slots) ? container.slots : []) {
    const qty = Math.max(0, Number(slot?.qty ?? 0));
    if (qty <= 0 || slot?.itemInstanceId == null) continue;

    const instance = invRt?.itemInstanceById?.get?.(String(slot.itemInstanceId)) ?? null;
    const instanceDefId = instance?.itemDefId ?? instance?.item_def_id ?? null;
    if (String(instanceDefId) !== String(itemDefId)) continue;
    total += qty;
  }

  return total;
}

async function clearPrimitiveShelterMaterialsContainer({ userId, actorId, invRt, eqRt, tx }) {
  const ownerUserId = Number(userId);
  const runtimeActorId = Number(actorId);
  const slotRole = getPrimitiveShelterMaterialsSlotRole(runtimeActorId);
  const runtime = invRt ?? null;
  const equipmentRuntime = eqRt ?? null;

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
    throw new Error("clearPrimitiveShelterMaterialsContainer: invalid userId");
  }
  if (!Number.isInteger(runtimeActorId) || runtimeActorId <= 0) {
    throw new Error("clearPrimitiveShelterMaterialsContainer: invalid actorId");
  }

  const owner = await db.GaContainerOwner.findOne({
    where: {
      owner_kind: "PLAYER",
      owner_id: ownerUserId,
      slot_role: slotRole,
    },
    include: {
      association: "container",
      required: false,
    },
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });

  if (!owner?.container) {
    return { ok: true, slotRole, containerId: null, dropped: 0 };
  }

  const container = owner.container;
  const containerId = Number(container.id);
  const slotRows = await db.GaContainerSlot.findAll({
    where: { container_id: containerId },
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
    order: [["slot_index", "ASC"]],
  });
  const items = slotRows.filter((row) => row?.item_instance_id != null && Number(row.qty ?? 0) > 0);

  let dropped = 0;
  const droppedActors = [];
  const { dropInventoryItemToGround } = require("./inventoryDropService");
  for (const slot of items) {
    const itemInstanceId = Number(slot.item_instance_id);
    if (!Number.isInteger(itemInstanceId) || itemInstanceId <= 0) continue;
    const result = await dropInventoryItemToGround(ownerUserId, itemInstanceId, {
      transaction: tx,
      invRt: runtime,
      eqRt: equipmentRuntime,
    });
    dropped += 1;
    if (result?.ok && result?.actor) {
      droppedActors.push(result.actor);
    }
  }

  await db.GaContainerSlot.destroy({
    where: { container_id: containerId },
    transaction: tx,
  });
  await db.GaContainerOwner.destroy({
    where: {
      owner_kind: "PLAYER",
      owner_id: ownerUserId,
      slot_role: slotRole,
    },
    transaction: tx,
  });
  await db.GaContainer.destroy({
    where: { id: containerId },
    transaction: tx,
  });

  if (runtime?.containers) {
    runtime.containers = runtime.containers.filter((entry) => String(entry.id) !== String(containerId));
  }
  if (runtime?.containersByRole?.has?.(slotRole)) {
    runtime.containersByRole.delete(slotRole);
  }
  if (runtime?.containersById?.has?.(String(containerId))) {
    runtime.containersById.delete(String(containerId));
  }

  return { ok: true, slotRole, containerId, dropped, droppedActors };
}

async function consumePrimitiveShelterMaterialsContainer({ userId, actorId, invRt, tx }) {
  const ownerUserId = Number(userId);
  const runtimeActorId = Number(actorId);
  const slotRole = getPrimitiveShelterMaterialsSlotRole(runtimeActorId);
  const runtime = invRt ?? null;

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
    throw new Error("consumePrimitiveShelterMaterialsContainer: invalid userId");
  }
  if (!Number.isInteger(runtimeActorId) || runtimeActorId <= 0) {
    throw new Error("consumePrimitiveShelterMaterialsContainer: invalid actorId");
  }

  const owner = await db.GaContainerOwner.findOne({
    where: {
      owner_kind: "PLAYER",
      owner_id: ownerUserId,
      slot_role: slotRole,
    },
    include: {
      association: "container",
      required: false,
    },
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });

  if (!owner?.container) {
    return { ok: true, slotRole, containerId: null, consumed: 0 };
  }

  const container = owner.container;
  const containerId = Number(container.id);
  const slotRows = await db.GaContainerSlot.findAll({
    where: { container_id: containerId },
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
    order: [["slot_index", "ASC"]],
  });

  let consumed = 0;
  for (const slot of slotRows) {
    const itemInstanceId = Number(slot.item_instance_id);
    if (!Number.isInteger(itemInstanceId) || itemInstanceId <= 0) continue;
    if (runtime?.itemInstanceById?.has?.(String(itemInstanceId))) {
      runtime.itemInstanceById.delete(String(itemInstanceId));
    }
    await db.GaItemInstance.destroy({
      where: { id: itemInstanceId },
      transaction: tx,
    });
    consumed += 1;
  }

  await db.GaContainerSlot.destroy({
    where: { container_id: containerId },
    transaction: tx,
  });
  await db.GaContainerOwner.destroy({
    where: {
      owner_kind: "PLAYER",
      owner_id: ownerUserId,
      slot_role: slotRole,
    },
    transaction: tx,
  });
  await db.GaContainer.destroy({
    where: { id: containerId },
    transaction: tx,
  });

  if (runtime?.containers) {
    runtime.containers = runtime.containers.filter((entry) => String(entry.id) !== String(containerId));
  }
  if (runtime?.containersByRole?.has?.(slotRole)) {
    runtime.containersByRole.delete(slotRole);
  }
  if (runtime?.containersById?.has?.(String(containerId))) {
    runtime.containersById.delete(String(containerId));
  }

  return { ok: true, slotRole, containerId, consumed };
}

function normalizeCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function parseActorBuildState(actorRow) {
  const raw = actorRow?.state_json ?? actorRow?.stateJson ?? actorRow?.state ?? null;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function findRequirementIndex(buildRequirements, itemCode) {
  const targetCode = normalizeCode(itemCode);
  if (!targetCode) return -1;
  const list = Array.isArray(buildRequirements) ? buildRequirements : [];
  return list.findIndex((req) => normalizeCode(req?.itemCode ?? req?.code ?? "") === targetCode);
}

async function depositPrimitiveShelterMaterial({ userId, actorId, itemInstanceId, qty, invRt, eqRt, tx }) {
  const ownerUserId = Number(userId);
  const runtimeActorId = Number(actorId);
  const targetItemInstanceId = Number(itemInstanceId);
  const requestedQty = Math.max(1, Number(qty ?? 1));

  if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
    throw new Error("depositPrimitiveShelterMaterial: invalid userId");
  }
  if (!Number.isInteger(runtimeActorId) || runtimeActorId <= 0) {
    throw new Error("depositPrimitiveShelterMaterial: invalid actorId");
  }
  if (!Number.isInteger(targetItemInstanceId) || targetItemInstanceId <= 0) {
    throw new Error("depositPrimitiveShelterMaterial: invalid itemInstanceId");
  }

  const actor = await db.GaActorRuntime.findByPk(runtimeActorId, {
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });
  if (!actor) {
    return { ok: false, code: "ACTOR_NOT_FOUND", message: "Build actor not found" };
  }

  const buildState = parseActorBuildState(actor);
  const constructionState = normalizeCode(buildState?.constructionState ?? "PLANNED");
  if (constructionState === "RUNNING") {
    return {
      ok: false,
      code: "BUILD_ALREADY_RUNNING",
      message: "Building is already running",
    };
  }
  if (constructionState === "COMPLETED") {
    return {
      ok: false,
      code: "BUILD_ALREADY_COMPLETED",
      message: "Building is already completed",
    };
  }

  const buildRequirements = Array.isArray(buildState?.buildRequirements) ? buildState.buildRequirements : [];
  const requirementItem = findInventorySourceSlot(invRt, targetItemInstanceId)
    ? null
    : findEquipmentSourceSlot(eqRt, targetItemInstanceId);
  const inventorySource = findInventorySourceSlot(invRt, targetItemInstanceId);
  const source = inventorySource || requirementItem;
  if (!source) {
    return {
      ok: false,
      code: "ITEM_NOT_FOUND",
      message: "Item not found in inventory or equipment",
    };
  }

  const sourceItemInstance =
    invRt?.itemInstanceById?.get?.(String(targetItemInstanceId)) ??
    eqRt?.itemInstancesById?.get?.(String(targetItemInstanceId)) ??
    source?.equipped?.itemInstance ??
    null;
  const sourceItemDef =
    invRt?.itemDefsById?.get?.(String(sourceItemInstance?.itemDefId ?? "")) ??
    eqRt?.itemDefsById?.get?.(String(sourceItemInstance?.itemDefId ?? "")) ??
    source?.equipped?.itemDef ??
    null;
  if (!sourceItemDef) {
    return {
      ok: false,
      code: "ITEM_DEF_NOT_FOUND",
      message: "Item definition not found",
    };
  }

  const sourceCode = normalizeCode(sourceItemDef.code ?? sourceItemDef.itemCode ?? "");
  const requirementIndex = findRequirementIndex(buildRequirements, sourceCode);
  if (requirementIndex < 0) {
    return {
      ok: false,
      code: "BUILD_REQUIREMENT_NOT_FOUND",
      message: `${sourceCode.replace(/_/g, " ").toLowerCase()} is not required for this build`,
    };
  }

  const slotRole =
    String(buildState?.buildMaterialsSlotRole ?? buildState?.build_materials_slot_role ?? getPrimitiveShelterMaterialsSlotRole(runtimeActorId))
      .trim() || getPrimitiveShelterMaterialsSlotRole(runtimeActorId);
  const requiredSlotCount = Math.max(1, buildRequirements.length || requirementIndex + 1);
  const materials = await ensurePrimitiveShelterMaterialsContainer({
    userId: ownerUserId,
    actorId: runtimeActorId,
    slotCount: requiredSlotCount,
    tx,
  });

  const destinationContainer = materials?.container ?? null;
  if (!destinationContainer) {
    return {
      ok: false,
      code: "BUILD_MATERIALS_CONTAINER_MISSING",
      message: "Build materials container missing",
    };
  }

  if (invRt) {
    const normalizedContainer = {
      ...destinationContainer,
      slotRole,
      slots: Array.isArray(destinationContainer.slots)
        ? destinationContainer.slots.map((slot) => ({ ...slot }))
        : [],
    };
    invRt.containers = Array.isArray(invRt.containers)
      ? [
          ...invRt.containers.filter((entry) => String(entry?.id ?? "") !== String(normalizedContainer.id)),
          normalizedContainer,
        ]
      : [normalizedContainer];
    if (invRt.containersByRole?.set) {
      invRt.containersByRole.set(slotRole, normalizedContainer);
    }
    if (invRt.containersById?.set) {
      invRt.containersById.set(String(normalizedContainer.id), normalizedContainer);
    }
  }

  const containerSlotRows = await db.GaContainerSlot.findAll({
    where: {
      container_id: Number(destinationContainer.id),
    },
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
    order: [["slot_index", "ASC"]],
  });
  const targetSlotRow = containerSlotRows.find((row) => Number(row.slot_index) === requirementIndex) ?? null;
  if (!targetSlotRow) {
    return {
      ok: false,
      code: "BUILD_MATERIAL_SLOT_MISSING",
      message: "Build material slot missing",
    };
  }

  const sourceQty = Number(
    inventorySource?.slot?.qty ??
      source?.qty ??
      (source?.equipped ? 1 : 0)
  ) || 1;
  const moveQty = Math.min(requestedQty, Math.max(1, sourceQty));

  if (inventorySource) {
    const result = move(invRt, {
      from: {
        role: String(inventorySource.container.slotRole ?? ""),
        slot: Number(inventorySource.slot.slotIndex),
        slotIndex: Number(inventorySource.slot.slotIndex),
      },
      to: {
        role: slotRole,
        slot: requirementIndex,
        slotIndex: requirementIndex,
      },
      qty: moveQty,
    });
    await flush(invRt, result, tx, eqRt);
  } else {
    if (moveQty < sourceQty) {
      return {
        ok: false,
        code: "PARTIAL_EQUIPMENT_DEPOSIT_NOT_SUPPORTED",
        message: "Deposit the full equipped item first",
      };
    }

    const sourceSlotCode = String(source?.slotCode ?? "").trim();
    if (!sourceSlotCode) {
      return {
        ok: false,
        code: "EQUIPMENT_SLOT_NOT_FOUND",
        message: "Equipment slot not found",
      };
    }

    const destQty = Math.max(0, Number(targetSlotRow.qty ?? 0));
    const destItemInstanceId = targetSlotRow.item_instance_id == null ? null : Number(targetSlotRow.item_instance_id);
    const destItemInstance =
      destItemInstanceId != null ? invRt?.itemInstanceById?.get?.(String(destItemInstanceId)) ?? null : null;
    const destItemDefId = destItemInstance?.itemDefId ?? null;

    if (targetSlotRow.item_instance_id == null) {
      await targetSlotRow.update(
        {
          item_instance_id: targetItemInstanceId,
          qty: moveQty,
        },
        { transaction: tx }
      );
    } else if (String(destItemDefId) === String(sourceItemInstance.itemDefId)) {
      await targetSlotRow.update(
        {
          qty: destQty + moveQty,
        },
        { transaction: tx }
      );
    } else {
      return {
        ok: false,
        code: "BUILD_MATERIAL_SLOT_OCCUPIED",
        message: "Build material slot is occupied by another item",
      };
    }

    await db.GaEquippedItem.destroy({
      where: {
        owner_kind: "PLAYER",
        owner_id: ownerUserId,
        item_instance_id: targetItemInstanceId,
      },
      transaction: tx,
    });

    if (eqRt?.equipmentBySlotCode && sourceSlotCode) {
      eqRt.equipmentBySlotCode[sourceSlotCode] = null;
    }

    if (invRt?.itemInstanceById?.has?.(String(targetItemInstanceId))) {
      const item = invRt.itemInstanceById.get(String(targetItemInstanceId));
      if (item) {
        item.equipped = false;
      }
    }

    await db.GaContainer.increment(
      { rev: 1 },
      {
        where: { id: Number(destinationContainer.id) },
        transaction: tx,
      }
    );
  }

  return {
    ok: true,
    slotRole,
    containerId: Number(destinationContainer.id),
    requirementIndex,
    itemCode: sourceCode,
    qty: moveQty,
    sourceKind: inventorySource ? "INVENTORY" : "EQUIPMENT",
  };
}

module.exports = {
  BUILD_MATERIALS_CONTAINER_CODE,
  getPrimitiveShelterMaterialsSlotRole,
  ensurePrimitiveShelterMaterialsContainer,
  countItemDefIdInContainer,
  clearPrimitiveShelterMaterialsContainer,
  consumePrimitiveShelterMaterialsContainer,
  depositPrimitiveShelterMaterial,
};
