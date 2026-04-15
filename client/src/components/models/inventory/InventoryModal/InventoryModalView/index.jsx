import "@/style/inventoryModal.css";
import { useInventoryModalState } from "../hooks/useInventoryModalState";
import { InventoryUnavailable } from "../components/InventoryUnavailable";
import { InventoryHeader } from "./InventoryHeader";
import { InventoryBody } from "./InventoryBody";
import { createInventoryModalController } from "./controller";

export function InventoryModal(props) {
  const state = useInventoryModalState(props);
  if (!props.open) return null;
  const controller = createInventoryModalController(state, props);

  if (!state.ok || !props.snapshot) {
    return (
      <InventoryUnavailable
        debug={state.debug}
        onClose={controller.requestCloseInventory}
        onBackdropClose={controller.closeFromBackdrop}
      />
    );
  }

  return (
    <div
      className="inv-backdrop"
      data-ui-block-game-input="true"
      onMouseDown={controller.closeFromBackdrop}
      onContextMenu={(e) => {
        e.preventDefault?.();
        e.stopPropagation?.();
      }}
      onDragOver={(e) => {
        if (state.dragItem) e.preventDefault?.();
      }}
      onDrop={(e) => {
        if (!state.dragItem) return;
        e.preventDefault?.();
        e.stopPropagation?.();
        controller.dragHandlers.handleDropToWorld();
      }}
    >
      <div
        className="inv-modal inv-modal--equipment"
        data-ui-block-game-input="true"
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault?.();
          e.stopPropagation?.();
        }}
      >
        <InventoryHeader onClose={controller.requestCloseInventory} />

        <InventoryBody
          equipmentNoticeText={state.equipmentNoticeText}
          setLocalNotice={state.setLocalNotice}
          setDismissedNoticeText={state.setDismissedNoticeText}
          cursorPos={state.cursorPos}
          heldPreviewLabel={state.heldPreviewLabel}
          heldPreviewQty={state.heldPreviewQty}
          heldState={state.heldState}
          heldStateActive={state.heldStateActive}
          contextMenu={state.contextMenu}
          setContextMenu={state.setContextMenu}
          splitDraft={state.splitDraft}
          setSplitDraft={state.setSplitDraft}
          splitInputRef={state.splitInputRef}
          submitSplit={controller.menuHandlers.submitSplit}
          openSplitModal={controller.menuHandlers.openSplitModal}
          handleContextEat={controller.menuHandlers.handleContextEat}
          handleContextDrop={controller.menuHandlers.handleContextDrop}
          handleContextRemove={controller.menuHandlers.handleContextRemove}
          containers={state.containers}
          inventoryIndex={state.inventoryIndex}
          dragItem={state.dragItem}
          setCursorPos={state.setCursorPos}
          handleDragStart={controller.dragHandlers.handleDragStart}
          handleDragEnd={controller.dragHandlers.handleDragEnd}
          openContextMenu={controller.menuHandlers.openContextMenu}
          openContextMenuFromMouseDown={controller.menuHandlers.openContextMenuFromMouseDown}
          onPickupInventoryItem={props.onPickupInventoryItem}
          onPlaceHeldItem={props.onPlaceHeldItem}
          carryWeightCurrent={state.carryWeightCurrent}
          carryWeightMax={state.carryWeightMax}
          carryWeightPct={state.carryWeightPct}
          carryWeightTone={state.carryWeightTone}
          handSlots={state.handSlots}
          isSlotCompatible={controller.equipmentHandlers.isSlotCompatible}
          handleInventoryDropHint={controller.dragHandlers.handleInventoryDropHint}
          handleEquipmentSlotMouseUp={controller.equipmentHandlers.handleEquipmentSlotMouseUp}
          activeSidebarTab={state.activeSidebarTab}
          setActiveSidebarTab={state.setActiveSidebarTab}
          wearSlotRows={state.wearSlotRows}
          selectedMacroFood={state.selectedMacroFood}
          selectedMacroFoodLabel={state.selectedMacroFoodLabel}
          macroFoodItemInstanceId={state.macroFoodItemInstanceId}
          macroHungerThreshold={state.macroHungerThreshold}
          hungerMax={state.hungerMax}
          setMacroHungerThreshold={state.setMacroHungerThreshold}
          setMacroFoodItemInstanceId={state.setMacroFoodItemInstanceId}
          onSetAutoFoodMacro={props.onSetAutoFoodMacro}
          handleMacroFoodDrop={controller.macroHandlers.handleMacroFoodDrop}
        />
      </div>
    </div>
  );
}
