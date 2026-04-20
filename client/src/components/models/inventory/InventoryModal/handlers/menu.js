import { clampSplitQty } from "../helpers";

export function createMenuHandlers({
  heldStateActive,
  contextMenu,
  setContextMenu,
  splitDraft,
  setSplitDraft,
  setLocalNotice,
  handleUnequip,
  onSplitInventoryItem,
  onDropItemToWorld,
  onConsumeInventoryItem,
  onMedicateInventoryItem,
}) {
  const resolveItemDef = (slotCtx) => slotCtx?.itemDef ?? slotCtx?.item ?? null;

  const openContextMenu = (slotCtx, event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    const containerId = slotCtx?.containerId ?? slotCtx?.sourceContainerId ?? null;
    const slotIndex = slotCtx?.slotIndex ?? slotCtx?.sourceSlotIndex ?? null;
    const itemDef = resolveItemDef(slotCtx);
    const stackMax = Number(itemDef?.stackMax ?? slotCtx?.item?.stackMax ?? 1);
    const canSplit = Boolean(stackMax > 1 && Number(slotCtx?.qty ?? 0) > 1);
    if (heldStateActive || !slotCtx?.itemInstanceId) return;

    const maxX = window.innerWidth - 180;
    const maxY = window.innerHeight - 140;
    setContextMenu({
      x: Math.max(12, Math.min(event.clientX, maxX)),
      y: Math.max(12, Math.min(event.clientY, maxY)),
      slot: {
        ...slotCtx,
        containerId,
        slotIndex,
        canSplit,
      },
    });
    setSplitDraft(null);
  };

  const openContextMenuFromMouseDown = (slotCtx, event) => {
    if (event.button !== 2) return false;
    event.preventDefault?.();
    event.stopPropagation?.();
    if (heldStateActive || !slotCtx?.itemInstanceId) return true;
    openContextMenu(slotCtx, event);
    return true;
  };

  const openSplitModal = () => {
    if (!contextMenu?.slot) return;
    const slot = contextMenu.slot;
    const qty = Number(slot.qty ?? 0);
    const defaultQty = qty > 2 ? Math.max(1, Math.floor(qty / 2)) : 1;
    setSplitDraft({
      slot,
      qtyText: String(clampSplitQty(defaultQty, Math.max(1, qty - 1))),
      error: null,
    });
    setContextMenu(null);
  };

  const submitSplit = () => {
    if (!splitDraft?.slot) return;
    const slot = splitDraft.slot;
    const containerId = slot?.containerId ?? slot?.sourceContainerId ?? null;
    const slotIndex = slot?.slotIndex ?? slot?.sourceSlotIndex ?? null;
    const qtyCurrent = Number(slot.qty ?? 0);
    const qty = clampSplitQty(splitDraft.qtyText, Math.max(1, qtyCurrent - 1));

    if (!Number.isInteger(qty) || qty < 1 || qty >= qtyCurrent) {
      setSplitDraft((prev) =>
        prev
          ? {
              ...prev,
              error: `Split qty must be between 1 and ${Math.max(1, qtyCurrent - 1)}`,
            }
          : prev
      );
      return;
    }

    const ok = onSplitInventoryItem?.({ containerId, slotIndex, qty });
    if (!ok) {
      setLocalNotice("Split is not available right now");
      return;
    }

    setSplitDraft(null);
    setLocalNotice(null);
  };

  const handleContextDrop = () => {
    const slot = contextMenu?.slot;
    setContextMenu(null);
    setSplitDraft(null);
    const ok = slot?.itemInstanceId ? onDropItemToWorld?.(slot.itemInstanceId) : false;
    setLocalNotice(ok ? null : "Drop is not available right now");
  };

  const handleContextEat = () => {
    const slot = contextMenu?.slot;
    setContextMenu(null);
    setSplitDraft(null);
    const ok = slot?.itemInstanceId ? onConsumeInventoryItem?.({ itemInstanceId: slot.itemInstanceId }) : false;
    setLocalNotice(ok ? null : "Eat is not available right now");
  };

  const handleContextMedicate = () => {
    const slot = contextMenu?.slot;
    setContextMenu(null);
    setSplitDraft(null);
    const ok = slot?.itemInstanceId ? onMedicateInventoryItem?.({ itemInstanceId: slot.itemInstanceId }) : false;
    setLocalNotice(ok ? null : "Medicate is not available right now");
  };

  const handleContextRemove = () => {
    const slot = contextMenu?.slot;
    setContextMenu(null);
    setSplitDraft(null);
    if (!slot?.slotCode) return;
    const ok = handleUnequip(slot.slotCode);
    if (!ok) {
      setLocalNotice("Equipment action is not available right now");
    }
  };

  return {
    contextMenu,
    openContextMenu,
    openContextMenuFromMouseDown,
    openSplitModal,
    submitSplit,
    handleContextDrop,
    handleContextEat,
    handleContextMedicate,
    handleContextRemove,
  };
}
