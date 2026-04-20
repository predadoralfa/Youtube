import { useCallback } from "react";

export function useGameShellInventoryActions({ emitInventoryAction, emitEquipmentAction }) {
  const onPickupInventoryItem = useCallback(
    ({ containerId, slotIndex }) =>
      emitInventoryAction("inv:pickup", {
        containerId: String(containerId),
        slotIndex: Number(slotIndex),
      }),
    [emitInventoryAction]
  );

  const onPlaceHeldItem = useCallback(
    ({ containerId, slotIndex }) =>
      emitInventoryAction("inv:place", {
        containerId: String(containerId),
        slotIndex: Number(slotIndex),
      }),
    [emitInventoryAction]
  );

  const onSplitInventoryItem = useCallback(
    ({ containerId, slotIndex, qty }) =>
      emitInventoryAction("inv:split", {
        containerId: String(containerId),
        slotIndex: Number(slotIndex),
        qty: Number(qty),
      }),
    [emitInventoryAction]
  );

  const onConsumeInventoryItem = useCallback(
    ({ itemInstanceId }) =>
      emitInventoryAction("inv:eat", {
        itemInstanceId: String(itemInstanceId),
      }),
    [emitInventoryAction]
  );

  const onMedicateInventoryItem = useCallback(
    ({ itemInstanceId }) =>
      emitInventoryAction("inv:medicate", {
        itemInstanceId: String(itemInstanceId),
      }),
    [emitInventoryAction]
  );

  const onMoveInventoryItem = useCallback(
    ({ fromRole, fromSlotIndex, toRole, toSlotIndex, qty }) =>
      emitInventoryAction("inv:move", {
        from: {
          role: String(fromRole),
          slot: Number(fromSlotIndex),
          slotIndex: Number(fromSlotIndex),
        },
        to: {
          role: String(toRole),
          slot: Number(toSlotIndex),
          slotIndex: Number(toSlotIndex),
        },
        qty: qty == null ? 1 : Number(qty),
      }),
    [emitInventoryAction]
  );

  const onCancelHeldState = useCallback(
    () => emitInventoryAction("inv:cancel", {}),
    [emitInventoryAction]
  );

  const onSetAutoFoodMacro = useCallback(
    ({ itemInstanceId, hungerThreshold }) =>
      emitInventoryAction("inv:auto_food:set", {
        itemInstanceId: itemInstanceId == null ? null : String(itemInstanceId),
        hungerThreshold: Number(hungerThreshold),
      }),
    [emitInventoryAction]
  );

  const onCraftRecipe = useCallback(
    ({ code, craftCode }) =>
      emitInventoryAction("craft:start", {
        craftCode: String(craftCode ?? code),
      }),
    [emitInventoryAction]
  );

  const onClaimCraftJob = useCallback(
    ({ id, jobId }) =>
      emitInventoryAction("craft:claim", {
        jobId: String(jobId ?? id),
      }),
    [emitInventoryAction]
  );

  const onEquipItemToSlot = useCallback(
    ({ itemInstanceId, slotCode }) =>
      emitEquipmentAction("equipment:equip", {
        itemInstanceId: String(itemInstanceId),
        slotCode: String(slotCode),
      }),
    [emitEquipmentAction]
  );

  const onUnequipItemFromSlot = useCallback(
    ({ slotCode }) =>
      emitEquipmentAction("equipment:unequip", {
        slotCode: String(slotCode),
      }),
    [emitEquipmentAction]
  );

  const onSwapEquipmentSlots = useCallback(
    ({ fromSlotCode, toSlotCode }) =>
      emitEquipmentAction("equipment:swap", {
        fromSlotCode: String(fromSlotCode),
        toSlotCode: String(toSlotCode),
      }),
    [emitEquipmentAction]
  );

  return {
    onPickupInventoryItem,
    onPlaceHeldItem,
    onSplitInventoryItem,
    onConsumeInventoryItem,
    onMedicateInventoryItem,
    onMoveInventoryItem,
    onCancelHeldState,
    onSetAutoFoodMacro,
    onCraftRecipe,
    onClaimCraftJob,
    onEquipItemToSlot,
    onUnequipItemFromSlot,
    onSwapEquipmentSlots,
  };
}
