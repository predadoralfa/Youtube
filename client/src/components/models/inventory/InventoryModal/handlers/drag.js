export function createDragHandlers({
  dragItem,
  setDragItem,
  heldStateActive,
  equipmentIndex,
  setLocalNotice,
  dropHandledRef,
  onMoveInventoryItem,
  onSwapEquipmentSlots,
  onEquipItemToSlot,
  onDropItemToWorld,
}) {
  const clearDrag = () => setDragItem(null);

  const handleDragStart = (payload) => (event) => {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/json", JSON.stringify(payload));
      event.dataTransfer.setData("text/plain", String(payload.itemInstanceId));
      event.dataTransfer.setDragImage?.(event.currentTarget, 20, 20);
    }
    dropHandledRef.current = false;
    setDragItem(payload);
  };

  const handleInventoryDropHint = (slotCode) => (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    dropHandledRef.current = true;
    const raw = event.dataTransfer?.getData("application/json");
    if (!raw) return;

    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }

    if (!payload?.itemInstanceId) return;

    const sourceKind = payload.sourceKind || "inventory";
    const allowed = Array.isArray(payload.allowedSlots) ? payload.allowedSlots : [];
    if (sourceKind === "inventory" && !allowed.includes(String(slotCode))) {
      setLocalNotice(`Item not allowed in ${slotCode}`);
      clearDrag();
      return;
    }

    const slot = equipmentIndex.get(String(slotCode)) ?? null;
    const fromRole = payload.sourceRole ?? payload.fromSlotCode ?? null;
    const toRole = slot?.sourceRole ?? slotCode;
    const canLegacyMove =
      sourceKind === "legacy-inventory" &&
      fromRole != null &&
      payload.sourceSlotIndex != null &&
      toRole != null &&
      slot?.sourceSlotIndex != null;

    const ok = canLegacyMove
      ? onMoveInventoryItem?.({
          fromRole,
          fromSlotIndex: payload.sourceSlotIndex,
          toRole,
          toSlotIndex: slot.sourceSlotIndex,
          qty: 1,
        })
      : sourceKind === "equipment"
        ? onSwapEquipmentSlots?.({
            fromSlotCode: payload.fromSlotCode || payload.slotCode || null,
            toSlotCode: slotCode,
          })
        : slot?.itemInstanceId
          ? onSwapEquipmentSlots?.({
              fromSlotCode: payload.fromSlotCode || payload.slotCode || null,
              toSlotCode: slotCode,
            })
          : onEquipItemToSlot?.({
              itemInstanceId: payload.itemInstanceId,
              slotCode,
            });

    setLocalNotice(
      ok
        ? null
        : slot?.itemInstanceId
          ? "Equipment swap is not available right now"
          : "Equipment action is not available right now"
    );
    clearDrag();
  };

  const handleInventorySlotDrop = ({ containerId, slotIndex, role }) => (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    dropHandledRef.current = true;

    const raw = event.dataTransfer?.getData("application/json");
    if (!raw) return;

    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }

    if (!payload?.itemInstanceId) return;

    const fromRole = payload.sourceRole ?? payload.fromSlotCode ?? null;
    const fromSlotIndex = payload.sourceSlotIndex ?? null;
    const sourceContainerId = payload.sourceContainerId ?? null;
    const toRole = role;
    const toSlotIndex = slotIndex;
    const isSameTarget =
      String(sourceContainerId ?? "") === String(containerId) && Number(fromSlotIndex) === Number(slotIndex);

    if (!isSameTarget && fromRole != null && fromSlotIndex != null) {
      const ok = onMoveInventoryItem?.({
        fromRole,
        fromSlotIndex,
        toRole,
        toSlotIndex,
        qty: payload.qty == null ? 1 : Number(payload.qty),
      });
      setLocalNotice(ok ? null : "Inventory move is not available right now");
      clearDrag();
      return;
    }

    if (heldStateActive) {
      const ok = onPlaceHeldItem?.({ containerId, slotIndex });
      setLocalNotice(ok ? null : "Place is not available right now");
      clearDrag();
    }
  };

  const handleDropToWorld = () => {
    const pending = dragItem;
    dropHandledRef.current = true;
    clearDrag();
    if (!pending?.itemInstanceId) return;
    const ok = onDropItemToWorld?.(pending.itemInstanceId);
    setLocalNotice(ok ? null : "Drop is not available right now");
  };

  const handleDragEnd = () => {
    const pending = dragItem;
    clearDrag();

    if (!dropHandledRef.current && pending?.itemInstanceId) {
      const ok = onDropItemToWorld?.(pending.itemInstanceId);
      setLocalNotice(ok ? null : "Drop is not available right now");
    }

    dropHandledRef.current = false;
  };

  return {
    clearDrag,
    handleDragStart,
    handleInventoryDropHint,
    handleInventorySlotDrop,
    handleDropToWorld,
    handleDragEnd,
  };
}
