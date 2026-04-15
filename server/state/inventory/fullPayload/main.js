"use strict";

const { buildEquipmentFull } = require("../../equipment/fullPayload");
const { getRuntime } = require("../../runtime/store");
const { computeCarryWeight } = require("../weight");

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

function hasRestoreHungerEffect(def) {
  const components = Array.isArray(def?.components) ? def.components : [];
  return components.some((component) => {
    const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
    if (type !== "EDIBLE" && type !== "CONSUMABLE") return false;
    const data = component?.dataJson ?? component?.data_json ?? null;
    const effects = Array.isArray(data?.effects) ? data.effects : [];
    return effects.some((effect) => String(effect?.type ?? "").toUpperCase() === "RESTORE_HUNGER");
  });
}

function isFoodDef(def) {
  const category = String(def?.category ?? "").toUpperCase();
  if (category !== "FOOD" && category !== "CONSUMABLE") {
    return String(def?.code ?? "").toUpperCase().startsWith("FOOD-");
  }
  return hasRestoreHungerEffect(def) || category === "FOOD";
}

function buildItemDefPayload(def) {
  return {
    id: String(def.id),
    code: def.code,
    name: def.name,
    category: def.category ?? null,
    weight: def.weight ?? null,
    stackMax: def.stackMax ?? 1,
    canEat: isFoodDef(def),
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

function buildItemInstanceSummary(invRt, itemInstanceId) {
  if (!itemInstanceId) return null;

  const instanceMap = invRt.itemInstanceById || invRt.itemInstancesById;
  const inst = instanceMap?.get(String(itemInstanceId)) || instanceMap?.get(Number(itemInstanceId)) || null;
  if (!inst) return null;

  const def = invRt.itemDefsById?.get(String(inst.itemDefId)) || invRt.itemDefsById?.get(Number(inst.itemDefId)) || null;

  return {
    itemInstanceId: String(inst.id),
    itemDefId: String(inst.itemDefId),
    code: def?.code ?? null,
    name: def?.name ?? null,
    category: def?.category ?? null,
    stackMax: def?.stackMax ?? 1,
    durability: inst.durability ?? null,
  };
}

function isLegacyHandRole(slotRole) {
  return slotRole === "HAND_L" || slotRole === "HAND_R";
}

function buildInventoryFull(invRt, equipmentRt = null) {
  if (!invRt || !invRt.userId) {
    return { ok: false, error: "INVENTORY_NOT_LOADED" };
  }

  const containers = invRt.containers ?? [];
  const inventoryContainers = containers.filter((c) => !isLegacyHandRole(c.slotRole));
  const legacyHandContainers = containers.filter((c) => isLegacyHandRole(c.slotRole));

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

  const referencedInstanceIds = uniq(
    [...inventoryContainers, ...legacyHandContainers]
      .flatMap((c) => c.slots ?? [])
      .map((s) => s.itemInstanceId)
      .filter((id) => id != null)
      .map((id) => String(id))
  );

  const heldState = invRt.heldState ?? null;
  if (heldState?.itemInstanceId != null) {
    referencedInstanceIds.push(String(heldState.itemInstanceId));
  }

  const normalizedReferencedInstanceIds = uniq(referencedInstanceIds);
  const instanceMap = invRt.itemInstanceById || invRt.itemInstancesById;

  const itemInstances = normalizedReferencedInstanceIds
    .map((id) => instanceMap?.get(id) || instanceMap?.get(Number(id)))
    .filter(Boolean);

  const itemInstancesPayload = stableSortBy(itemInstances, (it) => String(it.id)).map((it) => ({
    id: String(it.id),
    itemDefId: String(it.itemDefId),
    durability: it.durability ?? null,
    meta: it.meta ?? it.props ?? it.props_json ?? null,
  }));

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

  if (process.env.NODE_ENV !== "production") {
    const defById = new Map(itemDefsPayload.map((def) => [String(def.id), def]));
    for (const inst of itemInstancesPayload) {
      if (String(inst.itemInstanceId) !== "103") continue;
      const def = defById.get(String(inst.itemDefId)) ?? null;
      console.log("[INV][FULL] item snapshot", {
        itemInstanceId: inst.itemInstanceId,
        itemDefId: inst.itemDefId,
        code: def?.code ?? null,
        name: def?.name ?? null,
        category: def?.category ?? null,
        canEat: def?.canEat ?? null,
        components: Array.isArray(def?.components) ? def.components.map((c) => c.componentType ?? null) : [],
      });
    }
  }

  const heldStatePayload = heldState
    ? {
        mode: heldState.mode ?? "PICK",
        sourceContainerId: heldState.sourceContainerId != null ? String(heldState.sourceContainerId) : null,
        sourceSlotIndex:
          heldState.sourceSlotIndex != null ? Number(heldState.sourceSlotIndex) : null,
        sourceItemInstanceId:
          heldState.sourceItemInstanceId != null ? String(heldState.sourceItemInstanceId) : null,
        sourceQtyBefore:
          heldState.sourceQtyBefore != null ? Number(heldState.sourceQtyBefore) : null,
        sourceQtyAfter:
          heldState.sourceQtyAfter != null ? Number(heldState.sourceQtyAfter) : null,
        itemInstanceId:
          heldState.itemInstanceId != null ? String(heldState.itemInstanceId) : null,
        itemDefId: heldState.itemDefId != null ? String(heldState.itemDefId) : null,
        qty: heldState.qty != null ? Number(heldState.qty) : 0,
        createdAtMs: heldState.createdAtMs ?? null,
        item: buildItemInstanceSummary(invRt, heldState.itemInstanceId),
      }
    : null;

  const equipment = equipmentRt && equipmentRt.userId ? buildEquipmentFull(equipmentRt, invRt) : null;
  const research = getRuntime(invRt?.userId)?.research ?? null;
  const computedCarryWeight = computeCarryWeight(invRt, equipmentRt, research);
  const carryWeightMax = computedCarryWeight.max;
  const carryWeightCurrent = computedCarryWeight.current;
  const carryWeightRatio = carryWeightMax > 0 ? carryWeightCurrent / carryWeightMax : 0;

  invRt.carryWeightCurrent = carryWeightCurrent;
  invRt.carryWeightRatio = carryWeightRatio;
  invRt.carryWeightPercent = Math.min(100, Math.max(0, carryWeightRatio * 100));
  invRt.carryWeightMax = carryWeightMax;

  return {
    ok: true,
    containers: containersPayload,
    itemInstances: itemInstancesPayload,
    itemDefs: itemDefsPayload,
    heldState: heldStatePayload,
    carryWeight: {
      current: carryWeightCurrent,
      max: carryWeightMax,
      ratio: carryWeightRatio,
      percent:
        carryWeightMax > 0 ? Math.min(100, Math.max(0, carryWeightRatio * 100)) : 0,
      isOverCapacity: carryWeightMax > 0 ? carryWeightCurrent > carryWeightMax : false,
    },
    equipment,
  };
}

module.exports = {
  buildInventoryFull,
};
