import { useCallback } from "react";
import { IntentType } from "../../input/intents";
import { isInteractDown, isInteractUp } from "../helpers";

const RIVER_INTERACT_HALF_WIDTH = 3.25;
const RIVER_INTERACT_HALF_DEPTH = 1.2;
const RIVER_INTERACT_STOP_RADIUS = Math.hypot(RIVER_INTERACT_HALF_WIDTH, RIVER_INTERACT_HALF_DEPTH) + 0.15;

function isRiverSourceActor(actor) {
  const actorType = String(actor?.actorType ?? actor?.actorDefCode ?? "").trim().toUpperCase();
  const actorKind = String(actor?.actorKind ?? "").trim().toUpperCase();
  const visualHint = String(actor?.visualHint ?? "").trim().toUpperCase();

  return (
    actorType === "RIVER_PATCH" ||
    actorKind === "WATER_SOURCE" ||
    visualHint === "WATER"
  );
}

function isInsideRiverBox(actor, px, pz) {
  const ax = Number(actor?.pos?.x);
  const az = Number(actor?.pos?.z);
  if (!Number.isFinite(ax) || !Number.isFinite(az)) return false;

  return (
    Math.abs(px - ax) <= RIVER_INTERACT_HALF_WIDTH &&
    Math.abs(pz - az) <= RIVER_INTERACT_HALF_DEPTH
  );
}

function resolveSelectedActorInteractTarget(snapshot, target) {
  if (target?.kind !== "ACTOR" || target?.id == null) return null;

  const actors = Array.isArray(snapshot?.actors) ? snapshot.actors : [];
  const actor = actors.find((entry) => String(entry?.id) === String(target.id)) ?? null;
  if (!actor) {
    return { kind: "ACTOR", id: String(target.id) };
  }

  if (isRiverSourceActor(actor)) {
    return {
      kind: "ACTOR",
      id: String(target.id),
      stopRadius: RIVER_INTERACT_STOP_RADIUS,
    };
  }

  return {
    kind: "ACTOR",
    id: String(target.id),
  };
}

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

    if (isRiverSourceActor(actor)) {
      if (!isInsideRiverBox(actor, px, pz)) continue;

      const ax = Number(actor.pos?.x ?? NaN);
      const az = Number(actor.pos?.z ?? NaN);
      const dx = ax - px;
      const dz = az - pz;
      const distSq = dx * dx + dz * dz;
      if (!Number.isFinite(distSq) || distSq >= bestDistSq) continue;

      best = actor;
      bestDistSq = distSq;
      continue;
    }

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
    stopRadius: isRiverSourceActor(best) ? RIVER_INTERACT_STOP_RADIUS : maxRadius,
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
      clearBuildPlacement,
      emitBuildPlace,
      emitSleepStop,
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
        if (state.snapshot?.runtime?.sleepLock?.active || state.snapshot?.runtime?.sleepLock?.pending) {
          return emitSleepStop?.();
        }
        if (state.buildPlacement) return clearBuildPlacement();
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

      if (intent.type === IntentType.BUILD_PLACE_CONFIRM) {
        const worldPos = intent?.worldPos ?? null;
        if (!worldPos) return;
        emitBuildPlace(worldPos);
        return;
      }

      if (intent.type === IntentType.BUILD_CANCEL) {
        clearBuildPlacement();
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
            ? resolveSelectedActorInteractTarget(state.snapshot, target)
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
      clearBuildPlacement,
      emitBuildPlace,
      emitSleepStop,
    ]
  );
}
