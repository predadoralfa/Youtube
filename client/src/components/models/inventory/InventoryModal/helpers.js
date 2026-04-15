export function toId(raw) {
  return raw == null ? null : String(raw);
}

export function getDefIdFromInstance(inst) {
  return inst?.item_def_id ?? inst?.def_id ?? inst?.itemDefId ?? null;
}

export function getAllowedSlotsForDef(def) {
  const components = Array.isArray(def?.components) ? def.components : [];
  const equippable = components.find((component) => {
    const type = component?.componentType ?? component?.component_type;
    return type === "EQUIPPABLE";
  });

  const data = equippable?.dataJson ?? equippable?.data_json ?? null;
  const allowedSlots = Array.isArray(data?.allowedSlots) ? data.allowedSlots : [];
  return allowedSlots.map((slot) => String(slot)).filter(Boolean);
}

export function getItemLabel(inst, def) {
  if (!inst && !def) return "Unknown";
  if (def?.name) return def.name;
  if (def?.code) return def.code;
  return inst?.id != null ? `Instance ${inst.id}` : "Item";
}

export function buildInventoryIndex(snapshot) {
  const source = snapshot?.inventory ?? snapshot ?? null;
  const instances = source?.itemInstances || source?.item_instances || [];
  const defs = source?.itemDefs || source?.item_defs || [];
  const instanceMap = new Map();
  const defMap = new Map();

  for (const inst of instances) {
    const id = inst?.id ?? inst?.instance_id ?? inst?.itemInstanceId;
    if (id != null) instanceMap.set(String(id), inst);
  }

  for (const def of defs) {
    const id = def?.id ?? def?.def_id;
    if (id != null) defMap.set(String(id), def);
  }

  return { instanceMap, defMap };
}

export function buildEquipmentIndex(snapshot) {
  const source = snapshot?.equipment ?? snapshot ?? null;
  const slots = Array.isArray(source?.slots) ? source.slots : [];
  const slotMap = new Map();
  for (const slot of slots) {
    const code = slot?.slotCode ?? slot?.slot_code ?? null;
    if (code) slotMap.set(String(code), slot);
  }
  return slotMap;
}

export function clampSplitQty(raw, maxQty) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, Math.floor(n)), Math.max(1, maxQty));
}

export function formatWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function buildSlotList(slotCodes, equipmentIndex, fallbackKind) {
  return slotCodes.map((slotCode) => {
    const slot = equipmentIndex.get(slotCode) ?? null;
    const itemDef = slot?.item ?? null;
    return {
      slotCode,
      slotName: slot?.slotName ?? slotCode,
      slotKind: slot?.slotKind ?? fallbackKind,
      itemInstanceId: slot?.itemInstanceId ?? null,
      qty: Number(slot?.qty ?? 0),
      item: itemDef,
      itemDef,
      canEat: Boolean(
        itemDef &&
          (itemDef?.canEat ||
            ["FOOD", "CONSUMABLE"].includes(String(itemDef?.category ?? "").toUpperCase()) ||
            String(itemDef?.code ?? "").toUpperCase().startsWith("FOOD-"))
      ),
      sourceContainerId: slot?.sourceContainerId ?? null,
      sourceSlotIndex: slot?.sourceSlotIndex ?? null,
      sourceRole: slot?.sourceRole ?? slotCode,
    };
  });
}

export function getInventoryItemContext(inventoryIndex, itemInstanceId) {
  if (itemInstanceId == null) return null;
  const inst = inventoryIndex.instanceMap.get(String(itemInstanceId)) ?? null;
  if (!inst) return null;
  const defId = getDefIdFromInstance(inst);
  const def = defId != null ? inventoryIndex.defMap.get(String(defId)) ?? null : null;
  return { inst, def };
}

function findEdibleComponent(def) {
  const components = Array.isArray(def?.components) ? def.components : [];
  return (
    components.find(
      (component) => {
        const type = String(component?.componentType ?? component?.component_type ?? "").toUpperCase();
        return type === "EDIBLE" || type === "CONSUMABLE";
      }
    ) ?? null
  );
}

function hasRestoreHungerEffect(component) {
  const data = component?.dataJson ?? component?.data_json ?? null;
  const effects = Array.isArray(data?.effects) ? data.effects : [];
  return effects.some(
    (effect) => String(effect?.type ?? "").toUpperCase() === "RESTORE_HUNGER"
  );
}

function isFoodLikeCategory(def) {
  const category = String(def?.category ?? "").toUpperCase();
  if (category === "FOOD" || category === "CONSUMABLE") return true;
  return String(def?.code ?? "").toUpperCase().startsWith("FOOD-");
}

export function isFoodItem(inventoryIndex, itemInstanceId) {
  const ctx = getInventoryItemContext(inventoryIndex, itemInstanceId);
  const def = ctx?.def ?? null;
  if (!def || !isFoodLikeCategory(def)) return false;

  const edibleComponent = findEdibleComponent(def);
  if (!edibleComponent) return String(def?.category ?? "").toUpperCase() === "FOOD";

  return hasRestoreHungerEffect(edibleComponent);
}
