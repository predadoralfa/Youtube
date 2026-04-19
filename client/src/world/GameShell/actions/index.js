import { useMemo } from "react";
import { useGameShellRequestActions } from "./requests";
import { useGameShellInventoryActions } from "./inventory";
import { useGameShellTargetingActions } from "./targeting";
import { useGameShellIntentAction } from "./intent";

export function useGameShellActions(state) {
  const requestActions = useGameShellRequestActions(state);
  const inventoryActions = useGameShellInventoryActions(requestActions);
  const targetingActions = useGameShellTargetingActions(state);
  const handleInputIntent = useGameShellIntentAction(state, {
    requestInventoryFull: requestActions.requestInventoryFull,
    requestResearchFull: requestActions.requestResearchFull,
    closeBuild: targetingActions.closeBuild,
    closeResearch: targetingActions.closeResearch,
    closeInventory: targetingActions.closeInventory,
    closeSkills: targetingActions.closeSkills,
    emitInteractStart: targetingActions.emitInteractStart,
    emitInteractStop: targetingActions.emitInteractStop,
  });

  return useMemo(
    () => ({
      ...requestActions,
      ...inventoryActions,
      ...targetingActions,
      handleInputIntent,
    }),
    [
      requestActions.requestInventoryFull,
      requestActions.requestResearchFull,
      requestActions.emitEquipmentAction,
      requestActions.emitInventoryAction,
      requestActions.emitInventoryDrop,
      requestActions.emitResearchStart,
      inventoryActions.onPickupInventoryItem,
      inventoryActions.onPlaceHeldItem,
      inventoryActions.onSplitInventoryItem,
      inventoryActions.onMoveInventoryItem,
      inventoryActions.onCancelHeldState,
      inventoryActions.onSetAutoFoodMacro,
      inventoryActions.onEquipItemToSlot,
      inventoryActions.onUnequipItemFromSlot,
      inventoryActions.onSwapEquipmentSlots,
      targetingActions.emitInteractStart,
      targetingActions.emitInteractStop,
      targetingActions.closeInventory,
      targetingActions.closeResearch,
      targetingActions.closeBuild,
      targetingActions.closeSkills,
      targetingActions.onTargetSelect,
      targetingActions.onTargetClear,
      handleInputIntent,
    ]
  );
}
