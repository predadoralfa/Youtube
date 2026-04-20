import { InventoryOverlays } from "../components/InventoryOverlays";
import { InventoryPanel } from "./InventoryPanel";
import { SidebarColumn } from "./SidebarColumn";

export function InventoryBody(props) {
  return (
    <div className="inv-body">
      {props.equipmentNoticeText ? (
        <div className={`inv-notice inv-notice--${props.equipmentNoticeTone || "neutral"}`}>
          <span className="inv-notice-text">{props.equipmentNoticeText}</span>
          <button
            type="button"
            className="inv-notice-close"
            onClick={() => {
              props.setLocalNotice(null);
              props.setDismissedNoticeText(props.equipmentNoticeText);
            }}
          >
            X
          </button>
        </div>
      ) : null}

      <InventoryOverlays
        heldStateActive={props.heldStateActive}
        cursorPos={props.cursorPos}
        heldPreviewLabel={props.heldPreviewLabel}
        heldPreviewQty={props.heldPreviewQty}
        heldState={props.heldState}
        contextMenu={props.contextMenu}
        setContextMenu={props.setContextMenu}
        splitDraft={props.splitDraft}
        setSplitDraft={props.setSplitDraft}
        splitInputRef={props.splitInputRef}
        submitSplit={props.submitSplit}
        openSplitModal={props.openSplitModal}
        handleContextEat={props.handleContextEat}
        handleContextMedicate={props.handleContextMedicate}
        handleContextDrop={props.handleContextDrop}
        handleContextRemove={props.handleContextRemove}
      />

      <div className="inv-layout">
      <InventoryPanel
          equipmentSnapshot={props.equipmentSnapshot}
          containers={props.containers}
          inventoryIndex={props.inventoryIndex}
          heldState={props.heldState}
          heldStateActive={props.heldStateActive}
          dragItem={props.dragItem}
          setCursorPos={props.setCursorPos}
          setContextMenu={props.setContextMenu}
          setSplitDraft={props.setSplitDraft}
          setLocalNotice={props.setLocalNotice}
          handleDragStart={props.handleDragStart}
          handleDragEnd={props.handleDragEnd}
          handleInventorySlotDrop={props.handleInventorySlotDrop}
          openContextMenu={props.openContextMenu}
          openContextMenuFromMouseDown={props.openContextMenuFromMouseDown}
          onPickupInventoryItem={props.onPickupInventoryItem}
          onPlaceHeldItem={props.onPlaceHeldItem}
          carryWeightCurrent={props.carryWeightCurrent}
          carryWeightMax={props.carryWeightMax}
          carryWeightPct={props.carryWeightPct}
          carryWeightTone={props.carryWeightTone}
        />

        <SidebarColumn
          handSlots={props.handSlots}
          dragItem={props.dragItem}
          heldStateActive={props.heldStateActive}
          isSlotCompatible={props.isSlotCompatible}
          handleDragStart={props.handleDragStart}
          handleDragEnd={props.handleDragEnd}
          handleInventoryDropHint={props.handleInventoryDropHint}
          handleEquipmentSlotMouseUp={props.handleEquipmentSlotMouseUp}
          openContextMenuFromMouseDown={props.openContextMenuFromMouseDown}
          activeSidebarTab={props.activeSidebarTab}
          setActiveSidebarTab={props.setActiveSidebarTab}
          wearSlotRows={props.wearSlotRows}
          selectedMacroFood={props.selectedMacroFood}
          selectedMacroFoodLabel={props.selectedMacroFoodLabel}
          macroFoodItemInstanceId={props.macroFoodItemInstanceId}
          macroHungerThreshold={props.macroHungerThreshold}
          hungerMax={props.hungerMax}
          macroUnlocked={props.macroUnlocked}
          equipmentUnlocked={props.equipmentUnlocked}
          craftRecipes={props.craftRecipes}
          onCraftRecipe={props.onCraftRecipe}
          onClaimCraftJob={props.onClaimCraftJob}
          setMacroHungerThreshold={props.setMacroHungerThreshold}
          setMacroFoodItemInstanceId={props.setMacroFoodItemInstanceId}
          onSetAutoFoodMacro={props.onSetAutoFoodMacro}
          setLocalNotice={props.setLocalNotice}
          handleMacroFoodDrop={props.handleMacroFoodDrop}
        />
      </div>
    </div>
  );
}
