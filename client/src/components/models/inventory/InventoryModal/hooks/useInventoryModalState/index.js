import { useInventoryModalBaseState } from "./baseState";
import { useInventoryModalDerivedState } from "./derived";
import { useInventoryModalEffects } from "./effects";

export function useInventoryModalState(props) {
  const state = useInventoryModalBaseState();
  const derived = useInventoryModalDerivedState({
    open: props.open,
    snapshot: props.snapshot,
    researchSnapshot: props.researchSnapshot,
    equipmentSnapshot: props.equipmentSnapshot,
    selfVitals: props.selfVitals,
    inventoryMessage: props.inventoryMessage,
    equipmentMessage: props.equipmentMessage,
    localNotice: state.localNotice,
    dismissedNoticeText: state.dismissedNoticeText,
    macroFoodItemInstanceId: state.macroFoodItemInstanceId,
  });

  useInventoryModalEffects({
    open: props.open,
    splitDraft: state.splitDraft,
    contextMenu: state.contextMenu,
    heldStateActive: derived.heldStateActive,
    onCancelHeldState: props.onCancelHeldState,
    onClose: props.onClose,
    setDragItem: state.setDragItem,
    setContextMenu: state.setContextMenu,
    setSplitDraft: state.setSplitDraft,
    setLocalNotice: state.setLocalNotice,
    setDismissedNoticeText: state.setDismissedNoticeText,
    hungerMax: derived.hungerMax,
    serverAutoFood: derived.serverAutoFood,
    macroFoodItemInstanceId: state.macroFoodItemInstanceId,
    setMacroFoodItemInstanceId: state.setMacroFoodItemInstanceId,
    setMacroHungerThreshold: state.setMacroHungerThreshold,
    isFoodItemAvailable: derived.isFoodItemAvailable,
    setCursorPos: state.setCursorPos,
    splitInputRef: state.splitInputRef,
  });

  return {
    ...state,
    ...derived,
  };
}
