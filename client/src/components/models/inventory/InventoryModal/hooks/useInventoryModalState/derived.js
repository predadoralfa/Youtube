import { useMemo } from "react";
import { HANDS_SLOT_ORDER, WEAR_SLOT_ORDER, WEAR_SLOT_ROWS } from "../../constants";
import {
  buildEquipmentIndex,
  buildInventoryIndex,
  buildSlotList,
  formatWeight,
  getInventoryItemContext,
  getItemLabel,
  isFoodItem,
} from "../../helpers";

function resolveNoticeTone(text) {
  const value = String(text ?? "").toLowerCase();
  if (!value) return "neutral";

  if (
    value.includes("carry weight") ||
    value.includes("weight limit") ||
    value.includes("peso") ||
    value.includes("limite de peso")
  ) {
    return "warn";
  }

  if (
    value.includes("error") ||
    value.includes("falha") ||
    value.includes("invalid") ||
    value.includes("not found") ||
    value.includes("não") ||
    value.includes("nao")
  ) {
    return "danger";
  }

  return "neutral";
}

export function useInventoryModalDerivedState({
  open,
  snapshot,
  researchSnapshot,
  equipmentSnapshot,
  selfVitals,
  inventoryMessage,
  equipmentMessage,
  localNotice,
  dismissedNoticeText,
  macroFoodItemInstanceId,
}) {
  const heldState = snapshot?.heldState ?? null;
  const heldStateActive = Boolean(heldState);
  const ok = snapshot?.ok === true;
  const inventoryIndex = useMemo(() => buildInventoryIndex(snapshot), [snapshot]);
  const equipmentIndex = useMemo(() => buildEquipmentIndex(equipmentSnapshot), [equipmentSnapshot]);
  const wearSlots = useMemo(
    () => buildSlotList(WEAR_SLOT_ORDER, equipmentIndex, "WEAR"),
    [equipmentIndex]
  );
  const wearSlotRows = useMemo(
    () =>
      WEAR_SLOT_ROWS.map((row) =>
        row.map((slotCode) => wearSlots.find((slot) => slot.slotCode === slotCode)).filter(Boolean)
      ),
    [wearSlots]
  );
  const handSlots = useMemo(
    () => buildSlotList(HANDS_SLOT_ORDER, equipmentIndex, "USAGE"),
    [equipmentIndex]
  );
  const handItemCounts = useMemo(() => {
    const counts = new Map();
    for (const slot of handSlots) {
      const itemDefId =
        slot?.itemDef?.id ??
        slot?.itemDef?.itemDefId ??
        slot?.itemDef?.item_def_id ??
        slot?.item?.id ??
        slot?.item?.itemDefId ??
        slot?.item?.item_def_id ??
        null;
      const qty = Number(slot?.qty ?? 0);
      if (itemDefId == null || qty <= 0) continue;
      const key = String(itemDefId);
      counts.set(key, (counts.get(key) ?? 0) + qty);
    }
    return counts;
  }, [handSlots]);

  const hungerCurrent = Number(selfVitals?.hunger?.current ?? 0);
  const hungerMax = Math.max(0, Number(selfVitals?.hunger?.max ?? 100)) || 100;
  const serverAutoFood = snapshot?.macro?.autoFood ?? null;

  const debug = useMemo(() => {
    const keys = snapshot && typeof snapshot === "object" ? Object.keys(snapshot) : [];
    const containersLen = Array.isArray(snapshot?.containers) ? snapshot.containers.length : null;
    const instancesLen = Array.isArray(snapshot?.itemInstances)
      ? snapshot.itemInstances.length
      : Array.isArray(snapshot?.item_instances)
        ? snapshot.item_instances.length
        : null;
    const defsLen = Array.isArray(snapshot?.itemDefs)
      ? snapshot.itemDefs.length
      : Array.isArray(snapshot?.item_defs)
        ? snapshot.item_defs.length
        : null;

    return {
      open,
      snapshotType: snapshot == null ? String(snapshot) : typeof snapshot,
      ok: snapshot?.ok,
      keys: keys.length ? keys.join(", ") : "(none)",
      containers: containersLen == null ? "(missing)" : String(containersLen),
      instances: instancesLen == null ? "(missing)" : String(instancesLen),
      defs: defsLen == null ? "(missing)" : String(defsLen),
    };
  }, [open, snapshot]);

  const containers = snapshot?.containers || [];
  const rawNoticeText = inventoryMessage || equipmentMessage || localNotice;
  const equipmentNoticeText =
    rawNoticeText && rawNoticeText === dismissedNoticeText ? null : rawNoticeText;
  const equipmentNoticeTone = equipmentNoticeText ? resolveNoticeTone(equipmentNoticeText) : "neutral";
  const heldPreviewItem = heldState?.item ?? null;
  const heldPreviewLabel =
    heldPreviewItem?.name || heldPreviewItem?.code || heldState?.itemInstanceId || "Item";
  const heldPreviewQty = Number(heldState?.qty ?? 0);
  const carryWeight = snapshot?.carryWeight ?? null;
  const carryWeightCurrent = Number(carryWeight?.current ?? 0);
  const carryWeightMax = Number(carryWeight?.max ?? 0);
  const carryWeightPct =
    carryWeightMax > 0
      ? Math.min(100, Math.max(0, (carryWeightCurrent / carryWeightMax) * 100))
      : 0;
  const carryWeightTone =
    carryWeightMax > 0
      ? carryWeightPct >= 95
        ? "danger"
        : carryWeightPct >= 75
          ? "warn"
          : "ok"
      : "neutral";
  const unlockedCapabilities = Array.isArray(researchSnapshot?.unlockedCapabilities)
    ? researchSnapshot.unlockedCapabilities
    : [];
  const macroUnlocked =
    unlockedCapabilities.some((capability) => String(capability ?? "").startsWith("macro.")) ||
    Boolean(serverAutoFood?.itemInstanceId != null);
  const equipmentUnlocked = unlockedCapabilities.some(
    (capability) =>
      String(capability ?? "").startsWith("ui.equipment:") ||
      String(capability ?? "").startsWith("equipment.")
  );
  const activeCraftJobs = Array.isArray(snapshot?.craft?.activeJobs)
    ? snapshot.craft.activeJobs.filter((job) =>
        ["PENDING", "RUNNING", "PAUSED", "COMPLETED"].includes(String(job?.status ?? "").toUpperCase())
      )
    : [];
  const hasActiveCraftJob = activeCraftJobs.length > 0;
  const completedCraftJob = activeCraftJobs.find(
    (job) => String(job?.status ?? "").toUpperCase() === "COMPLETED"
  ) ?? null;
  const craftRecipes = Array.isArray(snapshot?.craft?.available)
    ? snapshot.craft.available.map((recipe) => {
        const ingredients = Array.isArray(recipe?.recipeItems) ? recipe.recipeItems : [];
        const readyJob =
          completedCraftJob &&
          String(completedCraftJob.craftDefId ?? "") === String(recipe.id ?? "")
            ? completedCraftJob
            : null;
        const activeJob = activeCraftJobs.find(
          (job) => String(job?.craftDefId ?? "") === String(recipe.id ?? "")
        ) ?? null;
        const hasIngredients = ingredients.every((ingredient) => {
          const itemDefId =
            ingredient?.itemDefId ??
            ingredient?.item_def_id ??
            ingredient?.itemDef?.id ??
            ingredient?.itemDef?.itemDefId ??
            ingredient?.itemDef?.item_def_id;
          const needed = Number(ingredient?.quantity ?? 0);
          if (itemDefId == null || needed <= 0) return false;
          return Number(handItemCounts.get(String(itemDefId)) ?? 0) >= needed;
        });
        const canCraft = hasIngredients && !hasActiveCraftJob;

        return {
          ...recipe,
          canCraft,
          activeJob,
          readyJob,
          blockReason: hasActiveCraftJob
            ? completedCraftJob
              ? "Collect the finished craft first."
              : "A craft is already running."
            : hasIngredients
              ? null
              : "Put the required items in one of your hands first.",
          recipeItems: ingredients.map((ingredient) => {
            const itemDefId =
              ingredient?.itemDefId ??
              ingredient?.item_def_id ??
              ingredient?.itemDef?.id ??
              ingredient?.itemDef?.itemDefId ??
              ingredient?.itemDef?.item_def_id;
            const needed = Number(ingredient?.quantity ?? 0);
            const available = itemDefId == null ? 0 : Number(handItemCounts.get(String(itemDefId)) ?? 0);
            return {
              ...ingredient,
              itemDefId,
              quantity: needed,
              available,
              isReady: available >= needed,
            };
          }),
        };
      })
    : [];
  const selectedMacroFood = macroFoodItemInstanceId
    ? getInventoryItemContext(inventoryIndex, macroFoodItemInstanceId)
    : null;
  const selectedMacroFoodLabel = selectedMacroFood
    ? getItemLabel(selectedMacroFood.inst, selectedMacroFood.def)
    : "Food Item";

  return {
    ok,
    heldState,
    heldStateActive,
    inventoryIndex,
    equipmentIndex,
    wearSlots,
    wearSlotRows,
    handSlots,
    debug,
    hungerCurrent,
    hungerMax,
    serverAutoFood,
    containers,
    equipmentNoticeText,
    equipmentNoticeTone,
    heldPreviewLabel,
    heldPreviewQty,
    carryWeightCurrent: formatWeight(carryWeightCurrent),
    carryWeightMax: formatWeight(carryWeightMax),
    carryWeightPct,
    carryWeightTone,
    macroUnlocked,
    equipmentUnlocked,
    activeCraftJobs,
    craftRecipes,
    selectedMacroFood,
    selectedMacroFoodLabel,
    isFoodItemAvailable: (itemInstanceId) => isFoodItem(inventoryIndex, itemInstanceId),
  };
}
