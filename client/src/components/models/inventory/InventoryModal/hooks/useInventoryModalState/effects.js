import { useEffect } from "react";

export function useInventoryModalEffects({
  open,
  splitDraft,
  contextMenu,
  heldStateActive,
  onCancelHeldState,
  onClose,
  setDragItem,
  setContextMenu,
  setSplitDraft,
  setLocalNotice,
  setDismissedNoticeText,
  hungerMax,
  serverAutoFood,
  macroFoodItemInstanceId,
  setMacroFoodItemInstanceId,
  setMacroHungerThreshold,
  isFoodItemAvailable,
  setCursorPos,
  splitInputRef,
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const k = e.key;
      if (k !== "Escape" && k !== "i" && k !== "I") return;
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      if (splitDraft) return setSplitDraft(null);
      if (contextMenu) return setContextMenu(null);
      if (heldStateActive) return onCancelHeldState?.();
      onClose?.();
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [open, splitDraft, contextMenu, heldStateActive, onCancelHeldState, onClose, setContextMenu, setSplitDraft]);

  useEffect(() => {
    if (!open) return;
    setDragItem(null);
    setContextMenu(null);
    setSplitDraft(null);
    setLocalNotice(null);
    setDismissedNoticeText(null);
  }, [open, setContextMenu, setDismissedNoticeText, setDragItem, setLocalNotice, setSplitDraft]);

  useEffect(() => {
    setMacroHungerThreshold((prev) => {
      const fallback = Math.min(60, hungerMax);
      return Math.min(Math.max(0, Number.isFinite(prev) ? prev : fallback), hungerMax);
    });
  }, [hungerMax, setMacroHungerThreshold]);

  useEffect(() => {
    setMacroFoodItemInstanceId(
      serverAutoFood?.itemInstanceId == null ? null : String(serverAutoFood.itemInstanceId)
    );
    setMacroHungerThreshold((prev) => {
      const next = Number(serverAutoFood?.hungerThreshold ?? Math.min(60, hungerMax));
      if (!Number.isFinite(next)) return prev;
      return Math.min(Math.max(0, next), hungerMax);
    });
  }, [serverAutoFood?.itemInstanceId, serverAutoFood?.hungerThreshold, hungerMax, setMacroFoodItemInstanceId, setMacroHungerThreshold]);

  useEffect(() => {
    if (!macroFoodItemInstanceId) return;
    if (!isFoodItemAvailable(macroFoodItemInstanceId)) {
      setMacroFoodItemInstanceId(null);
    }
  }, [macroFoodItemInstanceId, isFoodItemAvailable, setMacroFoodItemInstanceId]);

  useEffect(() => {
    if (!open) return;
    const handleMove = (event) => {
      setCursorPos({
        x: Number(event.clientX ?? 0),
        y: Number(event.clientY ?? 0),
      });
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("pointermove", handleMove);
    };
  }, [open, setCursorPos]);

  useEffect(() => {
    if (!open) return;
    const blockContextMenu = (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
    };
    window.addEventListener("contextmenu", blockContextMenu, { capture: true });
    return () => window.removeEventListener("contextmenu", blockContextMenu, { capture: true });
  }, [open]);

  useEffect(() => {
    if (!splitDraft) return;
    const timer = window.setTimeout(() => splitInputRef.current?.focus?.(), 0);
    return () => window.clearTimeout(timer);
  }, [splitDraft, splitInputRef]);
}
