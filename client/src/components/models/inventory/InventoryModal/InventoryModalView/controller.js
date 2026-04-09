import { createEquipmentHandlers } from "../handlers/equipment";
import { createDragHandlers } from "../handlers/drag";
import { createMenuHandlers } from "../handlers/menu";
import { createMacroHandlers } from "../handlers/macro";

export function createInventoryModalController(state, props) {
  const equipmentHandlers = createEquipmentHandlers({
    inventoryIndex: state.inventoryIndex,
    equipmentIndex: state.equipmentIndex,
    heldStateActive: state.heldStateActive,
    dragItem: state.dragItem,
    setCursorPos: state.setCursorPos,
    setContextMenu: state.setContextMenu,
    setSplitDraft: state.setSplitDraft,
    setLocalNotice: state.setLocalNotice,
    onPlaceHeldItem: props.onPlaceHeldItem,
    onPickupInventoryItem: props.onPickupInventoryItem,
    onUnequipItemFromSlot: props.onUnequipItemFromSlot,
  });

  const dragHandlers = createDragHandlers({
    dragItem: state.dragItem,
    setDragItem: state.setDragItem,
    equipmentIndex: state.equipmentIndex,
    setLocalNotice: state.setLocalNotice,
    dropHandledRef: state.dropHandledRef,
    onMoveInventoryItem: props.onMoveInventoryItem,
    onSwapEquipmentSlots: props.onSwapEquipmentSlots,
    onEquipItemToSlot: props.onEquipItemToSlot,
    onDropItemToWorld: props.onDropItemToWorld,
  });

  const menuHandlers = createMenuHandlers({
    heldStateActive: state.heldStateActive,
    contextMenu: state.contextMenu,
    setContextMenu: state.setContextMenu,
    splitDraft: state.splitDraft,
    setSplitDraft: state.setSplitDraft,
    setLocalNotice: state.setLocalNotice,
    handleUnequip: equipmentHandlers.handleUnequip,
    onSplitInventoryItem: props.onSplitInventoryItem,
    onDropItemToWorld: props.onDropItemToWorld,
  });

  const macroHandlers = createMacroHandlers({
    inventoryIndex: state.inventoryIndex,
    macroHungerThreshold: state.macroHungerThreshold,
    setMacroFoodItemInstanceId: state.setMacroFoodItemInstanceId,
    setLocalNotice: state.setLocalNotice,
    onSetAutoFoodMacro: props.onSetAutoFoodMacro,
    clearDrag: dragHandlers.clearDrag,
    dropHandledRef: state.dropHandledRef,
  });

  const requestCloseInventory = () => {
    if (state.splitDraft) return state.setSplitDraft(null);
    if (state.contextMenu) return state.setContextMenu(null);
    if (state.heldStateActive) return props.onCancelHeldState?.();
    props.onClose?.();
  };

  const closeFromBackdrop = (e) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    requestCloseInventory();
  };

  return {
    equipmentHandlers,
    dragHandlers,
    menuHandlers,
    macroHandlers,
    requestCloseInventory,
    closeFromBackdrop,
  };
}
