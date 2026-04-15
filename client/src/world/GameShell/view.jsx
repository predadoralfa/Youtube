import { GameCanvas } from "../scene/GameCanvas";
import { LoadingOverlay } from "@/components/overlays/LoadingOverlay";
import { InventoryModal } from "@/components/models/inventory/InventoryModal";
import { BuildModal } from "@/components/models/build/BuildModal";
import { ResearchModal } from "@/components/models/research/ResearchModal";
import { WorldClockPanel } from "@/world/ui/WorldClockPanel";

export function GameShellView({ state, actions }) {
  if (state.sessionReplaced) {
    return (
      <LoadingOverlay message="Sessão substituída: você entrou em outro lugar. Recarregue para continuar." />
    );
  }

  if (state.loading) return <LoadingOverlay message="Carregando mundo..." />;
  if (!state.snapshot) return <LoadingOverlay message="Falha ao carregar mundo" />;

  return (
    <>
      <GameCanvas
        snapshot={state.snapshot}
        worldClock={state.snapshot?.worldClock}
        worldStoreRef={state.worldStoreRef}
        onInputIntent={actions.handleInputIntent}
        onTargetSelect={actions.onTargetSelect}
        onTargetClear={actions.onTargetClear}
        lootNotifications={state.lootNotifications}
      />

      <WorldClockPanel worldClock={state.snapshot?.worldClock} />

      <InventoryModal
        open={state.inventoryOpen}
        snapshot={state.inventorySnapshot}
        equipmentSnapshot={state.equipmentSnapshot}
        selfVitals={state.selfVitals}
        inventoryMessage={state.inventoryMessage}
        equipmentMessage={state.equipmentMessage}
        onClose={actions.closeInventory}
        onCancelHeldState={actions.onCancelHeldState}
        onPickupInventoryItem={actions.onPickupInventoryItem}
        onPlaceHeldItem={actions.onPlaceHeldItem}
        onSplitInventoryItem={actions.onSplitInventoryItem}
        onMoveInventoryItem={actions.onMoveInventoryItem}
        onEquipItemToSlot={actions.onEquipItemToSlot}
        onUnequipItemFromSlot={actions.onUnequipItemFromSlot}
        onSwapEquipmentSlots={actions.onSwapEquipmentSlots}
        onDropItemToWorld={actions.emitInventoryDrop}
        onConsumeInventoryItem={actions.onConsumeInventoryItem}
        onSetAutoFoodMacro={actions.onSetAutoFoodMacro}
      />

      <ResearchModal
        open={state.researchOpen}
        snapshot={state.snapshot?.research}
        inventorySnapshot={state.inventorySnapshot}
        equipmentSnapshot={state.equipmentSnapshot}
        researchMessage={state.researchMessage}
        onClose={actions.closeResearch}
        onStartStudy={actions.emitResearchStart}
        onRequestInventoryFull={actions.requestInventoryFull}
      />

      <BuildModal open={state.buildOpen} onClose={actions.closeBuild} />
    </>
  );
}
