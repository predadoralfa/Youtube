"use strict";

const db = require("../../models");
const { flush } = require("../../state/inventory/persist/flush");
const {
  canonicalResearchItemCode,
  normalizeItemCode,
  normalizeItemCosts,
} = require("./shared");

function findItemDefByCode(invRt, itemCode) {
  if (!invRt?.itemDefsById || !itemCode) return null;
  const target = canonicalResearchItemCode(itemCode);
  for (const def of invRt.itemDefsById.values()) {
    if (canonicalResearchItemCode(def?.code) === target) {
      return def;
    }
  }
  return null;
}

function resolveCostItemDef(invRt, cost) {
  if (cost?.itemDefId != null) {
    return invRt?.itemDefsById?.get?.(String(cost.itemDefId)) || null;
  }
  return findItemDefByCode(invRt, cost?.itemCode ?? null);
}

async function resolveCostItemDefFresh(invRt, cost) {
  const cached = resolveCostItemDef(invRt, cost);
  if (cached) return cached;

  if (cost?.itemDefId != null) {
    const row = await db.GaItemDef.findByPk(Number(cost.itemDefId));
    if (row) {
      return {
        id: Number(row.id),
        code: row.code,
        name: row.name,
        category: row.category ?? row.categoria ?? null,
      };
    }
  }

  if (cost?.itemCode != null) {
    const aliases = Array.from(
      new Set([
        canonicalResearchItemCode(cost.itemCode),
        normalizeItemCode(cost.itemCode),
        String(cost.itemCode),
      ])
    ).filter(Boolean);

    for (const alias of aliases) {
      const row = await db.GaItemDef.findOne({ where: { code: alias } });
      if (row) {
        return {
          id: Number(row.id),
          code: row.code,
          name: row.name,
          category: row.category ?? row.categoria ?? null,
        };
      }
    }
  }

  return null;
}

async function consumeResearchItemCosts(userId, invRt, requirements, tx) {
  const itemCosts = normalizeItemCosts(requirements);
  if (itemCosts.length === 0) {
    return {
      touchedContainers: [],
      touchedSlots: [],
      consumedInstanceIds: [],
    };
  }

  const touchedContainers = new Set();
  const touchedSlots = new Map();
  const consumedInstanceIds = new Set();

  for (const cost of itemCosts) {
    const itemDef = await resolveCostItemDefFresh(invRt, cost);
    if (!itemDef) {
      throw Object.assign(new Error(`Research item cost not found: ${cost.itemCode ?? cost.itemDefId}`), {
        code: "RESEARCH_COST_ITEM_DEF_NOT_FOUND",
      });
    }

    const targetItemDefId = String(itemDef.id);
    const matchingSlots = [];
    let availableQty = 0;

    for (const container of invRt?.containers ?? []) {
      for (const slot of container?.slots ?? []) {
        const slotQty = Number(slot?.qty ?? 0);
        if (slotQty <= 0 || !slot?.itemInstanceId) continue;

        const itemInstance = invRt?.itemInstanceById?.get?.(String(slot.itemInstanceId)) ?? null;
        if (!itemInstance) continue;
        if (String(itemInstance.itemDefId) !== targetItemDefId) continue;

        availableQty += slotQty;
        matchingSlots.push({ container, slot, itemInstance });
      }
    }

    if (availableQty < cost.qty) {
      throw Object.assign(
        new Error(
          `Not enough ${itemDef.name ?? itemDef.code ?? cost.itemCode ?? "items"} (${availableQty}/${cost.qty})`
        ),
        {
          code: "RESEARCH_COST_NOT_ENOUGH_ITEMS",
          meta: {
            itemCode: itemDef.code ?? cost.itemCode ?? null,
            itemName: itemDef.name ?? null,
            have: availableQty,
            need: cost.qty,
          },
        }
      );
    }

    let remaining = cost.qty;
    for (const match of matchingSlots) {
      if (remaining <= 0) break;

      const currentQty = Number(match.slot.qty ?? 0);
      if (currentQty <= 0) continue;

      const consumeQty = Math.min(currentQty, remaining);
      if (consumeQty <= 0) continue;

      remaining -= consumeQty;
      const nextQty = currentQty - consumeQty;

      if (nextQty <= 0) {
        const consumedInstanceId = String(match.slot.itemInstanceId);
        match.slot.itemInstanceId = null;
        match.slot.qty = 0;
        consumedInstanceIds.add(consumedInstanceId);
        invRt?.itemInstanceById?.delete?.(consumedInstanceId);
      } else {
        match.slot.qty = nextQty;
      }

      const slotKey = `${match.container.id}:${match.slot.slotIndex}`;
      if (!touchedSlots.has(slotKey)) {
        touchedSlots.set(slotKey, {
          containerId: match.container.id,
          slotIndex: match.slot.slotIndex,
          slot: match.slot,
        });
      }
      touchedContainers.add(String(match.container.id));
    }
  }

  if (touchedSlots.size > 0) {
    await flush(
      invRt,
      {
        touchedContainers: Array.from(touchedContainers),
        touchedSlots: Array.from(touchedSlots.values()),
      },
      tx
    );
  }

  for (const id of consumedInstanceIds) {
    await db.GaItemInstance.destroy({
      where: { id: Number(id) },
      transaction: tx,
    });
  }

  return {
    touchedContainers: Array.from(touchedContainers),
    touchedSlots: Array.from(touchedSlots.values()),
    consumedInstanceIds: Array.from(consumedInstanceIds),
  };
}

module.exports = {
  consumeResearchItemCosts,
};
