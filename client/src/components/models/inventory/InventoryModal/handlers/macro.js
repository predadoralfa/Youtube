import { isFoodItemInSnapshots } from "../helpers";

export function createMacroHandlers({
  inventoryIndex,
  equipmentSnapshot,
  macroHungerThreshold,
  setMacroFoodItemInstanceId,
  setLocalNotice,
  onSetAutoFoodMacro,
  clearDrag,
  dropHandledRef,
  }) {
  const applyMacroFoodSelection = (itemInstanceId) => {
    if (itemInstanceId == null) {
      setLocalNotice("Macro item is not available right now");
      return false;
    }

    if (
      !isFoodItemInSnapshots({
        inventoryIndex,
        equipmentSnapshot,
        itemInstanceId,
      })
    ) {
      setLocalNotice("Macro accepts only FOOD items");
      return false;
    }

    const nextItemInstanceId = String(itemInstanceId);
    setMacroFoodItemInstanceId(nextItemInstanceId);
    const ok = onSetAutoFoodMacro?.({
      itemInstanceId: nextItemInstanceId,
      hungerThreshold: macroHungerThreshold,
    });
    setLocalNotice(ok ? null : "Macro update is not available right now");
    return ok;
  };

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
    const ok = applyMacroFoodSelection(payload.itemInstanceId);
    clearDrag();
  };

  const handleMacroFoodHeldSelect = (itemInstanceId) => applyMacroFoodSelection(itemInstanceId);

  return { handleMacroFoodDrop, handleMacroFoodHeldSelect };
}
