"use strict";

const db = require("../../models");
const { getEquipment, setEquipment } = require("./store");

function asInt(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function normalizeSlotDefRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: String(plain.id),
    code: plain.code ?? null,
    name: plain.name ?? null,
    slotKind: plain.slot_kind === "HAND" ? "USAGE" : (plain.slot_kind ?? "WEAR"),
    isActive: Boolean(plain.is_active),
  };
}

function normalizeItemDefComponentRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: String(plain.id),
    itemDefId: String(plain.item_def_id),
    componentType: plain.component_type ?? null,
    dataJson: plain.data_json ?? null,
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

async function loadSlotDefs() {
  return db.GaEquipmentSlotDef.findAll({
    where: { is_active: true },
    order: [["id", "ASC"]],
  });
}

async function loadEquippedItems(userId) {
  return db.GaEquippedItem.findAll({
    where: { owner_kind: "PLAYER", owner_id: userId },
    include: [
      {
        model: db.GaEquipmentSlotDef,
        as: "slotDef",
      },
      {
        model: db.GaItemInstance,
        as: "itemInstance",
        include: [
          {
            model: db.GaItemDef,
            as: "def",
            include: [
              {
                model: db.GaItemDefComponent,
                as: "components",
              },
            ],
          },
        ],
      },
    ],
    order: [["slot_def_id", "ASC"]],
  });
}

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

  const equipmentRt = {
    userId,
    slotDefs,
    equipmentBySlotCode,
    itemDefsById,
    itemInstancesById,
    loadedAtMs: Date.now(),
  };

  return equipmentRt;
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
