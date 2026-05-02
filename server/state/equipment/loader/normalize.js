"use strict";

function asInt(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function parseJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  const raw = value.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return value;
  }
}

function normalizeSlotDefRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: String(plain.id),
    code: plain.code ?? null,
    name: plain.name ?? null,
    slotKind: plain.slot_kind === "HAND" ? "USAGE" : plain.slot_kind ?? "WEAR",
    isActive: Boolean(plain.is_active),
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

function normalizeItemDefRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: String(plain.id),
    code: plain.code ?? null,
    name: plain.name ?? null,
    category: plain.category ?? plain.categoria ?? null,
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

function normalizeItemInstanceRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: String(plain.id),
    itemDefId: String(plain.item_def_id),
    durability: plain.durability == null ? null : asInt(plain.durability, null),
    props: plain.props_json ?? plain.meta ?? null,
    def: null,
  };
}

module.exports = {
  asInt,
  parseJsonObject,
  normalizeSlotDefRow,
  normalizeItemDefComponentRow,
  normalizeItemDefRow,
  normalizeItemInstanceRow,
};
