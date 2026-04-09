import { isFoodItem } from "../helpers";

export function createMacroHandlers({
  inventoryIndex,
  macroHungerThreshold,
  setMacroFoodItemInstanceId,
  setLocalNotice,
  onSetAutoFoodMacro,
  clearDrag,
  dropHandledRef,
}) {
  const handleMacroFoodDrop = (event) => {
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
    if (!isFoodItem(inventoryIndex, payload.itemInstanceId)) {
      setLocalNotice("Macro accepts only FOOD items");
      clearDrag();
      return;
    }

    const nextItemInstanceId = String(payload.itemInstanceId);
    setMacroFoodItemInstanceId(nextItemInstanceId);
    const ok = onSetAutoFoodMacro?.({
      itemInstanceId: nextItemInstanceId,
      hungerThreshold: macroHungerThreshold,
    });
    setLocalNotice(ok ? null : "Macro update is not available right now");
    clearDrag();
  };

  return { handleMacroFoodDrop };
}
