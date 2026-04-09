import { useCallback } from "react";
import { IntentType } from "../../input/intents";
import { isInteractDown, isInteractUp } from "../helpers";

export function useGameShellIntentAction(state, handlers) {
  const {
    requestInventoryFull,
    requestResearchFull,
    closeBuild,
    closeResearch,
    closeInventory,
    emitInteractStart,
    emitInteractStop,
  } = handlers;

  return useCallback(
    (intent) => {
      if (!intent || typeof intent !== "object") return;

      if (intent.type === IntentType.UI_TOGGLE_INVENTORY) {
        state.setInventoryOpen((prev) => {
          const next = !prev;
          if (next) {
            state.setResearchOpen(false);
            state.pendingInvRequestRef.current = true;
            const ok = requestInventoryFull();
            if (ok) state.pendingInvRequestRef.current = false;
          }
          return next;
        });
        return;
      }

      if (intent.type === IntentType.UI_TOGGLE_RESEARCH) {
        state.setResearchOpen((prev) => {
          const next = !prev;
          if (next) {
            state.setInventoryOpen(false);
            state.setBuildOpen(false);
            requestInventoryFull();
            requestResearchFull();
          }
          return next;
        });
        return;
      }

      if (intent.type === IntentType.UI_TOGGLE_BUILD) {
        state.setBuildOpen((prev) => {
          const next = !prev;
          if (next) {
            state.setInventoryOpen(false);
            state.setResearchOpen(false);
          }
          return next;
        });
        return;
      }

      if (intent.type === IntentType.UI_CANCEL) {
        if (state.buildOpen) return closeBuild();
        if (state.researchOpen) return closeResearch();
        if (state.inventoryOpen) return closeInventory();
        return closeInventory();
      }

      if (intent.type === IntentType.TARGET_SELECT) {
        const kind = intent?.target?.kind;
        const id = intent?.target?.id;
        if (kind && id != null) {
          state.selectedTargetRef.current = { kind: String(kind), id: String(id) };
          state.combatTargetRef.current = null;
        }
        return;
      }

      if (intent.type === IntentType.TARGET_CLEAR) {
        state.selectedTargetRef.current = null;
        state.combatTargetRef.current = null;
        return;
      }

      if (isInteractDown(intent.type)) {
        const target = state.selectedTargetRef.current;
        if (target?.kind === "ENEMY") {
          const targetId = String(target.id);
          if (state.combatTargetRef.current !== targetId) {
            state.socketRef.current?.emit("interact:start", {
              target: {
                kind: String(target.kind),
                id: targetId,
              },
            });
            state.combatTargetRef.current = targetId;
            return;
          }
          return;
        }

        emitInteractStart();
        return;
      }

      if (isInteractUp(intent.type)) {
        const target = state.selectedTargetRef.current;
        if (!target?.kind || target.kind !== "ENEMY") {
          emitInteractStop();
        }
      }
    },
    [
      state,
      requestInventoryFull,
      requestResearchFull,
      closeBuild,
      closeResearch,
      closeInventory,
      emitInteractStart,
      emitInteractStop,
    ]
  );
}
