import { createInventoryRegistry } from "./registry";
import { canonicalItemCode, normalizeIdentity } from "./normalize";

export function buildInventoryCounts(inventorySnapshot, equipmentSnapshot) {
  const registry = createInventoryRegistry();
  const inventorySource = inventorySnapshot?.inventory ?? inventorySnapshot ?? null;
  const inventoryDefs = Array.isArray(inventorySource?.itemDefs)
    ? inventorySource.itemDefs
    : Array.isArray(inventorySource?.item_defs)
      ? inventorySource.item_defs
      : [];
  const inventoryContainers = Array.isArray(inventorySource?.containers) ? inventorySource.containers : [];
  const inventoryInstances = Array.isArray(inventorySource?.itemInstances)
    ? inventorySource.itemInstances
    : Array.isArray(inventorySource?.item_instances)
      ? inventorySource.item_instances
      : [];

  for (const def of inventoryDefs) registry.registerDef(def);

  for (const container of inventoryContainers) {
    for (const slot of Array.isArray(container?.slots) ? container.slots : []) {
      const qty = Math.max(0, Number(slot?.qty ?? 0));
      const itemInstanceId = slot?.itemInstanceId != null ? String(slot.itemInstanceId) : null;
      if (!itemInstanceId || qty <= 0) continue;

      const instance =
        inventoryInstances.find(
          (entry) =>
            String(entry?.id ?? entry?.itemInstanceId ?? entry?.item_instance_id ?? "") === itemInstanceId
        ) ?? null;
      const itemDefId =
        instance?.itemDefId != null
          ? String(instance.itemDefId)
          : instance?.item_def_id != null
            ? String(instance.item_def_id)
            : null;
      if (!itemDefId) continue;

      const def = registry.defById.get(itemDefId) ?? null;
      const defLike = def ?? {
        id: itemDefId,
        itemDefId,
        code: instance?.code ?? instance?.itemCode ?? instance?.item_code ?? null,
        name: instance?.name ?? instance?.itemName ?? instance?.item_name ?? null,
      };

      registry.registerDef(defLike);
      registry.addCount(defLike, qty);
    }
  }

  const equipmentSources = [];
  const normalizedEquipmentSources = [
    equipmentSnapshot?.equipment ?? equipmentSnapshot ?? null,
    inventorySnapshot?.equipment ?? null,
  ].filter(Boolean);
  const seenSourceRefs = new Set();
  for (const source of normalizedEquipmentSources) {
    if (seenSourceRefs.has(source)) continue;
    seenSourceRefs.add(source);
    equipmentSources.push(source);
  }

  const countedEquipmentItemInstanceIds = new Set();
  for (const equipmentSource of equipmentSources) {
    const equipmentSlots = Array.isArray(equipmentSource?.slots) ? equipmentSource.slots : [];
    const equipmentInstances = Array.isArray(equipmentSource?.itemInstances)
      ? equipmentSource.itemInstances
      : Array.isArray(equipmentSource?.item_instances)
        ? equipmentSource.item_instances
        : [];
    const equipmentDefs = Array.isArray(equipmentSource?.itemDefs)
      ? equipmentSource.itemDefs
      : Array.isArray(equipmentSource?.item_defs)
        ? equipmentSource.item_defs
        : [];

    for (const def of equipmentDefs) registry.registerDef(def);

    for (const slot of equipmentSlots) {
      const itemInstanceId = slot?.itemInstanceId != null ? String(slot.itemInstanceId) : null;
      if (itemInstanceId) {
        if (countedEquipmentItemInstanceIds.has(itemInstanceId)) continue;
        countedEquipmentItemInstanceIds.add(itemInstanceId);
      }

      const qty = Math.max(0, Number(slot?.qty ?? (itemInstanceId != null ? 1 : 0)));
      if (qty <= 0) continue;

      const slotItem = slot?.item ?? null;
      const itemDefId =
        slotItem?.itemDefId != null
          ? String(slotItem.itemDefId)
          : slotItem?.item_def_id != null
            ? String(slotItem.item_def_id)
            : null;
      const itemCode = slotItem?.code != null ? canonicalItemCode(slotItem.code) : null;
      const itemName = slotItem?.name != null ? String(slotItem.name) : null;

      let defLike =
        (itemDefId && registry.defById.get(itemDefId)) ||
        (itemCode && registry.defByCode.get(itemCode)) ||
        (itemName && registry.defByName.get(normalizeIdentity(itemName))) ||
        null;

      if (!defLike && itemInstanceId != null) {
        const instance =
          equipmentInstances.find(
            (entry) =>
              String(entry?.id ?? entry?.itemInstanceId ?? entry?.item_instance_id ?? "") === itemInstanceId
          ) ??
          inventoryInstances.find(
            (entry) =>
              String(entry?.id ?? entry?.itemInstanceId ?? entry?.item_instance_id ?? "") === itemInstanceId
          ) ??
          null;
        const resolvedItemDefId =
          instance?.itemDefId != null
            ? String(instance.itemDefId)
            : instance?.item_def_id != null
              ? String(instance.item_def_id)
              : null;
        const resolvedCode = instance?.code != null ? canonicalItemCode(instance.code) : itemCode;
        const resolvedName = instance?.name ?? slotItem?.name ?? null;
        defLike =
          (resolvedItemDefId && registry.defById.get(resolvedItemDefId)) ||
          (resolvedCode && registry.defByCode.get(resolvedCode)) ||
          (resolvedName && registry.defByName.get(normalizeIdentity(resolvedName))) || {
            id: resolvedItemDefId ?? itemDefId ?? itemInstanceId,
            itemDefId: resolvedItemDefId ?? itemDefId ?? itemInstanceId,
            code: resolvedCode ?? itemCode ?? null,
            name: resolvedName,
          };
      }

      if (!defLike) continue;
      registry.registerDef(defLike);
      registry.addCount(defLike, qty);
    }
  }

  return {
    defById: registry.defById,
    defByCode: registry.defByCode,
    defByName: registry.defByName,
    countsByDefId: registry.countsByDefId,
    countsByCode: registry.countsByCode,
    countsByName: registry.countsByName,
  };
}
