const DEBUG_AUTO_FOOD = import.meta.env.DEV;

export function createMacroHandlers({
  inventoryIndex,
  equipmentSnapshot,
  macroUnlocked,
  macroHungerThreshold,
  setMacroFoodItemInstanceId,
  setLocalNotice,
  onSetAutoFoodMacro,
  onCancelHeldState,
  clearDrag,
  dropHandledRef,
  }) {
  const applyMacroFoodSelection = (itemInstanceId) => {
    if (DEBUG_AUTO_FOOD) {
      console.debug("[AUTO_FOOD][client][select:start]", {
        itemInstanceId: itemInstanceId == null ? null : String(itemInstanceId),
        macroUnlocked,
      });
    }

    if (itemInstanceId == null) {
      setLocalNotice("Macro item is not available right now");
      return false;
    }

    if (!macroUnlocked) {
      if (DEBUG_AUTO_FOOD) {
        console.debug("[AUTO_FOOD][client][select:blocked-research]", {
          itemInstanceId: String(itemInstanceId),
        });
      }
      setLocalNotice("Research required to unlock auto food");
      return false;
    }

    const nextItemInstanceId = String(itemInstanceId);
    const ok = onSetAutoFoodMacro?.(
      {
        itemInstanceId: nextItemInstanceId,
        hungerThreshold: macroHungerThreshold,
      },
      (ack) => {
        const ackOk = ack?.ok === true;
        if (DEBUG_AUTO_FOOD) {
          console.debug("[AUTO_FOOD][client][select:ack]", {
            itemInstanceId: nextItemInstanceId,
            ok: ackOk,
            code: ack?.code ?? null,
            message: ack?.message ?? null,
          });
        }

        if (ackOk) {
          setMacroFoodItemInstanceId(nextItemInstanceId);
          setLocalNotice(null);
          onCancelHeldState?.();
          return;
        }

        setLocalNotice(ack?.message || ack?.code || "Macro update is not available right now");
      }
    );
    if (DEBUG_AUTO_FOOD) {
      console.debug("[AUTO_FOOD][client][select:emit]", {
        itemInstanceId: nextItemInstanceId,
        sent: Boolean(ok),
      });
    }
    return ok;
  };

  const handleMacroFoodDrop = (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    dropHandledRef.current = true;
    const raw = event.dataTransfer?.getData("application/json");
    if (!raw) return;

    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }

    if (!payload?.itemInstanceId) return;
    const ok = applyMacroFoodSelection(payload.itemInstanceId);
    clearDrag();
  };

  const handleMacroFoodHeldSelect = (itemInstanceId) => applyMacroFoodSelection(itemInstanceId);

  return { handleMacroFoodDrop, handleMacroFoodHeldSelect };
}
