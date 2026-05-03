import { useCallback } from "react";

export function useGameShellInventoryActions({ emitInventoryAction, emitEquipmentAction }) {
  const debugEnabled = import.meta.env.DEV;
  const onPickupInventoryItem = useCallback(
    ({ containerId, slotIndex }) => {
      if (debugEnabled) {
        console.debug("[INV_DEBUG][client][pickup]", {
          containerId,
          slotIndex,
        });
      }

      const ok = emitInventoryAction("inv:pickup", {
        containerId: String(containerId),
        slotIndex: Number(slotIndex),
      });

      if (debugEnabled && !ok) {
        console.debug("[INV_DEBUG][client][pickup:emit-failed]", {
          containerId,
          slotIndex,
        });
      }

      return ok;
    },
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
    ({ fromRole, fromContainerId, fromSlotIndex, toRole, toContainerId, toSlotIndex, qty }) =>
      emitInventoryAction("inv:move", {
        from: {
          role: String(fromRole),
          containerId: fromContainerId == null ? null : String(fromContainerId),
          slot: Number(fromSlotIndex),
          slotIndex: Number(fromSlotIndex),
        },
        to: {
          role: String(toRole),
          containerId: toContainerId == null ? null : String(toContainerId),
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
    ({ itemInstanceId, hungerThreshold }, onAck) =>
      emitInventoryAction("inv:auto_food:set", {
        itemInstanceId: itemInstanceId == null ? null : String(itemInstanceId),
        hungerThreshold: Number(hungerThreshold),
      }, onAck),
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
