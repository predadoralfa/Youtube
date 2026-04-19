import { useCallback } from "react";
import { IntentType } from "../../input/intents";
import { isInteractDown, isInteractUp } from "../helpers";

function findNearestCollectableActor(snapshot, maxRadius = 2.4) {
  const playerPos = snapshot?.runtime?.pos ?? null;
  const px = Number(playerPos?.x);
  const pz = Number(playerPos?.z);
  if (!Number.isFinite(px) || !Number.isFinite(pz)) return null;

  const actors = Array.isArray(snapshot?.actors) ? snapshot.actors : [];
  const maxDistSq = Number(maxRadius) * Number(maxRadius);
  let best = null;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const actor of actors) {
    if (!actor || String(actor.status ?? "ACTIVE") !== "ACTIVE") continue;

    const hasLootContainer = Array.isArray(actor.containers)
      ? actor.containers.some((container) => String(container?.slotRole ?? "").toUpperCase() === "LOOT")
      : false;
    if (!hasLootContainer) continue;

    const ax = Number(actor.pos?.x ?? NaN);
    const az = Number(actor.pos?.z ?? NaN);
    const dx = ax - px;
    const dz = az - pz;
    const distSq = dx * dx + dz * dz;
    if (!Number.isFinite(distSq) || distSq > maxDistSq) continue;
    if (distSq >= bestDistSq) continue;

    best = actor;
    bestDistSq = distSq;
  }

  if (!best?.id) return null;
  return {
    kind: "ACTOR",
    id: String(best.id),
  };
}

export function useGameShellIntentAction(state, handlers) {
  const {
    requestInventoryFull,
      requestResearchFull,
      closeBuild,
      closeResearch,
      closeInventory,
      closeSkills,
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
            state.setSkillsOpen(false);
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
            state.setSkillsOpen(false);
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
            state.setSkillsOpen(false);
          }
          return next;
        });
        return;
      }

      if (intent.type === IntentType.UI_TOGGLE_SKILLS) {
        state.setSkillsOpen((prev) => {
          const next = !prev;
          if (next) {
            state.setInventoryOpen(false);
            state.setResearchOpen(false);
            state.setBuildOpen(false);
          }
          return next;
        });
        return;
      }

      if (intent.type === IntentType.UI_CANCEL) {
        if (state.skillsOpen) return closeSkills();
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

        const actorTarget =
          target?.kind === "ACTOR" && target?.id != null
            ? { kind: "ACTOR", id: String(target.id) }
            : findNearestCollectableActor(state.snapshot, 2.4);

        emitInteractStart(actorTarget);
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
      closeSkills,
      emitInteractStart,
      emitInteractStop,
    ]
  );
}
