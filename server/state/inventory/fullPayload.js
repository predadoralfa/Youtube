// server/state/inventory/fullPayload.js
"use strict";

function uniq(arr) {
  return Array.from(new Set(arr));
}

function stableSortBy(arr, pick) {
  return [...arr].sort((a, b) => {
    const av = pick(a);
    const bv = pick(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
}

/**
 * buildInventoryFull(invRt)
 * Converte runtime em payload autoritativo "inv:full"
 *
 * Contrato:
 * - inclui apenas instâncias referenciadas em slots
 * - inclui apenas defs referenciadas por essas instâncias
 * - não despeja catálogo inteiro
 */
function buildInventoryFull(invRt) {
  if (!invRt || !invRt.userId) {
    return { ok: false, error: "INVENTORY_NOT_LOADED" };
  }

  const containers = invRt.containers ?? [];

  // 1) containers + slots (sempre)
  const containersPayload = containers.map((c) => ({
    id: c.id,
    slotRole: c.slotRole,
    state: c.state,
    rev: c.rev,
    def: c.def
      ? {
          id: c.def.id,
          code: c.def.code,
          name: c.def.name,
          slotCount: c.def.slotCount,
          maxWeight: c.def.maxWeight,
          allowedCategoriesMask: c.def.allowedCategoriesMask,
        }
      : null,
    slots: stableSortBy(c.slots ?? [], (s) => s.slotIndex).map((s) => ({
      slotIndex: s.slotIndex,
      itemInstanceId: s.itemInstanceId ?? null,
      qty: s.qty ?? 0,
    })),
  }));

  // 2) itemInstances referenciadas
  const referencedInstanceIds = uniq(
    containers
      .flatMap((c) => c.slots ?? [])
      .map((s) => s.itemInstanceId)
      .filter((id) => id != null)
  );

  const itemInstances = referencedInstanceIds
    .map((id) => invRt.itemInstancesById?.get(id))
    .filter(Boolean);

  const itemInstancesPayload = stableSortBy(itemInstances, (it) => it.id).map((it) => ({
    id: it.id,
    itemDefId: it.itemDefId,
    durability: it.durability ?? null,
    meta: it.meta ?? null,
  }));

  // 3) itemDefs referenciadas pelas instâncias
  const referencedDefIds = uniq(
    itemInstances.map((it) => it.itemDefId).filter((id) => Number.isFinite(id) && id > 0)
  );

  const itemDefs = referencedDefIds
    .map((id) => invRt.itemDefsById?.get(id))
    .filter(Boolean);

  const itemDefsPayload = stableSortBy(itemDefs, (d) => d.id).map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    category: d.category ?? null,
    weight: d.weight ?? null,
    stackMax: d.stackMax ?? 1,
  }));

  return {
    ok: true,
    containers: containersPayload,
    itemInstances: itemInstancesPayload,
    itemDefs: itemDefsPayload,
  };
}

module.exports = {
  buildInventoryFull,
};