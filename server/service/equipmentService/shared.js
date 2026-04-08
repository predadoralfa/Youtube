"use strict";

const EQUIPPABLE_COMPONENT = "EQUIPPABLE";

function normalizeAllowedSlots(componentData) {
  const allowedSlots = componentData?.allowedSlots;
  if (!Array.isArray(allowedSlots)) return [];
  return allowedSlots.map((slot) => String(slot)).filter(Boolean);
}

function pickEquippableComponent(itemDef) {
  const components = Array.isArray(itemDef?.components) ? itemDef.components : [];
  return components.find((component) => component.component_type === EQUIPPABLE_COMPONENT || component.componentType === EQUIPPABLE_COMPONENT) || null;
}

function extractEquipData(component) {
  const data = component?.data_json ?? component?.dataJson ?? null;
  return data && typeof data === "object" ? data : null;
}

function isItemAllowedInSlot(itemDef, slotCode) {
  const equippable = pickEquippableComponent(itemDef);
  if (!equippable) return false;

  const data = extractEquipData(equippable);
  const allowedSlots = normalizeAllowedSlots(data);
  return allowedSlots.includes(String(slotCode));
}

module.exports = {
  isItemAllowedInSlot,
};
