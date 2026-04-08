"use strict";

const { loadCarryWeightStats } = require("../weight");
const { ensureStarterInventory } = require("../../../service/inventoryProvisioning");
const {
  loadOwnersForPlayer,
  loadContainersByIds,
  loadContainerDefsByIds,
  loadSlotsByContainerIds,
  loadItemInstances,
  loadItemDefs,
  loadItemDefComponents,
} = require("./queries");
const {
  uniq,
  makeEmptySlots,
  ensureSlotCapacity,
  normalizeOwnerRow,
  normalizeContainerRow,
  normalizeContainerDefRow,
  normalizeSlotRow,
  normalizeItemInstanceRow,
  normalizeItemDefRow,
  normalizeItemDefComponentRow,
} = require("./normalize");

async function loadInventoryRuntime(userIdRaw) {
  const userId = String(userIdRaw);

  const ownerRows = await loadOwnersForPlayer(userId);
  if (!ownerRows.length) {
    await ensureStarterInventory(userId);
    const provisionedOwnerRows = await loadOwnersForPlayer(userId);
    if (provisionedOwnerRows.length > 0) {
      return loadInventoryRuntime(userId);
    }
  }
  const owners = ownerRows.map(normalizeOwnerRow);

  const containerIds = uniq(owners.map((o) => o.containerId));
  const containerRows = await loadContainersByIds(containerIds);

  const containersById = new Map();
  for (const row of containerRows) {
    const c = normalizeContainerRow(row);
    containersById.set(c.id, c);
  }

  for (const o of owners) {
    const c = containersById.get(o.containerId);
    if (!c) continue;
    if (c.slotRole == null) c.slotRole = o.slotRole;
  }

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

  for (const c of containersById.values()) {
    const d = c.containerDefId ? defsById.get(c.containerDefId) : null;
    c.def = d;
    c.slotCount = d?.slotCount ?? 0;
    c.slots = makeEmptySlots(c.slotCount);
  }

  const containerIdsList = Array.from(containersById.keys());
  const slotRows = await loadSlotsByContainerIds(containerIdsList);
  for (const row of slotRows) {
    const s = normalizeSlotRow(row);
    const c = containersById.get(s.containerId);
    if (!c) continue;
    if (s.slotIndex < 0) continue;

    ensureSlotCapacity(c, s.slotIndex);
    c.slots[s.slotIndex].itemInstanceId = s.itemInstanceId;
    c.slots[s.slotIndex].qty = s.qty;
  }

  for (const c of containersById.values()) {
    c.slotCount = c.slots.length;
    if (c.def) c.def.slotCount = c.slotCount;
  }

  const containers = Array.from(containersById.values()).sort((a, b) => Number(a.id) - Number(b.id));

  const containersByRole = new Map();
  for (const c of containers) {
    if (c.slotRole) containersByRole.set(c.slotRole, c);
  }

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

  const carryWeight = await loadCarryWeightStats(userId);

  return {
    userId,
    containersByRole,
    containersById,
    itemInstanceById,
    heldState: null,
    carryWeight,
    containers,
    itemDefsById,
    dirtyContainers: new Set(),
    loadedAtMs: Date.now(),
  };
}

async function ensureInventoryLoaded(userId) {
  const { getInventory, setInventory } = require("../store");
  const key = String(userId);

  const cached = getInventory(key);
  if (cached) return cached;

  const rt = await loadInventoryRuntime(key);
  setInventory(key, rt);
  return rt;
}

module.exports = {
  loadInventoryRuntime,
  ensureInventoryLoaded,
};
