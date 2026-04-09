import { SidebarTabs } from "./SidebarTabs";
import { EquipmentTab } from "./EquipmentTab";
import { MacroTab } from "./MacroTab";
import { PlaceholderTab } from "./PlaceholderTab";

export function SidebarPanel(props) {
  return (
    <section className="inv-panel inv-panel--equipment">
      <SidebarTabs
        activeSidebarTab={props.activeSidebarTab}
        setActiveSidebarTab={props.setActiveSidebarTab}
      />

      {props.activeSidebarTab === "equipment" ? (
        <EquipmentTab
          wearSlotRows={props.wearSlotRows}
          dragItem={props.dragItem}
          heldStateActive={props.heldStateActive}
          isSlotCompatible={props.isSlotCompatible}
          handleDragStart={props.handleDragStart}
          handleDragEnd={props.handleDragEnd}
          handleInventoryDropHint={props.handleInventoryDropHint}
          handleEquipmentSlotMouseUp={props.handleEquipmentSlotMouseUp}
        />
      ) : props.activeSidebarTab === "macro" ? (
        <MacroTab
          dragItem={props.dragItem}
          selectedMacroFood={props.selectedMacroFood}
          selectedMacroFoodLabel={props.selectedMacroFoodLabel}
          macroFoodItemInstanceId={props.macroFoodItemInstanceId}
          macroHungerThreshold={props.macroHungerThreshold}
          hungerMax={props.hungerMax}
          setMacroHungerThreshold={props.setMacroHungerThreshold}
          setMacroFoodItemInstanceId={props.setMacroFoodItemInstanceId}
          onSetAutoFoodMacro={props.onSetAutoFoodMacro}
          setLocalNotice={props.setLocalNotice}
          handleMacroFoodDrop={props.handleMacroFoodDrop}
        />
      ) : (
        <PlaceholderTab activeSidebarTab={props.activeSidebarTab} />
      )}
    </section>
  );
}
