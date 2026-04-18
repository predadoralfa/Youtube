import { SidebarTabs } from "./SidebarTabs";
import { EquipmentTab } from "./EquipmentTab";
import { MacroTab } from "./MacroTab";
import { PlaceholderTab } from "./PlaceholderTab";

export function SidebarPanel(props) {
  const macroLocked = props.activeSidebarTab === "macro" && !props.macroUnlocked;
  const equipmentLocked = props.activeSidebarTab === "equipment" && !props.equipmentUnlocked;

  return (
    <section className="inv-panel inv-panel--equipment">
      <SidebarTabs
        activeSidebarTab={props.activeSidebarTab}
        setActiveSidebarTab={props.setActiveSidebarTab}
      />

      {props.activeSidebarTab === "equipment" && !equipmentLocked ? (
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
      ) : props.activeSidebarTab === "equipment" ? (
        <PlaceholderTab
          activeSidebarTab={props.activeSidebarTab}
          message="Keep researching to unlock this feature."
        />
      ) : props.activeSidebarTab === "macro" && !macroLocked ? (
        <MacroTab
          dragItem={props.dragItem}
          selectedMacroFood={props.selectedMacroFood}
          selectedMacroFoodLabel={props.selectedMacroFoodLabel}
          macroFoodItemInstanceId={props.macroFoodItemInstanceId}
          macroHungerThreshold={props.macroHungerThreshold}
          hungerMax={props.hungerMax}
          macroUnlocked={props.macroUnlocked}
          setMacroHungerThreshold={props.setMacroHungerThreshold}
          setMacroFoodItemInstanceId={props.setMacroFoodItemInstanceId}
          onSetAutoFoodMacro={props.onSetAutoFoodMacro}
          setLocalNotice={props.setLocalNotice}
          handleMacroFoodDrop={props.handleMacroFoodDrop}
        />
      ) : props.activeSidebarTab === "macro" ? (
        <PlaceholderTab
          activeSidebarTab={props.activeSidebarTab}
          message="Keep researching to unlock this feature."
        />
      ) : (
        <PlaceholderTab activeSidebarTab={props.activeSidebarTab} />
      )}
    </section>
  );
}
