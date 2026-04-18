import { UsagePanel } from "../components/UsagePanel";
import { SidebarPanel } from "../components/SidebarPanel";

export function SidebarColumn(props) {
  return (
    <div className="inv-sidebar">
      <UsagePanel
        handSlots={props.handSlots}
        dragItem={props.dragItem}
        heldStateActive={props.heldStateActive}
        isSlotCompatible={props.isSlotCompatible}
        handleDragStart={props.handleDragStart}
        handleDragEnd={props.handleDragEnd}
        handleInventoryDropHint={props.handleInventoryDropHint}
        handleEquipmentSlotMouseUp={props.handleEquipmentSlotMouseUp}
        openContextMenuFromMouseDown={props.openContextMenuFromMouseDown}
      />

      <SidebarPanel
        activeSidebarTab={props.activeSidebarTab}
        setActiveSidebarTab={props.setActiveSidebarTab}
        wearSlotRows={props.wearSlotRows}
        dragItem={props.dragItem}
        heldStateActive={props.heldStateActive}
        isSlotCompatible={props.isSlotCompatible}
        handleDragStart={props.handleDragStart}
        handleDragEnd={props.handleDragEnd}
        handleInventoryDropHint={props.handleInventoryDropHint}
        handleEquipmentSlotMouseUp={props.handleEquipmentSlotMouseUp}
        selectedMacroFood={props.selectedMacroFood}
        selectedMacroFoodLabel={props.selectedMacroFoodLabel}
        macroFoodItemInstanceId={props.macroFoodItemInstanceId}
        macroHungerThreshold={props.macroHungerThreshold}
        hungerMax={props.hungerMax}
        macroUnlocked={props.macroUnlocked}
        equipmentUnlocked={props.equipmentUnlocked}
        setMacroHungerThreshold={props.setMacroHungerThreshold}
        setMacroFoodItemInstanceId={props.setMacroFoodItemInstanceId}
        onSetAutoFoodMacro={props.onSetAutoFoodMacro}
        setLocalNotice={props.setLocalNotice}
        handleMacroFoodDrop={props.handleMacroFoodDrop}
      />
    </div>
  );
}
