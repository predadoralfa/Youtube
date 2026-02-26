// server/state/inventory/loader.js
"use strict";

const db = require("../../models");
const { getInventory, setInventory } = require("./store");

// =======================
// utils
// =======================
function uniq(arr) {
  return Array.from(new Set(arr));
}

function asInt(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

// =======================
// queries (sem depender de include profundo)
// =======================
async function loadUserContainers(userId) {
  const GaUserContainer = db.GaUserContainer;
  const GaContainerDef = db.GaContainerDef;

  // Se seu alias não for "def", ajuste aqui.
  // Se quebrar por associação, dá pra remover include e buscar defs por query separada.
  return GaUserContainer.findAll({
    where: { user_id: userId },
    include: [
      {
        model: GaContainerDef,
        as: "def",
        required: false,
      },
    ],
    order: [["id", "ASC"]],
  });
}

async function loadContainerSlots(userContainerIds) {
  if (!userContainerIds.length) return [];

  const GaContainerSlot = db.GaContainerSlot;

  return GaContainerSlot.findAll({
    where: { user_container_id: userContainerIds },
    order: [
      ["user_container_id", "ASC"],
      ["slot_index", "ASC"],
    ],
  });
}

async function loadItemInstances(itemInstanceIds) {
  if (!itemInstanceIds.length) return [];

  const GaItemInstance = db.GaItemInstance;

  return GaItemInstance.findAll({
    where: { id: itemInstanceIds },
    order: [["id", "ASC"]],
  });
}

async function loadItemDefs(itemDefIds) {
  if (!itemDefIds.length) return [];

  const GaItemDef = db.GaItemDef;

  return GaItemDef.findAll({
    where: { id: itemDefIds },
    order: [["id", "ASC"]],
  });
}

// =======================
// normalize
// =======================
function normalizeContainerRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;

  return {
    id: asInt(plain.id),
    slotRole: plain.slot_role ?? null,
    state: plain.state ?? "ACTIVE",
    rev: asInt(plain.rev, 0),
    def: plain.def
      ? {
          id: asInt(plain.def.id),
          code: plain.def.code ?? null,
          name: plain.def.name ?? null,
          slotCount: asInt(plain.def.slot_count, 0),
          maxWeight: plain.def.max_weight == null ? null : Number(plain.def.max_weight),
          allowedCategoriesMask:
            plain.def.allowed_categories_mask == null
              ? null
              : asInt(plain.def.allowed_categories_mask, 0),
        }
      : null,
    slots: [],
  };
}

function normalizeSlotRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;

  const slotIndex = asInt(plain.slot_index, 0);

  // IMPORTANT: se seu model não mapear field corretamente, aqui vira null/undefined
  const rawId = plain.item_instance_id;
  const itemInstanceId = rawId == null ? null : asInt(rawId, null);
  const qty = asInt(plain.qty, 0);

  if (itemInstanceId == null || qty <= 0) {
    return { slotIndex, itemInstanceId: null, qty: 0 };
  }

  return { slotIndex, itemInstanceId, qty };
}

function normalizeItemInstanceRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;

  return {
    id: asInt(plain.id),
    itemDefId: asInt(plain.item_def_id, 0),
    durability: plain.durability == null ? null : asInt(plain.durability, null),
    meta: plain.meta ?? null,
  };
}

function normalizeItemDefRow(row) {
  const plain = row.get ? row.get({ plain: true }) : row;

  return {
    id: asInt(plain.id),
    code: plain.code ?? null,
    name: plain.name ?? null,
    category: plain.categoria ?? plain.category ?? null,
    weight: plain.peso == null ? null : Number(plain.peso),
    stackMax: asInt(plain.stack_max ?? plain.stackMax, 1),
  };
}

// =======================
// main loader
// =======================
async function loadInventoryRuntime(userIdRaw) {
  const userId = String(userIdRaw);

  const containerRows = await loadUserContainers(userId);
  const containers = containerRows.map(normalizeContainerRow);

  const userContainerIds = containers.map((c) => c.id).filter((id) => id > 0);

  const slotRows = await loadContainerSlots(userContainerIds);

  // agrupa slots por container
  const slotsByContainer = new Map(); // user_container_id -> slots[]
  for (const s of slotRows) {
    const plain = s.get ? s.get({ plain: true }) : s;
    const ucId = asInt(plain.user_container_id, 0);
    if (!slotsByContainer.has(ucId)) slotsByContainer.set(ucId, []);
    slotsByContainer.get(ucId).push(normalizeSlotRow(s));
  }

  for (const c of containers) {
    c.slots = slotsByContainer.get(c.id) ?? [];
  }

  // coleta itemInstanceIds referenciados por slots
  const itemInstanceIds = uniq(
    containers
      .flatMap((c) => c.slots)
      .map((s) => s.itemInstanceId)
      .filter((x) => x != null)
  );

  const itemInstanceRows = await loadItemInstances(itemInstanceIds);
  const itemInstances = itemInstanceRows.map(normalizeItemInstanceRow);

  const itemInstancesById = new Map();
  for (const it of itemInstances) itemInstancesById.set(it.id, it);

  const itemDefIds = uniq(
    itemInstances.map((it) => it.itemDefId).filter((id) => Number.isFinite(id) && id > 0)
  );

  const itemDefRows = await loadItemDefs(itemDefIds);
  const itemDefs = itemDefRows.map(normalizeItemDefRow);

  const itemDefsById = new Map();
  for (const d of itemDefs) itemDefsById.set(d.id, d);

  return {
    userId,
    containers,
    itemInstancesById,
    itemDefsById,

    // usado pelo persist/flush e markDirty
    dirtyContainers: new Set(),

    loadedAtMs: Date.now(),
  };
}

/**
 * ensureInventoryLoaded(userId)
 * - usa cache quente do store
 * - carrega do banco só quando necessário
 */
async function ensureInventoryLoaded(userId) {
  const key = String(userId);

  const cached = getInventory(key);
  if (cached) return cached;

  const rt = await loadInventoryRuntime(key);
  setInventory(key, rt);
  return rt;
}

module.exports = {
  ensureInventoryLoaded,
  loadInventoryRuntime,
};