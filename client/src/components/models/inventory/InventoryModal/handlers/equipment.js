import { getAllowedSlotsForDef, getDefIdFromInstance } from "../helpers";

export function createEquipmentHandlers({
  inventoryIndex,
  equipmentIndex,
  heldStateActive,
  dragItem,
  setCursorPos,
  setContextMenu,
  setSplitDraft,
  setLocalNotice,
  onPlaceHeldItem,
  onPickupInventoryItem,
  onUnequipItemFromSlot,
}) {
  const isSlotCompatible = (itemInstanceId, slotCode) => {
    const inst = inventoryIndex.instanceMap.get(String(itemInstanceId));
    if (!inst) return false;
    const defId = getDefIdFromInstance(inst);
    const def = defId != null ? inventoryIndex.defMap.get(String(defId)) : null;
    if (!def) return false;
    return getAllowedSlotsForDef(def).includes(String(slotCode));
  };

  const handleUnequip = (slotCode) => {
    const ok = onUnequipItemFromSlot?.({ slotCode });
    if (!ok) {
      setLocalNotice("Equipment action is not available right now");
      return false;
    }
    setLocalNotice(null);
    return true;
  };

  const handleEquipmentSlotMouseUp = (slot, occupied) => (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault?.();
    event.stopPropagation?.();

    setCursorPos({
      x: Number(event.clientX ?? 0),
      y: Number(event.clientY ?? 0),
    });

    if (dragItem) return;
    if (slot.sourceContainerId == null || slot.sourceSlotIndex == null) return;

    if (heldStateActive) {
      const ok = onPlaceHeldItem?.({
        containerId: slot.sourceContainerId,
        slotIndex: slot.sourceSlotIndex,
      });
      setLocalNotice(ok ? null : "Place is not available right now");
      return;
    }

    if (!occupied) return;

    const ok = onPickupInventoryItem?.({
      containerId: slot.sourceContainerId,
      slotIndex: slot.sourceSlotIndex,
    });
    setLocalNotice(ok ? null : "Pickup is not available right now");
  };

  const buildDragPayload = (itemInstanceId, slotCode, options = {}) => {
    const inst = inventoryIndex.instanceMap.get(String(itemInstanceId)) ?? null;
    const defId = getDefIdFromInstance(inst);
    const def = defId != null ? inventoryIndex.defMap.get(String(defId)) ?? null : null;
    const allowedSlots = getAllowedSlotsForDef(def);
    const sourceKind =
      options.sourceKind ??
      (equipmentIndex.get(String(slotCode))?.sourceContainerId != null
        ? "legacy-inventory"
        : equipmentIndex.has(String(slotCode))
          ? "equipment"
          : "inventory");

    return {
      itemInstanceId: String(itemInstanceId),
      fromSlotCode: String(slotCode),
      sourceKind,
      sourceContainerId:
        options.sourceContainerId ?? equipmentIndex.get(String(slotCode))?.sourceContainerId ?? null,
      sourceSlotIndex:
        options.sourceSlotIndex ?? equipmentIndex.get(String(slotCode))?.sourceSlotIndex ?? null,
      sourceRole: options.sourceRole ?? equipmentIndex.get(String(slotCode))?.sourceRole ?? String(slotCode),
      allowedSlots,
      itemCategory: def?.category ?? null,
      itemName: def?.name ?? def?.code ?? (inst?.id != null ? `Instance ${inst.id}` : "Item"),
    };
  };

  const resetTransientUi = () => {
    setContextMenu(null);
    setSplitDraft(null);
  };

  return {
    isSlotCompatible,
    handleUnequip,
    handleEquipmentSlotMouseUp,
    buildDragPayload,
    resetTransientUi,
  };
}
