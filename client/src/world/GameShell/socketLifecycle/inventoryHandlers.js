import { buildLootNotifications, mergeSnapshotActor, toId } from "../helpers";
import { logInventory } from "@/inventory/inventoryProbe";

function resolveActorNoticeTone(message) {
  const value = String(message ?? "").toLowerCase();
  if (
    value.includes("carry weight") ||
    value.includes("weight limit") ||
    value.includes("stamina") ||
    value.includes("exhaust") ||
    value.includes("peso") ||
    value.includes("limite de peso")
  ) {
    return "warn";
  }
  return "danger";
}

export function createInventoryHandlers(state) {
  const onInvFull = (payload) => {
    const inv = payload?.ok === true ? payload : payload ?? { ok: false };
    logInventory("SOCKET_INV_FULL", inv);

    if (inv?.ok === true) {
      state.setInventorySnapshot(inv);
      if (inv?.equipment) {
        state.setEquipmentSnapshot(inv.equipment);
      }
    }
  };

  const onResearchFull = (payload) => {
    const research = payload?.ok === true ? payload : payload ?? { ok: false };
    if (research?.ok === true) {
      state.setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              research,
            }
          : prev
      );
      state.setResearchMessage(null);
    }
  };

  const onEquipmentFull = (payload) => {
    const equipment = payload?.ok === true ? payload : payload ?? { ok: false };
    if (equipment?.ok === true) {
      state.setEquipmentSnapshot(equipment);
      state.setEquipmentMessage(null);
    }
  };

  const onActorCollected = (payload) => {
    const actorId = toId(payload?.actorId ?? null);
    const actorDisabled = Boolean(payload?.actorDisabled);
    const inventoryFull = payload?.inventory ?? payload?.inventoryFull ?? null;
    const lootInfo = payload?.loot ?? null;
    const waterInfo = payload?.water ?? null;
    const xpInfo = payload?.xp ?? null;
    const actorMessage = payload?.message ?? null;
    const actorUpdate = payload?.actorUpdate ?? null;
    if (!actorId) return;

    const hasInventorySnapshot =
      inventoryFull &&
      (inventoryFull.ok === true ||
        Array.isArray(inventoryFull.containers) ||
        inventoryFull.carryWeight != null ||
        inventoryFull.skills != null);

    if (actorUpdate) {
      state.setSnapshot((prev) => mergeSnapshotActor(prev, actorUpdate));
    }

    const lootMessages = lootInfo?.qty > 0
      ? [{
          id: `loot:${actorId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          text: `+${Number(lootInfo.qty)} ${lootInfo.itemName ?? lootInfo.itemDefId ?? "Loot"}`,
          subtext: xpInfo?.xpGained > 0 ? `+${Number(xpInfo.xpGained)} XP` : null,
          startedAt: Date.now(),
          ttlMs: 1400,
        }]
      : waterInfo?.points > 0
        ? [{
            id: `water:${actorId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
            text: `+${Math.max(0, Math.trunc(Number(waterInfo.points ?? 0)))} ${waterInfo.label ?? "Water"}`,
            subtext: `+${Math.max(0, Math.trunc(Number(waterInfo.points ?? 0)))} points`,
            startedAt: Date.now(),
            ttlMs: 1400,
          }]
        : hasInventorySnapshot
          ? buildLootNotifications(state.inventorySnapshotRef.current, inventoryFull)
          : [];

    if (lootMessages.length > 0) {
      state.setLootNotifications((current) => [...current, ...lootMessages].slice(-8));
    }

    if (hasInventorySnapshot) {
      state.setInventorySnapshot(inventoryFull);
      if (inventoryFull?.equipment) {
        state.setEquipmentSnapshot(inventoryFull.equipment);
      }
    }

    if (actorMessage) {
      state.setWorldNotifications((current) => [
        ...current,
        {
          id: `actor-msg:${actorId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          text: actorMessage,
          tone: resolveActorNoticeTone(actorMessage),
          startedAt: Date.now(),
          ttlMs: 1800,
        },
      ].slice(-8));
    }

    state.setSnapshot((prev) => {
      let next = prev;
      if (payload?.actorUpdate) {
        next = mergeSnapshotActor(next, payload.actorUpdate);
      }
      if (!next || !actorDisabled) return next;

      const actors = Array.isArray(next.actors) ? next.actors : [];
      if (!actors.some((actor) => String(actor.id) === String(actorId))) return next;

      return {
        ...next,
        actors: actors.filter((actor) => String(actor.id) !== String(actorId)),
      };
    });
  };

  const onActorUpdated = (payload) => {
    const actorUpdate = payload?.actor ?? payload?.entity ?? payload ?? null;
    state.setSnapshot((prev) => mergeSnapshotActor(prev, actorUpdate));
  };

  return {
    onInvFull,
    onResearchFull,
    onEquipmentFull,
    onActorCollected,
    onActorUpdated,
  };
}
