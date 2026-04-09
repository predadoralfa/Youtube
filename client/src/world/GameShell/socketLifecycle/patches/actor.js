import { parseMaybeJsonObject, toId } from "../../helpers";

export function normalizeSpawnedActor(actor, store) {
  const actorId = toId(actor?.id ?? actor?.actorId ?? actor?.actor_id ?? null);
  if (!actorId) return null;

  const normalizedState = parseMaybeJsonObject(actor?.state ?? actor?.state_json ?? null);
  const looksLikeItemDrop =
    normalizedState?.dropSource != null ||
    normalizedState?.sourceKind != null ||
    normalizedState?.itemInstanceId != null ||
    normalizedState?.itemDefId != null ||
    normalizedState?.itemCode != null;

  return {
    ...actor,
    id: actorId,
    actorType:
      actor?.actorDefCode === "GROUND_LOOT" ||
      actor?.actorType === "GROUND_LOOT" ||
      actor?.actor_type === "GROUND_LOOT"
        ? "GROUND_LOOT"
        : looksLikeItemDrop
          ? "ITEM_DROP"
          : (actor?.actorDefCode ?? actor?.actorType ?? actor?.actor_type ?? "CHEST"),
    actorDefCode: actor?.actorDefCode ?? actor?.actorType ?? actor?.actor_type ?? null,
    actorKind: actor?.actorKind ?? null,
    visualHint: actor?.visualHint ?? null,
    instanceId: Number(actor?.instanceId ?? actor?.instance_id ?? store.instanceId ?? 0),
    state: normalizedState,
    pos: {
      x: Number(actor?.pos?.x ?? actor?.position?.x ?? 0),
      y: Number(actor?.pos?.y ?? actor?.position?.y ?? 0),
      z: Number(actor?.pos?.z ?? actor?.position?.z ?? 0),
    },
  };
}
