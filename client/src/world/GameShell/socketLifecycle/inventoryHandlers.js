import { buildLootNotifications, mergeSnapshotActor, toId } from "../helpers";
import { logInventory } from "@/inventory/inventoryProbe";

export function createInventoryHandlers(state) {
  const onInvFull = (payload) => {
    const inv = payload?.ok === true ? payload : payload ?? { ok: false };
    logInventory("SOCKET_INV_FULL", inv);

    if (inv?.ok === true) {
      state.setInventorySnapshot(inv);
      if (inv?.equipment?.ok === true) {
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
    const actorMessage = payload?.message ?? null;
    if (!actorId) return;

    if (inventoryFull?.ok === true) {
      const lootMessages = lootInfo?.qty > 0
        ? [{
            id: `loot:${actorId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
            text: `+${Number(lootInfo.qty)} ${lootInfo.itemName ?? lootInfo.itemDefId ?? "Loot"}`,
            startedAt: Date.now(),
            ttlMs: 1400,
          }]
        : buildLootNotifications(state.inventorySnapshotRef.current, inventoryFull);

      if (lootMessages.length > 0) {
        state.setLootNotifications((current) => [...current, ...lootMessages].slice(-8));
      }

      state.setInventorySnapshot(inventoryFull);
      if (inventoryFull?.equipment?.ok === true) {
        state.setEquipmentSnapshot(inventoryFull.equipment);
      }
      state.setInventoryMessage(null);
    }

    if (actorMessage) {
      state.setInventoryMessage(actorMessage);
      state.setLootNotifications((current) =>
        [
          ...current,
          {
            id: `actor-msg:${actorId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
            text: actorMessage,
            startedAt: Date.now(),
            ttlMs: 1800,
          },
        ].slice(-8)
      );
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
