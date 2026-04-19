import { GameCanvas } from "../scene/GameCanvas";
import { LoadingOverlay } from "@/components/overlays/LoadingOverlay";
import { InventoryModal } from "@/components/models/inventory/InventoryModal";
import { BuildModal } from "@/components/models/build/BuildModal";
import { ResearchModal } from "@/components/models/research/ResearchModal";
import { SkillsModal } from "@/components/models/skills/SkillsModal";
import { WorldClockPanel } from "@/world/ui/WorldClockPanel";
import { PlayerStatusPanel } from "@/world/ui/PlayerStatusPanel";

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
        buildPlacement={state.buildPlacement}
        inventorySnapshot={state.inventorySnapshot}
        onInputIntent={actions.handleInputIntent}
        onTargetSelect={actions.onTargetSelect}
        onTargetClear={actions.onTargetClear}
        onCancelBuild={actions.emitBuildCancel}
        onStartBuild={actions.emitBuildStart}
        onStartSleep={actions.emitSleepStart}
        onStopSleep={actions.emitSleepStop}
        onClearBuildPlacement={actions.clearBuildPlacement}
        lootNotifications={state.lootNotifications}
        worldNotifications={state.worldNotifications}
      />

      <WorldClockPanel worldClock={state.snapshot?.worldClock} />
      <PlayerStatusPanel
        snapshot={state.snapshot}
        researchSnapshot={state.snapshot?.research}
        inventorySnapshot={state.inventorySnapshot}
        equipmentSnapshot={state.equipmentSnapshot}
        onCancelBuild={actions.emitBuildCancel}
        onPauseBuild={actions.emitBuildPause}
        onResumeBuild={actions.emitBuildResume}
      />

      <InventoryModal
        open={state.inventoryOpen}
        snapshot={state.inventorySnapshot}
        researchSnapshot={state.snapshot?.research}
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
        onCraftRecipe={actions.onCraftRecipe}
        onClaimCraftJob={actions.onClaimCraftJob}
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

      <SkillsModal
        open={state.skillsOpen}
        snapshot={state.inventorySnapshot?.skills ?? state.snapshot?.skills ?? null}
        onClose={actions.closeSkills}
      />

      <BuildModal
        open={state.buildOpen}
        onClose={actions.closeBuild}
        onPlaceShelter={actions.beginBuildPlacement}
      />
    </>
  );
}
