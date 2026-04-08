"use strict";

function findInventorySourceSlot(invRt, itemInstanceId) {
  const targetId = String(itemInstanceId);

  for (const container of invRt?.containers ?? []) {
    for (const slot of container?.slots ?? []) {
      if (String(slot?.itemInstanceId ?? "") !== targetId) continue;
      return { container, slot };
    }
  }

  return null;
}

function findEquipmentSourceSlot(eqRt, itemInstanceId) {
  const targetId = String(itemInstanceId);

  for (const [slotCode, equipped] of Object.entries(eqRt?.equipmentBySlotCode ?? {})) {
    if (!equipped) continue;

    const equippedItemInstanceId = String(
      equipped.itemInstanceId ?? equipped.itemInstance?.id ?? ""
    );
    if (equippedItemInstanceId !== targetId) continue;

    return {
      slotCode,
      equipped,
      qty: Number(equipped.qty ?? 1) || 1,
    };
  }

  return null;
}

module.exports = {
  findInventorySourceSlot,
  findEquipmentSourceSlot,
};
