// server/state/inventory/fullPayload.js
"use strict";

const { buildEquipmentFull } = require("../equipment/fullPayload");

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

function buildItemDefPayload(def) {
  return {
    id: String(def.id),
    code: def.code,
    name: def.name,
    category: def.category ?? null,
    weight: def.weight ?? null,
    stackMax: def.stackMax ?? 1,
    components: Array.isArray(def.components)
      ? stableSortBy(def.components, (c) => String(c.id)).map((c) => ({
          id: String(c.id),
          componentType: c.componentType ?? c.component_type ?? null,
          dataJson: c.dataJson ?? c.data_json ?? null,
          version: c.version ?? 1,
        }))
      : [],
  };
}

function isLegacyHandRole(slotRole) {
  return slotRole === "HAND_L" || slotRole === "HAND_R";
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
function buildInventoryFull(invRt, equipmentRt = null) {
  if (!invRt || !invRt.userId) {
    return { ok: false, error: "INVENTORY_NOT_LOADED" };
  }

  const containers = invRt.containers ?? [];
  const inventoryContainers = containers.filter((c) => !isLegacyHandRole(c.slotRole));
  const legacyHandContainers = containers.filter((c) => isLegacyHandRole(c.slotRole));

  // 1) containers + slots (sempre)
  const containersPayload = inventoryContainers.map((c) => ({
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
    [...inventoryContainers, ...legacyHandContainers]
      .flatMap((c) => c.slots ?? [])
      .map((s) => s.itemInstanceId)
      .filter((id) => id != null)
      .map((id) => String(id))
  );

  // Fonte primária: novo runtime (singular)
  // Fallback: legado (plural)
  const instanceMap = invRt.itemInstanceById || invRt.itemInstancesById;

  const itemInstances = referencedInstanceIds
    .map((id) => instanceMap?.get(id) || instanceMap?.get(Number(id)))
    .filter(Boolean);

  const itemInstancesPayload = stableSortBy(itemInstances, (it) => String(it.id)).map((it) => ({
    id: String(it.id),
    itemDefId: String(it.itemDefId),
    durability: it.durability ?? null,

    // compat: alguns pontos chamam "meta", outros "props"/"props_json"
    meta: it.meta ?? it.props ?? it.props_json ?? null,
  }));

  // 3) itemDefs referenciadas pelas instâncias
  const referencedDefIds = uniq(
    itemInstances
      .map((it) => it.itemDefId)
      .filter((id) => id != null)
      .map((id) => String(id))
  );

  const itemDefs = referencedDefIds
    .map((id) => invRt.itemDefsById?.get(id) || invRt.itemDefsById?.get(Number(id)))
    .filter(Boolean);

  const itemDefsPayload = stableSortBy(itemDefs, (d) => String(d.id)).map((d) => ({
    ...buildItemDefPayload(d),
  }));

  const equipment = equipmentRt && equipmentRt.userId ? buildEquipmentFull(equipmentRt, invRt) : null;

  return {
    ok: true,
    containers: containersPayload,
    itemInstances: itemInstancesPayload,
    itemDefs: itemDefsPayload,
    equipment,
  };
}

module.exports = {
  buildInventoryFull,
};
