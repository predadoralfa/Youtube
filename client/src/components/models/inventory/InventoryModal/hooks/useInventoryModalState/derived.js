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

export function useInventoryModalDerivedState({
  open,
  snapshot,
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
    heldPreviewLabel,
    heldPreviewQty,
    carryWeightCurrent: formatWeight(carryWeightCurrent),
    carryWeightMax: formatWeight(carryWeightMax),
    carryWeightPct,
    carryWeightTone,
    selectedMacroFood,
    selectedMacroFoodLabel,
    isFoodItemAvailable: (itemInstanceId) => isFoodItem(inventoryIndex, itemInstanceId),
  };
}
