// src/inventory/inventoryProbe.js
"use strict";

/**
 * InventoryProbe
 * - Somente observabilidade (logs)
 * - Compatível com payload antigo e novo (slotRole/role, slotIndex/slot, itemInstanceId/item_instance_id)
 */

const INV_FRONT_DEBUG = true;

function roleOf(c) {
  return c?.slotRole ?? c?.role ?? "UNKNOWN_ROLE";
}

function slotIndexOf(s) {
  return s?.slotIndex ?? s?.slot ?? null;
}

function itemIdOf(s) {
  return s?.itemInstanceId ?? s?.item_instance_id ?? null;
}

export function logInventory(tag, inv) {
  if (!INV_FRONT_DEBUG) return;


  if (!inv || inv.ok !== true) {
    return;
  }

  const containers = inv.containers || [];
  const instances = inv.itemInstances || inv.item_instances || [];
  const defs = inv.itemDefs || inv.item_defs || [];


  for (const c of containers) {
    const role = roleOf(c);
    const slots = c.slots || [];

    const view = slots.map((s) => ({
      i: slotIndexOf(s),
      iid: itemIdOf(s),
      q: Number(s?.qty ?? 0),
    }));


    const occupied = view.filter((x) => x.iid != null && x.q > 0);
    if (occupied.length);
  }
}