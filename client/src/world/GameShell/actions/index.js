import { useMemo } from "react";
import { useGameShellRequestActions } from "./requests";
import { useGameShellInventoryActions } from "./inventory";
import { useGameShellTargetingActions } from "./targeting";
import { useGameShellBuildActions } from "./build";
import { useGameShellSleepActions } from "./sleep";
import { useGameShellIntentAction } from "./intent";

export function useGameShellActions(state) {
  const requestActions = useGameShellRequestActions(state);
  const inventoryActions = useGameShellInventoryActions(requestActions);
  const targetingActions = useGameShellTargetingActions(state);
  const buildActions = useGameShellBuildActions(state);
  const sleepActions = useGameShellSleepActions(state, targetingActions.emitInteractStart);
  const handleInputIntent = useGameShellIntentAction(state, {
    requestInventoryFull: requestActions.requestInventoryFull,
    requestResearchFull: requestActions.requestResearchFull,
    closeBuild: targetingActions.closeBuild,
    closeResearch: targetingActions.closeResearch,
    closeInventory: targetingActions.closeInventory,
    closeSkills: targetingActions.closeSkills,
    emitInteractStart: targetingActions.emitInteractStart,
    emitInteractStop: targetingActions.emitInteractStop,
    clearBuildPlacement: buildActions.clearBuildPlacement,
    emitBuildPlace: buildActions.emitBuildPlace,
    emitBuildCancel: buildActions.emitBuildCancel,
    emitBuildPause: buildActions.emitBuildPause,
    emitBuildResume: buildActions.emitBuildResume,
    emitBuildDepositMaterial: buildActions.emitBuildDepositMaterial,
    emitSleepStop: sleepActions.emitSleepStop,
  });

  return useMemo(
    () => ({
      ...requestActions,
      ...inventoryActions,
      ...targetingActions,
      ...buildActions,
      ...sleepActions,
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
      inventoryActions.onConsumeInventoryItem,
      inventoryActions.onMedicateInventoryItem,
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
      buildActions.clearBuildPlacement,
      buildActions.emitBuildPlace,
      buildActions.emitBuildCancel,
      buildActions.emitBuildPause,
      buildActions.emitBuildResume,
      buildActions.emitBuildDepositMaterial,
      buildActions.beginBuildPlacement,
      sleepActions.emitSleepStart,
      sleepActions.emitSleepStop,
      handleInputIntent,
    ]
  );
}
