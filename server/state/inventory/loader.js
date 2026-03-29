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

// =======================
// queries
// =======================
async function loadOwnersForPlayer(userId) {
  const GaContainerOwner = db.GaContainerOwner;
  return GaContainerOwner.findAll({
    where: { owner_kind: "PLAYER", owner_id: userId },
    order: [
      ["container_id", "ASC"],
      ["slot_role", "ASC"],
    ],
  });
}

async function loadContainersByIds(containerIds) {
  if (!containerIds.length) return [];
  const GaContainer = db.GaContainer;

  // ⚠️ Sem include. Defs serão carregadas separadamente.
  return GaContainer.findAll({
    where: { id: containerIds },
    order: [["id", "ASC"]],
  });
}

async function loadContainerDefsByIds(defIds) {
  if (!defIds.length) return [];
  const GaContainerDef = db.GaContainerDef;

  return GaContainerDef.findAll({
    where: { id: defIds },
    order: [["id", "ASC"]],
  });
}

async function loadSlotsByContainerIds(containerIds) {
  if (!containerIds.length) return [];
  const GaContainerSlot = db.GaContainerSlot;

  return GaContainerSlot.findAll({
    where: { container_id: containerIds },
    order: [
      ["container_id", "ASC"],
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

async function loadItemDefComponents(itemDefIds) {
  if (!itemDefIds.length) return [];
  const GaItemDefComponent = db.GaItemDefComponent;

  return GaItemDefComponent.findAll({
    where: { item_def_id: itemDefIds },
    order: [
      ["item_def_id", "ASC"],
      ["id", "ASC"],
    ],
  });
}

// =======================
// normalize
// =======================
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

    // slotRole vem do owner
    slotRole: null,

    state: plain.state ?? "ACTIVE",
    rev: asInt(plain.rev, 0),

    // preenchidos depois
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

  const props = plain.props_json ?? plain.meta ?? null;

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
    category: plain.categoria ?? plain.category ?? null,
    weight: plain.peso == null ? null : Number(plain.peso),
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
    dataJson: plain.data_json ?? null,
    version: asInt(plain.version, 1),
  };
}

// =======================
// main loader
// =======================
async function loadInventoryRuntime(userIdRaw) {
  const userId = String(userIdRaw);

  // 1) owners -> containerIds + slotRoles
  const ownerRows = await loadOwnersForPlayer(userId);
  const owners = ownerRows.map(normalizeOwnerRow);

  const containerIds = uniq(owners.map((o) => o.containerId));
  const containerRows = await loadContainersByIds(containerIds);

  // 2) containers base
  const containersById = new Map();
  for (const row of containerRows) {
    const c = normalizeContainerRow(row);
    containersById.set(c.id, c);
  }

  // 3) injeta slotRole no container a partir do owner
  for (const o of owners) {
    const c = containersById.get(o.containerId);
    if (!c) continue;
    if (c.slotRole == null) c.slotRole = o.slotRole;
  }

  // 4) carrega defs separadamente
  const defIds = uniq(
    Array.from(containersById.values())
      .map((c) => c.containerDefId)
      .filter(Boolean)
  );

  const defRows = await loadContainerDefsByIds(defIds);
  const defsById = new Map();
  for (const row of defRows) {
    const d = normalizeContainerDefRow(row);
    defsById.set(d.id, d);
  }

  // 5) injeta def + slotCount + cria slots vazios
  for (const c of containersById.values()) {
    const d = c.containerDefId ? defsById.get(c.containerDefId) : null;
    c.def = d;
    c.slotCount = d?.slotCount ?? 0;
    c.slots = makeEmptySlots(c.slotCount);
  }

  // 6) aplica slots do DB (NUNCA descarta dado autoritativo)
  const slotRows = await loadSlotsByContainerIds(containerIds);
  for (const row of slotRows) {
    const s = normalizeSlotRow(row);
    const c = containersById.get(s.containerId);
    if (!c) continue;

    if (s.slotIndex < 0) continue;

    // ✅ expande slots até caber o slotIndex encontrado no DB
    ensureSlotCapacity(c, s.slotIndex);

    c.slots[s.slotIndex].itemInstanceId = s.itemInstanceId;
    c.slots[s.slotIndex].qty = s.qty;
  }

  // 6.1) garante consistência mínima (slotCount reflete o que existe)
  for (const c of containersById.values()) {
    c.slotCount = c.slots.length;
    if (c.def) c.def.slotCount = c.slotCount;
  }

  const containers = Array.from(containersById.values()).sort((a, b) => Number(a.id) - Number(b.id));

  // 7) containersByRole (contrato das ops)
  const containersByRole = new Map();
  for (const c of containers) {
    if (c.slotRole) containersByRole.set(c.slotRole, c);
  }

  // 8) item instances referenciadas
  const itemInstanceIds = uniq(
    containers
      .flatMap((c) => c.slots ?? [])
      .map((s) => s.itemInstanceId)
      .filter((x) => x != null)
  );

  const itemInstanceRows = await loadItemInstances(itemInstanceIds);
  const itemInstanceById = new Map();
  for (const row of itemInstanceRows) {
    const it = normalizeItemInstanceRow(row, userId);
    itemInstanceById.set(String(it.id), it);
  }

  // 9) item defs
  const itemDefIds = uniq(
    Array.from(itemInstanceById.values())
      .map((it) => it.itemDefId)
      .filter(Boolean)
  );

  const itemDefRows = await loadItemDefs(itemDefIds);
  const itemDefsById = new Map();
  for (const row of itemDefRows) {
    const d = normalizeItemDefRow(row);
    itemDefsById.set(String(d.id), d);
  }

  const itemDefComponentRows = await loadItemDefComponents(itemDefIds);
  const itemDefComponentsById = new Map();
  for (const row of itemDefComponentRows) {
    const c = normalizeItemDefComponentRow(row);
    const key = String(c.itemDefId);
    const list = itemDefComponentsById.get(key) || [];
    list.push(c);
    itemDefComponentsById.set(key, list);
  }

  for (const [id, def] of itemDefsById.entries()) {
    def.components = itemDefComponentsById.get(String(id)) || [];
  }

  return {
    userId,
    containersByRole,
    itemInstanceById,

    // usado pelo fullPayload
    containers,
    itemDefsById,

    dirtyContainers: new Set(),
    loadedAtMs: Date.now(),
  };
}

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
