import { useCallback } from "react";

export function useGameShellRequestActions(state) {
  const requestInventoryFull = useCallback(() => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;
    s.emit("inv:request_full", { reason: "ui_open" });
    return true;
  }, [state.joinedRef, state.socketRef]);

  const requestResearchFull = useCallback(() => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;
    s.emit("research:request_full", { reason: "ui_open" });
    return true;
  }, [state.joinedRef, state.socketRef]);

  const emitEquipmentAction = useCallback((eventName, payload) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    s.emit(eventName, payload, (ack) => {
      if (ack?.ok === true && ack?.equipment?.ok === true) {
        state.setEquipmentSnapshot(ack.equipment);
        state.setEquipmentMessage(null);
        return;
      }
      if (ack?.ok === true) {
        state.setEquipmentMessage(null);
        return;
      }
      state.setEquipmentMessage(ack?.message || ack?.code || "Falha ao atualizar equipment");
    });

    return true;
  }, [state]);

  const emitInventoryAction = useCallback((eventName, payload) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    state.setInventoryMessage(null);
    s.emit(eventName, payload, (ack) => {
      if (ack?.ok === true && ack?.inventory?.ok === true) {
        state.setInventorySnapshot(ack.inventory);
        if (ack.inventory?.equipment?.ok === true) {
          state.setEquipmentSnapshot(ack.inventory.equipment);
        }
        state.setInventoryMessage(null);
        return;
      }

      if (ack?.ok === false) {
        state.setInventoryMessage(ack?.message || ack?.code || "Falha ao atualizar inventário");
      }
    });

    return true;
  }, [state]);

  const emitInventoryDrop = useCallback((itemInstanceId) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    state.setInventoryMessage(null);
    s.emit("inv:drop", { itemInstanceId: String(itemInstanceId) }, (ack) => {
      if (ack?.ok === true && ack?.inventory?.ok === true) {
        state.setInventorySnapshot(ack.inventory);
        if (ack.inventory?.equipment?.ok === true) {
          state.setEquipmentSnapshot(ack.inventory.equipment);
        }
        state.setInventoryMessage(null);
        return;
      }

      if (ack?.ok === false) {
        state.setInventoryMessage(ack?.message || ack?.code || "Falha ao dropar item");
      }
    });

    return true;
  }, [state]);

  const emitResearchStart = useCallback((researchCode) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    state.setResearchMessage(null);
    s.emit("research:start", { researchCode: String(researchCode) }, (ack) => {
      if (ack?.ok === true && ack?.research?.ok === true) {
        state.setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                research: ack.research,
              }
            : prev
        );
        requestInventoryFull();
        state.setResearchMessage(null);
        return;
      }

      if (ack?.ok === false) {
        state.setResearchMessage(ack?.message || ack?.code || "Falha ao iniciar estudo");
      }
    });

    return true;
  }, [requestInventoryFull, state]);

  return {
    requestInventoryFull,
    requestResearchFull,
    emitEquipmentAction,
    emitInventoryAction,
    emitInventoryDrop,
    emitResearchStart,
  };
}
