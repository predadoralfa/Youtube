import { toDisplayInt, toId } from "./numbers";

export function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildInventoryTotals(snapshot) {
  const containers = Array.isArray(snapshot?.containers) ? snapshot.containers : [];
  const itemInstances = Array.isArray(snapshot?.itemInstances) ? snapshot.itemInstances : [];
  const itemDefs = Array.isArray(snapshot?.itemDefs) ? snapshot.itemDefs : [];

  const itemInstanceById = new Map(
    itemInstances.filter((it) => it?.id != null).map((it) => [String(it.id), it])
  );

  const itemDefById = new Map(
    itemDefs.filter((def) => def?.id != null).map((def) => [String(def.id), def])
  );

  const totals = new Map();

  for (const container of containers) {
    const slots = Array.isArray(container?.slots) ? container.slots : [];
    for (const slot of slots) {
      const itemInstanceId = slot?.itemInstanceId;
      if (itemInstanceId == null) continue;

      const inst = itemInstanceById.get(String(itemInstanceId));
      if (!inst) continue;

      const def = itemDefById.get(String(inst.itemDefId)) ?? null;
      const itemDefId = String(inst.itemDefId ?? "unknown");
      const qty = toDisplayInt(slot?.qty ?? 0, 0);
      if (qty <= 0) continue;

      const current = totals.get(itemDefId) ?? {
        itemDefId,
        qty: 0,
        name: def?.name ?? `Item ${itemDefId}`,
      };

      current.qty += qty;
      if (!current.name && def?.name) current.name = def.name;
      totals.set(itemDefId, current);
    }
  }

  return totals;
}

export function buildLootNotifications(prevSnapshot, nextSnapshot) {
  if (!nextSnapshot) return [];

  const prevTotals = buildInventoryTotals(prevSnapshot);
  const nextTotals = buildInventoryTotals(nextSnapshot);
  const now = Date.now();

  const messages = [];
  for (const [itemDefId, nextEntry] of nextTotals.entries()) {
    const prevQty = prevTotals.get(itemDefId)?.qty ?? 0;
    const deltaQty = Number(nextEntry.qty ?? 0) - Number(prevQty ?? 0);
    if (deltaQty <= 0) continue;

    messages.push({
      id: `loot:${itemDefId}:${now}:${Math.random().toString(36).slice(2, 8)}`,
      text: `+${deltaQty} ${nextEntry.name ?? `Item ${itemDefId}`}`,
      startedAt: now,
      ttlMs: 1400,
    });
  }

  return messages;
}

export function mergeSnapshotActor(prevSnapshot, actorUpdate) {
  if (!prevSnapshot || !actorUpdate) return prevSnapshot;

  const actorId = toId(actorUpdate?.id ?? actorUpdate?.actorId ?? actorUpdate?.actor?.id ?? null);
  if (!actorId) return prevSnapshot;

  const nextActorPatch = actorUpdate?.actor ?? actorUpdate;
  const actors = Array.isArray(prevSnapshot.actors) ? prevSnapshot.actors : [];
  let changed = false;
  let found = false;

  const nextActors = actors.map((actor) => {
    if (toId(actor?.id ?? null) !== actorId) return actor;
    found = true;
    changed = true;
    return {
      ...actor,
      ...nextActorPatch,
      id: actor?.id ?? nextActorPatch?.id ?? actorId,
    };
  });

  if (!found) {
    changed = true;
    nextActors.push({
      id: nextActorPatch?.id ?? actorId,
      ...nextActorPatch,
    });
  }

  if (!changed) return prevSnapshot;

  return {
    ...prevSnapshot,
    actors: nextActors,
  };
}
