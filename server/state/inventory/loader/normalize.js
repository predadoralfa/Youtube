"use strict";

function uniq(arr) {
  return Array.from(new Set(arr));
}

function asInt(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function parseJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function makeEmptySlots(slotCount) {
  const n = Math.max(0, asInt(slotCount, 0));
  return Array.from({ length: n }, (_, i) => ({
    slotIndex: i,
    itemInstanceId: null,
    qty: 0,
  }));
}

function ensureSlotCapacity(container, slotIndex) {
  if (slotIndex < 0) return;
  while (container.slots.length <= slotIndex) {
    container.slots.push({
      slotIndex: container.slots.length,
      itemInstanceId: null,
      qty: 0,
    });
  }
}

function normalizeOwnerRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    containerId: String(plain.container_id),
    slotRole: plain.slot_role ?? null,
  };
}

function normalizeContainerRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;

  return {
    id: String(plain.id),
    containerDefId: plain.container_def_id == null ? null : String(plain.container_def_id),
    slotRole: null,
    state: plain.state ?? "ACTIVE",
    rev: asInt(plain.rev, 0),
    def: null,
    slotCount: 0,
    slots: [],
  };
}

function normalizeContainerDefRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;

  return {
    id: String(plain.id),
    code: plain.code ?? null,
    name: plain.name ?? null,
    slotCount: asInt(plain.slot_count, 0),
    maxWeight: plain.max_weight == null ? null : Number(plain.max_weight),
    allowedCategoriesMask:
      plain.allowed_categories_mask == null ? null : asInt(plain.allowed_categories_mask, 0),
  };
}

function normalizeSlotRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;

  const containerId = String(plain.container_id);
  const slotIndex = asInt(plain.slot_index, 0);
  const rawId = plain.item_instance_id;
  const itemInstanceId = rawId == null ? null : String(rawId);
  const qty = asInt(plain.qty, 0);

  if (!itemInstanceId || qty <= 0) {
    return { containerId, slotIndex, itemInstanceId: null, qty: 0 };
  }
  return { containerId, slotIndex, itemInstanceId, qty };
}

function normalizeItemInstanceRow(row, userId) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const props = parseJsonObject(plain.props_json ?? plain.meta ?? null);

  return {
    id: String(plain.id),
    userId: String(userId),
    itemDefId: String(plain.item_def_id),
    props,
    durability: plain.durability == null ? null : asInt(plain.durability, null),
  };
}

function normalizeItemDefRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;

  return {
    id: String(plain.id),
    code: plain.code ?? null,
    name: plain.name ?? null,
    assetKey: plain.asset_key ?? plain.assetKey ?? null,
    category: plain.categoria ?? plain.category ?? null,
    weight:
      plain.unit_weight == null
        ? plain.weight == null
          ? plain.peso == null
            ? null
            : Number(plain.peso)
          : Number(plain.weight)
        : Number(plain.unit_weight),
    stackMax: asInt(plain.stack_max ?? plain.stackMax, 1),
    components: [],
  };
}

function normalizeItemDefComponentRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;

  return {
    id: String(plain.id),
    itemDefId: String(plain.item_def_id),
    componentType: plain.component_type ?? null,
    dataJson: parseJsonObject(plain.data_json ?? null),
    version: asInt(plain.version, 1),
  };
}

module.exports = {
  uniq,
  asInt,
  parseJsonObject,
  makeEmptySlots,
  ensureSlotCapacity,
  normalizeOwnerRow,
  normalizeContainerRow,
  normalizeContainerDefRow,
  normalizeSlotRow,
  normalizeItemInstanceRow,
  normalizeItemDefRow,
  normalizeItemDefComponentRow,
};
