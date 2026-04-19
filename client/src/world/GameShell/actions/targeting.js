import { useCallback } from "react";

export function useGameShellTargetingActions(state) {
  const emitInteractStart = useCallback((targetOverride = null) => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;

    const target = targetOverride ?? state.selectedTargetRef.current;
    if (target?.kind && target?.id) {
      s.emit("interact:start", {
        target: {
          kind: String(target.kind),
          id: String(target.id),
        },
      });
    } else {
      s.emit("interact:start", {});
    }
    return true;
  }, [state]);

  const emitInteractStop = useCallback(() => {
    const s = state.socketRef.current;
    if (!s || !state.joinedRef.current) return false;
    s.emit("interact:stop", {});
    return true;
  }, [state]);

  const closeInventory = useCallback(() => {
    if (state.combatTargetRef.current != null) {
      emitInteractStop();
    }
    state.selectedTargetRef.current = null;
    state.combatTargetRef.current = null;
    state.setInventoryOpen(false);
  }, [emitInteractStop, state]);

  const closeResearch = useCallback(() => {
    state.setResearchOpen(false);
  }, [state]);

  const closeBuild = useCallback(() => {
    state.setBuildOpen(false);
  }, [state]);

  const onTargetSelect = useCallback((target) => {
    if (!target?.kind || target?.id == null) return;
    state.selectedTargetRef.current = {
      kind: String(target.kind),
      id: String(target.id),
    };
    state.combatTargetRef.current = null;
  }, [state]);

  const onTargetClear = useCallback(() => {
    if (state.combatTargetRef.current != null) {
      emitInteractStop();
    }
    state.selectedTargetRef.current = null;
    state.combatTargetRef.current = null;
  }, [emitInteractStop, state]);

  return {
    emitInteractStart,
    emitInteractStop,
    closeInventory,
    closeResearch,
    closeBuild,
    onTargetSelect,
    onTargetClear,
  };
}
