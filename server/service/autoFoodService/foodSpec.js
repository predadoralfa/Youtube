"use strict";

const db = require("../../models");
const { toFiniteNumber } = require("./shared");
const {
  normalizeItemDefRow,
  normalizeItemDefComponentRow,
} = require("../../state/inventory/loader/normalize");

function findSlotByItemInstance(invRt, itemInstanceId) {
  const target = String(itemInstanceId ?? "");
  if (!target) return null;

  for (const container of invRt?.containers ?? []) {
    for (const slot of container?.slots ?? []) {
      if (String(slot?.itemInstanceId ?? "") === target && Number(slot?.qty ?? 0) > 0) {
        return {
          container,
          slot,
        };
      }
    }
  }

  return null;
}

function findFoodLocation(invRt, equipmentRt, itemInstanceId) {
  const inventorySlotRef = findSlotByItemInstance(invRt, itemInstanceId);
  if (inventorySlotRef) {
    return {
      kind: "INVENTORY",
      ...inventorySlotRef,
    };
  }

  const target = String(itemInstanceId ?? "");
  if (!target) return null;

  for (const [slotCode, equipped] of Object.entries(equipmentRt?.equipmentBySlotCode ?? {})) {
    if (String(equipped?.itemInstanceId ?? "") !== target) continue;
    return {
      kind: "EQUIPMENT",
      slotCode,
      equipment: equipped,
    };
  }

  return null;
}

function getFoodItemInstance(invRt, equipmentRt, itemInstanceId) {
  const target = String(itemInstanceId ?? "");
  if (!target) return null;

  return (
    invRt?.itemInstanceById?.get?.(target) ??
    invRt?.itemInstancesById?.get?.(target) ??
    equipmentRt?.itemInstancesById?.get?.(target) ??
    null
  );
}

function findEdibleComponent(itemDef) {
  const components = Array.isArray(itemDef?.components) ? itemDef.components : [];
  return (
    components.find((component) => {
      const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
      return type === "EDIBLE" || type === "CONSUMABLE";
    }) ??
    null
  );
}

function isFoodLikeCategory(itemDef) {
  const category = String(itemDef?.category ?? "").toUpperCase();
  return category === "FOOD" || category === "CONSUMABLE";
}

async function ensureItemDefHydrated(invRt, equipmentRt, itemDefId) {
  const key = String(itemDefId ?? "");
  if (!key) return null;

  const invMap = invRt?.itemDefsById ?? null;
  const eqMap = equipmentRt?.itemDefsById ?? null;
  let itemDef = invMap?.get?.(key) ?? eqMap?.get?.(key) ?? null;
  const hasComponents = Array.isArray(itemDef?.components) && itemDef.components.length > 0;

  if (itemDef && hasComponents) return itemDef;

  const itemDefRow = await db.GaItemDef.findByPk(Number(key));
  if (!itemDefRow) return itemDef;

  const hydratedDef = normalizeItemDefRow(itemDefRow);
  const componentRows = await db.GaItemDefComponent.findAll({
    where: { item_def_id: Number(key) },
    order: [["id", "ASC"]],
  });
  hydratedDef.components = componentRows.map(normalizeItemDefComponentRow);

  invMap?.set?.(key, hydratedDef);
  eqMap?.set?.(key, hydratedDef);
  return hydratedDef;
}

async function getFoodSpec(invRt, equipmentRt, itemInstanceId) {
  const itemInstance = getFoodItemInstance(invRt, equipmentRt, itemInstanceId);
  if (!itemInstance) return null;

  let itemDef =
    invRt?.itemDefsById?.get?.(String(itemInstance.itemDefId)) ??
    equipmentRt?.itemDefsById?.get?.(String(itemInstance.itemDefId)) ??
    null;
  itemDef = itemDef ?? await ensureItemDefHydrated(invRt, equipmentRt, itemInstance.itemDefId);
  if (itemDef && (!Array.isArray(itemDef.components) || itemDef.components.length === 0)) {
    itemDef = await ensureItemDefHydrated(invRt, equipmentRt, itemInstance.itemDefId);
  }
  if (!itemDef || !isFoodLikeCategory(itemDef)) return null;

  const component = findEdibleComponent(itemDef);
  const data = component?.dataJson ?? component?.data_json ?? null;
  const effects = Array.isArray(data?.effects) ? data.effects : [];
  const restoreEffect =
    effects.find((effect) => String(effect?.type ?? "").toUpperCase() === "RESTORE_HUNGER") ?? null;

  if (!restoreEffect) return null;

  const slotRef = findFoodLocation(invRt, equipmentRt, itemInstanceId);
  if (!slotRef) return null;

  return {
    itemInstance,
    itemDef,
    component,
    slotRef,
    restoreHunger: Math.max(0, toFiniteNumber(restoreEffect.value, 0)),
    consumeTimeMs: Math.max(1000, toFiniteNumber(data?.consumeTimeMs, 60000)),
    cooldownMs: Math.max(0, toFiniteNumber(data?.cooldownMs, 0)),
  };
}

module.exports = {
  findFoodLocation,
  getFoodSpec,
};
