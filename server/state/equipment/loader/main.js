"use strict";

const { loadSlotDefs, loadEquippedItems } = require("./queries");
const {
  normalizeSlotDefRow,
  normalizeItemDefComponentRow,
  normalizeItemDefRow,
  normalizeItemInstanceRow,
} = require("./normalize");
const { getEquipment, setEquipment } = require("../store");

async function loadEquipmentRuntime(userIdRaw) {
  const userId = String(userIdRaw);

  let slotDefRows = [];
  try {
    slotDefRows = await loadSlotDefs();
  } catch (error) {
    if (error?.original?.code === "ER_NO_SUCH_TABLE" || error?.parent?.code === "ER_NO_SUCH_TABLE") {
      return {
        userId,
        slotDefs: [],
        equipmentBySlotCode: {},
        itemDefsById: new Map(),
        itemInstancesById: new Map(),
        loadedAtMs: Date.now(),
      };
    }
    throw error;
  }

  const slotDefs = slotDefRows.map(normalizeSlotDefRow);

  let equippedRows = [];
  try {
    equippedRows = await loadEquippedItems(userId);
  } catch (error) {
    if (error?.original?.code === "ER_NO_SUCH_TABLE" || error?.parent?.code === "ER_NO_SUCH_TABLE") {
      return {
        userId,
        slotDefs: [],
        equipmentBySlotCode: {},
        itemDefsById: new Map(),
        itemInstancesById: new Map(),
        loadedAtMs: Date.now(),
      };
    }
    throw error;
  }

  const equipmentBySlotCode = {};
  for (const slotDef of slotDefs) {
    equipmentBySlotCode[slotDef.code] = null;
  }

  const itemDefsById = new Map();
  const itemInstancesById = new Map();

  for (const row of equippedRows) {
    const plain = row.get ? row.get({ plain: true }) : row;
    const slotDef = plain.slotDef ? normalizeSlotDefRow(plain.slotDef) : null;
    const itemInstancePlain = plain.itemInstance ?? null;
    const itemDefPlain = itemInstancePlain?.def ?? null;

    if (!slotDef || !slotDef.code) continue;

    let itemInstance = null;
    if (itemInstancePlain) {
      itemInstance = normalizeItemInstanceRow(itemInstancePlain);
      itemInstancesById.set(String(itemInstance.id), itemInstance);
    }

    let itemDef = null;
    if (itemDefPlain) {
      const normalizedDef = normalizeItemDefRow(itemDefPlain);
      const components = Array.isArray(itemDefPlain.components)
        ? itemDefPlain.components.map(normalizeItemDefComponentRow)
        : [];
      normalizedDef.components = components;
      itemDef = normalizedDef;
      itemDefsById.set(String(itemDef.id), itemDef);

      if (itemInstance) {
        itemInstance.def = itemDef;
      }
    }

    equipmentBySlotCode[slotDef.code] = {
      id: String(plain.id),
      ownerKind: plain.owner_kind,
      ownerId: String(plain.owner_id),
      slotDefId: String(plain.slot_def_id),
      slotCode: slotDef.code,
      slotKind: slotDef.slotKind,
      slotName: slotDef.name,
      itemInstanceId: itemInstance ? String(itemInstance.id) : String(plain.item_instance_id),
      itemInstance,
      itemDef,
    };
  }

  return {
    userId,
    slotDefs,
    equipmentBySlotCode,
    itemDefsById,
    itemInstancesById,
    loadedAtMs: Date.now(),
  };
}

async function ensureEquipmentLoaded(userId) {
  const key = String(userId);
  const cached = getEquipment(key);
  if (cached) return cached;

  const rt = await loadEquipmentRuntime(key);
  setEquipment(key, rt);
  return rt;
}

module.exports = {
  ensureEquipmentLoaded,
  loadEquipmentRuntime,
};
